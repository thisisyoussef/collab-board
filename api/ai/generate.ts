import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Client } from 'langsmith';
import { traceable } from 'langsmith/traceable';
import { wrapAnthropic } from 'langsmith/wrappers/anthropic';
import { wrapOpenAI } from 'langsmith/wrappers/openai';
import { normalizeBoardRole, resolveBoardAccess } from '../../src/lib/access.js';

// --------------------------------------------------------------------------
// API Logger — structured JSON logging for Vercel function logs
// --------------------------------------------------------------------------
const API_LOG_LEVEL_PRIORITY: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const API_CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';

function apiLog(level: string, category: string, message: string, context?: Record<string, unknown>) {
  if ((API_LOG_LEVEL_PRIORITY[level] ?? 1) < (API_LOG_LEVEL_PRIORITY[API_CURRENT_LEVEL] ?? 1)) return;
  const entry = { timestamp: new Date().toISOString(), level, category, message, ...(context || {}) };
  const line = JSON.stringify(entry);
  if (level === 'error') { console.error(line); } else { console.log(line); }
}

const apiLogger = {
  debug: (cat: string, msg: string, ctx?: Record<string, unknown>) => apiLog('debug', cat, msg, ctx),
  info: (cat: string, msg: string, ctx?: Record<string, unknown>) => apiLog('info', cat, msg, ctx),
  warn: (cat: string, msg: string, ctx?: Record<string, unknown>) => apiLog('warn', cat, msg, ctx),
  error: (cat: string, msg: string, ctx?: Record<string, unknown>) => apiLog('error', cat, msg, ctx),
};

const LANGSMITH_PROJECT_FALLBACK = 'collab-board-dev';
const LANGSMITH_TAGS = ['collab-board', 'api', 'ai-generate'];
const AI_PROVIDER_MODE_FALLBACK = 'anthropic';
const AI_OPENAI_PERCENT_FALLBACK = 50;
const ANTHROPIC_MODEL_FALLBACK = 'claude-sonnet-4-20250514';
const OPENAI_MODEL_FALLBACK = 'gpt-4.1-mini';
const MODEL_NAME_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
const LANGSMITH_TRACING_ENABLED =
  process.env.LANGCHAIN_TRACING_V2 === 'true' &&
  typeof process.env.LANGCHAIN_API_KEY === 'string' &&
  process.env.LANGCHAIN_API_KEY.trim().length > 0;
const TRACE_FLUSH_TIMEOUT_MS = 900;

type AIProvider = 'anthropic' | 'openai';
type AIProviderMode = AIProvider | 'ab';

function isExperimentOverridesEnabled(): boolean {
  return process.env.AI_ALLOW_EXPERIMENT_OVERRIDES === 'true';
}

function getLangSmithProjectName(): string {
  const value = process.env.LANGCHAIN_PROJECT;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return LANGSMITH_PROJECT_FALLBACK;
}

function getProviderMode(): AIProviderMode {
  const value = process.env.AI_PROVIDER_MODE;
  if (value === 'anthropic' || value === 'openai' || value === 'ab') {
    return value;
  }
  return AI_PROVIDER_MODE_FALLBACK;
}

function getOpenAIPercent(): number {
  const value = Number.parseInt(process.env.AI_OPENAI_PERCENT ?? '', 10);
  if (Number.isNaN(value)) {
    return AI_OPENAI_PERCENT_FALLBACK;
  }
  return Math.max(0, Math.min(100, value));
}

function deterministicPercentBucket(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

function chooseProviderForRequest(boardId: string, actorUserId: string): AIProvider {
  const mode = getProviderMode();
  if (mode === 'anthropic' || mode === 'openai') {
    return mode;
  }

  const openAIPercent = getOpenAIPercent();
  const bucket = deterministicPercentBucket(`${boardId}:${actorUserId}`);
  return bucket < openAIPercent ? 'openai' : 'anthropic';
}

function isAIProvider(value: unknown): value is AIProvider {
  return value === 'anthropic' || value === 'openai';
}

function sanitizeModelName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !MODEL_NAME_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function getAnthropicModelName(): string {
  const value = process.env.ANTHROPIC_MODEL;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return ANTHROPIC_MODEL_FALLBACK;
}

function getOpenAIModelName(): string {
  const value = process.env.OPENAI_MODEL;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return OPENAI_MODEL_FALLBACK;
}

const baseAnthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const baseOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const langSmithClient = LANGSMITH_TRACING_ENABLED
  ? new Client({
      apiKey: process.env.LANGCHAIN_API_KEY,
      apiUrl: process.env.LANGCHAIN_ENDPOINT,
    })
  : null;
const anthropic = LANGSMITH_TRACING_ENABLED
  ? wrapAnthropic(baseAnthropic, {
      name: 'collabboard.anthropic.messages',
      project_name: getLangSmithProjectName(),
      client: langSmithClient ?? undefined,
      tags: LANGSMITH_TAGS,
      metadata: {
        route: '/api/ai/generate',
        provider: 'anthropic',
      },
    })
  : baseAnthropic;
const openai = LANGSMITH_TRACING_ENABLED
  ? wrapOpenAI(baseOpenAI, {
      name: 'collabboard.openai.chat.completions',
      project_name: getLangSmithProjectName(),
      client: langSmithClient ?? undefined,
      tags: LANGSMITH_TAGS,
      metadata: {
        route: '/api/ai/generate',
        provider: 'openai',
      },
    })
  : baseOpenAI;

interface OutgoingToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolValidationIssue {
  toolCallId: string;
  toolName: string;
  reason: string;
}

const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'createStickyNote',
    description: 'Create a sticky note on the whiteboard',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text content of the sticky note' },
        x: { type: 'number', description: 'X position in world coordinates' },
        y: { type: 'number', description: 'Y position in world coordinates' },
        color: {
          type: 'string',
          description: 'Hex color for the sticky note background (e.g. #FFEB3B)',
        },
      },
      required: ['text', 'x', 'y'],
    },
  },
  {
    name: 'createShape',
    description: 'Create a shape (rectangle, circle, etc.) on the whiteboard',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['rect', 'circle', 'line'],
          description: 'The type of shape to create',
        },
        x: { type: 'number', description: 'X position in world coordinates' },
        y: { type: 'number', description: 'Y position in world coordinates' },
        x2: {
          type: 'number',
          description: 'Optional end X for line shapes. Use with y2.',
        },
        y2: {
          type: 'number',
          description: 'Optional end Y for line shapes. Use with x2.',
        },
        width: { type: 'number', description: 'Width of the shape' },
        height: { type: 'number', description: 'Height of the shape' },
        color: { type: 'string', description: 'Hex fill color' },
      },
      required: ['type', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'createFrame',
    description: 'Create a frame (grouping container) on the whiteboard',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title of the frame' },
        x: { type: 'number', description: 'X position in world coordinates' },
        y: { type: 'number', description: 'Y position in world coordinates' },
        width: { type: 'number', description: 'Width of the frame' },
        height: { type: 'number', description: 'Height of the frame' },
      },
      required: ['title', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'createConnector',
    description: 'Create a connector (arrow/line) between two objects',
    input_schema: {
      type: 'object' as const,
      properties: {
        fromId: { type: 'string', description: 'ID of the source object' },
        toId: { type: 'string', description: 'ID of the target object' },
        style: {
          type: 'string',
          enum: ['arrow', 'line', 'dashed'],
          description: 'Visual style of the connector',
        },
      },
      required: ['fromId', 'toId'],
    },
  },
  {
    name: 'moveObject',
    description: 'Move an existing object to a new position',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to move' },
        x: { type: 'number', description: 'New X position' },
        y: { type: 'number', description: 'New Y position' },
      },
      required: ['objectId', 'x', 'y'],
    },
  },
  {
    name: 'resizeObject',
    description: 'Resize an existing object',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to resize' },
        width: { type: 'number', description: 'New width' },
        height: { type: 'number', description: 'New height' },
      },
      required: ['objectId', 'width', 'height'],
    },
  },
  {
    name: 'updateText',
    description:
      'Update text for sticky/text objects, or update frame title text for frame objects.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to update' },
        newText: { type: 'string', description: 'New text content' },
      },
      required: ['objectId', 'newText'],
    },
  },
  {
    name: 'changeColor',
    description: 'Change the color of an existing object',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to recolor' },
        color: { type: 'string', description: 'New hex color (e.g. #4CAF50)' },
      },
      required: ['objectId', 'color'],
    },
  },
  {
    name: 'deleteObject',
    description: 'Delete an existing object from the whiteboard',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to delete' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'getBoardState',
    description:
      'Get the current state of all objects on the board. Use this to understand what exists before making changes.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

const openAIToolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = toolDefinitions.map(
  (tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema as OpenAI.FunctionParameters,
    },
  }),
);

const SYSTEM_PROMPT = `You are an AI whiteboard assistant for a collaborative whiteboard app. You help users create and manipulate objects on an infinite canvas.

You have access to tools to create sticky notes, shapes, frames, connectors, and to move, resize, recolor, and update text on existing objects.

Guidelines:
- Place objects at reasonable positions (avoid overlapping). Space items ~200px apart.
- Use pleasant colors. Default sticky note color: #FFEB3B (yellow). Other good colors: #81C784 (green), #64B5F6 (blue), #E57373 (red), #FFB74D (orange), #BA68C8 (purple).
- Standard sticky note size: 150x100. Standard shape size: 120x80.
- For line shapes, provide width + height or line endpoints (x2, y2).
- For templates (SWOT, Kanban, Retro), create frames first, then populate with sticky notes inside.
- When arranging in a grid, use consistent spacing (e.g. 200px horizontal, 150px vertical).
- Always use the getBoardState tool first if you need to reference or modify existing objects.
- Return a complete multi-step plan in a single response. Do not stop after one creation call for template requests.
- updateText is only valid for sticky/text objects and frame titles, not rect/circle/line/connector.
- Include stable objectId values for created objects so downstream updates can reference them.`;

const MAX_PROMPT_LENGTH = 500;
const MAX_BOARD_STATE_OBJECTS = 100;
const MAX_PLANNING_ATTEMPTS = 2;
const TOOL_BY_NAME = new Map(toolDefinitions.map((tool) => [tool.name, tool] as const));

interface BoardDocData {
  ownerId?: string;
  createdBy?: string;
  sharing?: {
    visibility?: string;
    authLinkRole?: string;
    publicLinkRole?: string;
  };
}

interface PlanGenerationInput {
  prompt: string;
  truncatedBoardState: unknown;
  boardId: string;
  actorUserId: string;
  provider: AIProvider;
  modelOverride: string | null;
}

interface PlanGenerationResult {
  toolCalls: OutgoingToolCall[];
  message: string | null;
  stopReason: string | null;
  provider: AIProvider;
  model: string;
}

function getFirebasePrivateKey(): string | null {
  const value = process.env.FIREBASE_PRIVATE_KEY;
  if (!value || typeof value !== 'string') {
    return null;
  }
  return value.replace(/\\n/g, '\n');
}

function ensureFirebaseAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured');
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function extractBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value || typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return null;
  }

  return match[1].trim() || null;
}

function ensureRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function extractToolCalls(message: Anthropic.Message): OutgoingToolCall[] {
  return message.content
    .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
    .map((toolUse) => ({
      id: toolUse.id,
      name: toolUse.name,
      input: ensureRecord(toolUse.input),
    }));
}

function extractTextMessage(message: Anthropic.Message): string | null {
  const textBlocks = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .filter((text) => text.trim().length > 0);

  return textBlocks.join('\n') || null;
}

function parseToolArgumentsJson(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  try {
    return ensureRecord(JSON.parse(raw));
  } catch {
    return {};
  }
}

function extractOpenAIToolCalls(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): OutgoingToolCall[] {
  const toolCalls = completion.choices?.[0]?.message?.tool_calls ?? [];
  return toolCalls
    .filter((toolCall) => toolCall.type === 'function' && typeof toolCall.function.name === 'string')
    .map((toolCall, index) => ({
      id: toolCall.id || `openai-tool-${index + 1}`,
      name: toolCall.function.name,
      input: parseToolArgumentsJson(toolCall.function.arguments),
    }));
}

function extractOpenAITextMessage(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): string | null {
  const content = completion.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('\n')
      .trim();

    return joined.length > 0 ? joined : null;
  }

  return null;
}

function extractOpenAIStopReason(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): string | null {
  return completion.choices?.[0]?.finish_reason ?? null;
}

function isValueMissing(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value);
  }
  return false;
}

function validateToolCalls(toolCalls: OutgoingToolCall[]): ToolValidationIssue[] {
  const issues: ToolValidationIssue[] = [];

  toolCalls.forEach((toolCall) => {
    const toolDefinition = TOOL_BY_NAME.get(toolCall.name);
    if (!toolDefinition) {
      issues.push({
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        reason: 'Unsupported tool name.',
      });
      return;
    }

    const requiredKeys =
      toolDefinition.input_schema &&
      typeof toolDefinition.input_schema === 'object' &&
      'required' in toolDefinition.input_schema &&
      Array.isArray(toolDefinition.input_schema.required)
        ? toolDefinition.input_schema.required
        : [];

    const missingRequiredKeys = requiredKeys.filter((key) => isValueMissing(toolCall.input[key]));
    if (missingRequiredKeys.length > 0) {
      issues.push({
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        reason: `Missing required input: ${missingRequiredKeys.join(', ')}`,
      });
    }
  });

  return issues;
}

function getPlanQualityScore(toolCalls: OutgoingToolCall[], issues: ToolValidationIssue[]): number {
  return issues.length * 100 - toolCalls.length;
}

function isLikelyComplexPlanPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (
    /\b(template|framework|analysis|matrix|quadrant|kanban|retro|diagram|workflow|roadmap|mind map)\b/i.test(
      lower,
    )
  ) {
    return true;
  }

  if (/\b(with|containing|include|includes)\b/.test(lower) && /\b(2|3|4|5|6|7|8|9|10)\b/.test(lower)) {
    return true;
  }

  return false;
}

function shouldRequestPlanExpansion(
  prompt: string,
  toolCalls: OutgoingToolCall[],
): boolean {
  if (!isLikelyComplexPlanPrompt(prompt)) {
    return false;
  }

  return toolCalls.length <= 1;
}

function buildInitialUserContent(prompt: string, truncatedBoardState: unknown): string {
  return truncatedBoardState
    ? `Current board objects: ${JSON.stringify(truncatedBoardState)}\n\nUser request: ${prompt}`
    : prompt;
}

function buildExpansionUserContent(
  prompt: string,
  initialToolCalls: OutgoingToolCall[],
  initialText: string | null,
  reasons: string[],
): string {
  return [
    `Original user request: ${prompt}`,
    `Previous assistant text: ${initialText || '(none)'}`,
    `Previous tool calls (${initialToolCalls.length}): ${JSON.stringify(initialToolCalls)}`,
    'Your previous tool plan needs correction.',
    ...reasons.map((reason) => `- ${reason}`),
    'Return a complete end-to-end tool plan now.',
    'Requirements:',
    '- Include all required structural objects for the request, not just the first object.',
    '- Provide all necessary create/update calls in one response.',
    '- Every tool call must include required inputs and valid values.',
    '- Use stable objectId values for created objects when possible.',
    '- Output tool calls only; avoid explanatory text unless absolutely necessary.',
  ].join('\n');
}

function getBoardObjectCount(boardState: unknown): number {
  if (boardState && typeof boardState === 'object' && !Array.isArray(boardState)) {
    return Object.keys(boardState as Record<string, unknown>).length;
  }
  return 0;
}

async function flushLangSmithTracesBestEffort() {
  if (!langSmithClient || !LANGSMITH_TRACING_ENABLED) {
    return;
  }

  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, TRACE_FLUSH_TIMEOUT_MS);
  });

  try {
    await Promise.race([langSmithClient.awaitPendingTraceBatches(), timeout]);
  } catch (err) {
    apiLogger.warn('AI', `LangSmith trace flush warning: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function createAnthropicPlanningMessage(
  payload: Anthropic.MessageCreateParamsNonStreaming,
  runName: string,
  metadata: Record<string, unknown>,
): Promise<Anthropic.Message> {
  if (!LANGSMITH_TRACING_ENABLED) {
    return anthropic.messages.create(payload);
  }

  return anthropic.messages.create(payload, {
    langsmithExtra: {
      name: runName,
      tags: LANGSMITH_TAGS,
      metadata,
    },
  } as Anthropic.RequestOptions);
}

async function createOpenAIPlanningMessage(
  payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  runName: string,
  metadata: Record<string, unknown>,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (!LANGSMITH_TRACING_ENABLED) {
    return openai.chat.completions.create(payload);
  }

  return openai.chat.completions.create(payload, {
    langsmithExtra: {
      name: runName,
      tags: LANGSMITH_TAGS,
      metadata,
    },
  } as OpenAI.RequestOptions);
}

async function generatePlanCore({
  prompt,
  truncatedBoardState,
  boardId,
  actorUserId,
  provider,
  modelOverride,
}: PlanGenerationInput): Promise<PlanGenerationResult> {
  const resolvedModel = modelOverride || (provider === 'openai' ? getOpenAIModelName() : getAnthropicModelName());
  const commonMetadata = {
    boardId,
    actorUserId,
    promptLength: prompt.length,
    boardObjectCount: getBoardObjectCount(truncatedBoardState),
    provider,
    model: resolvedModel,
    providerMode: getProviderMode(),
  };

  if (provider === 'openai') {
    const initialCompletion = await createOpenAIPlanningMessage(
      {
        model: resolvedModel,
        max_tokens: 4096,
        tools: openAIToolDefinitions,
        tool_choice: 'auto',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildInitialUserContent(prompt, truncatedBoardState),
          },
        ],
      },
      'ai.generate.initial-plan.openai',
      commonMetadata,
    );

    let finalCompletion = initialCompletion;
    let outgoingToolCalls = extractOpenAIToolCalls(initialCompletion);
    let assistantText = extractOpenAITextMessage(initialCompletion);
    let validationIssues = validateToolCalls(outgoingToolCalls);

    const expansionReasons: string[] = [];
    if (shouldRequestPlanExpansion(prompt, outgoingToolCalls)) {
      expansionReasons.push('The tool plan is likely under-scoped for a complex request.');
    }
    if (validationIssues.length > 0) {
      expansionReasons.push(
        `Tool calls have validation issues: ${validationIssues
          .map((issue) => `${issue.toolName} (${issue.reason})`)
          .join('; ')}`,
      );
    }

    if (MAX_PLANNING_ATTEMPTS > 1 && expansionReasons.length > 0) {
      const expandedCompletion = await createOpenAIPlanningMessage(
        {
          model: resolvedModel,
          max_tokens: 4096,
          tools: openAIToolDefinitions,
          tool_choice: 'auto',
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: buildExpansionUserContent(
                prompt,
                outgoingToolCalls,
                assistantText,
                expansionReasons,
              ),
            },
          ],
        },
        'ai.generate.expansion-plan.openai',
        {
          ...commonMetadata,
          previousToolCallCount: outgoingToolCalls.length,
          validationIssueCount: validationIssues.length,
        },
      );
      const expandedToolCalls = extractOpenAIToolCalls(expandedCompletion);
      const expandedIssues = validateToolCalls(expandedToolCalls);
      const initialScore = getPlanQualityScore(outgoingToolCalls, validationIssues);
      const expandedScore = getPlanQualityScore(expandedToolCalls, expandedIssues);

      if (expandedScore < initialScore) {
        finalCompletion = expandedCompletion;
        outgoingToolCalls = expandedToolCalls;
        assistantText = extractOpenAITextMessage(expandedCompletion);
        validationIssues = expandedIssues;
      }
    }

    return {
      toolCalls: outgoingToolCalls,
      message: assistantText,
      stopReason: extractOpenAIStopReason(finalCompletion),
      provider,
      model: resolvedModel,
    };
  }

  const initialMessage = await createAnthropicPlanningMessage(
    {
      model: resolvedModel,
      max_tokens: 4096,
      tools: toolDefinitions,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildInitialUserContent(prompt, truncatedBoardState),
        },
      ],
    },
    'ai.generate.initial-plan.anthropic',
    commonMetadata,
  );

  let finalMessage = initialMessage;
  let outgoingToolCalls = extractToolCalls(initialMessage);
  let assistantText = extractTextMessage(initialMessage);
  let validationIssues = validateToolCalls(outgoingToolCalls);

  const expansionReasons: string[] = [];
  if (shouldRequestPlanExpansion(prompt, outgoingToolCalls)) {
    expansionReasons.push('The tool plan is likely under-scoped for a complex request.');
  }
  if (validationIssues.length > 0) {
    expansionReasons.push(
      `Tool calls have validation issues: ${validationIssues
        .map((issue) => `${issue.toolName} (${issue.reason})`)
        .join('; ')}`,
    );
  }

  if (MAX_PLANNING_ATTEMPTS > 1 && expansionReasons.length > 0) {
    const expandedMessage = await createAnthropicPlanningMessage(
      {
        model: resolvedModel,
        max_tokens: 4096,
        tools: toolDefinitions,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildExpansionUserContent(
              prompt,
              outgoingToolCalls,
              assistantText,
              expansionReasons,
            ),
          },
        ],
      },
      'ai.generate.expansion-plan.anthropic',
      {
        ...commonMetadata,
        previousToolCallCount: outgoingToolCalls.length,
        validationIssueCount: validationIssues.length,
      },
    );
    const expandedToolCalls = extractToolCalls(expandedMessage);
    const expandedIssues = validateToolCalls(expandedToolCalls);
    const initialScore = getPlanQualityScore(outgoingToolCalls, validationIssues);
    const expandedScore = getPlanQualityScore(expandedToolCalls, expandedIssues);

    if (expandedScore < initialScore) {
      finalMessage = expandedMessage;
      outgoingToolCalls = expandedToolCalls;
      assistantText = extractTextMessage(expandedMessage);
      validationIssues = expandedIssues;
    }
  }

  return {
    toolCalls: outgoingToolCalls,
    message: assistantText,
    stopReason: finalMessage.stop_reason,
    provider,
    model: resolvedModel,
  };
}

const generatePlan = LANGSMITH_TRACING_ENABLED
  ? traceable(generatePlanCore, {
      name: 'ai.generate.pipeline',
      project_name: getLangSmithProjectName(),
      client: langSmithClient ?? undefined,
      run_type: 'chain',
      tags: LANGSMITH_TAGS,
      metadata: {
        route: '/api/ai/generate',
      },
      processInputs: (inputs) => ({
        boardId: typeof inputs.boardId === 'string' ? inputs.boardId : '',
        actorUserId: typeof inputs.actorUserId === 'string' ? inputs.actorUserId : '',
        provider: typeof inputs.provider === 'string' ? inputs.provider : '',
        modelOverride: typeof inputs.modelOverride === 'string' ? inputs.modelOverride : '',
        promptLength: typeof inputs.prompt === 'string' ? inputs.prompt.length : 0,
        promptPreview:
          typeof inputs.prompt === 'string' ? inputs.prompt.slice(0, Math.min(160, inputs.prompt.length)) : '',
        boardObjectCount: getBoardObjectCount(inputs.truncatedBoardState),
      }),
      processOutputs: (outputs) => ({
        toolCallCount: Array.isArray(outputs.toolCalls) ? outputs.toolCalls.length : 0,
        toolNames: Array.isArray(outputs.toolCalls)
          ? outputs.toolCalls.slice(0, 12).map((call) => call.name)
          : [],
        stopReason: outputs.stopReason,
        provider: outputs.provider,
        model: outputs.model,
        assistantMessageLength: typeof outputs.message === 'string' ? outputs.message.length : 0,
        assistantMessagePreview:
          typeof outputs.message === 'string'
            ? outputs.message.slice(0, Math.min(160, outputs.message.length))
            : '',
      }),
    })
  : generatePlanCore;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-AI-Provider, X-AI-Model');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, boardState, boardId, providerOverride, modelOverride } = req.body ?? {};

  if (!prompt || typeof prompt !== 'string') {
    apiLogger.warn('AI', 'Request rejected: missing or invalid prompt');
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  if (!boardId || typeof boardId !== 'string' || !boardId.trim()) {
    apiLogger.warn('AI', 'Request rejected: missing or invalid boardId');
    return res.status(400).json({ error: 'Missing or invalid boardId' });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    apiLogger.warn('AI', `Request rejected: prompt too long (${prompt.length}/${MAX_PROMPT_LENGTH})`, { promptLength: prompt.length });
    return res
      .status(400)
      .json({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` });
  }

  apiLogger.info('AI', `AI generate request received: '${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}'`, {
    boardId: boardId.trim(),
    promptLength: prompt.length,
    boardObjectCount: getBoardObjectCount(boardState),
  });

  const requestedProvider = providerOverride;
  const requestedModel = modelOverride;
  const hasRequestedOverride =
    (requestedProvider !== undefined && requestedProvider !== null) ||
    (requestedModel !== undefined && requestedModel !== null);

  if (hasRequestedOverride && !isExperimentOverridesEnabled()) {
    return res.status(403).json({
      error:
        'Model/provider overrides are disabled. Set AI_ALLOW_EXPERIMENT_OVERRIDES=true to enable benchmarking overrides.',
    });
  }

  if (requestedProvider !== undefined && requestedProvider !== null && !isAIProvider(requestedProvider)) {
    return res.status(400).json({ error: 'Invalid providerOverride. Must be anthropic or openai.' });
  }

  const sanitizedModelOverride = sanitizeModelName(requestedModel);
  if ((requestedModel !== undefined && requestedModel !== null) && !sanitizedModelOverride) {
    return res.status(400).json({ error: 'Invalid modelOverride format.' });
  }

  const trimmedBoardId = boardId.trim();
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  let actorUserId = '';
  try {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    actorUserId = decoded.uid;
    apiLogger.info('AUTH', `Auth token verified for user`, { userId: actorUserId, boardId: trimmedBoardId });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Firebase Admin is not configured')) {
      apiLogger.error('AUTH', 'Firebase Admin is not configured — cannot verify tokens');
      return res.status(500).json({ error: 'Auth service not configured' });
    }
    apiLogger.warn('AUTH', `Auth token verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { boardId: trimmedBoardId });
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }

  try {
    const firestore = getFirestore();
    const boardSnapshot = await firestore.collection('boards').doc(trimmedBoardId).get();
    if (!boardSnapshot.exists) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const boardData = (boardSnapshot.data() || {}) as BoardDocData;
    const membershipSnapshot = await firestore
      .collection('boardMembers')
      .doc(`${trimmedBoardId}_${actorUserId}`)
      .get();
    const memberRole = membershipSnapshot.exists
      ? normalizeBoardRole(membershipSnapshot.data()?.role)
      : null;

    const access = resolveBoardAccess({
      ownerId: boardData.ownerId || boardData.createdBy || null,
      userId: actorUserId,
      isAuthenticated: true,
      explicitMemberRole: memberRole,
      sharing: boardData.sharing ?? null,
    });

    if (!access.canApplyAI) {
      apiLogger.warn('AI', `Access denied: user does not have AI editor access`, { boardId: trimmedBoardId, userId: actorUserId, effectiveRole: access.effectiveRole });
      return res.status(403).json({ error: 'You do not have editor access for AI on this board.' });
    }

    apiLogger.info('AI', `Board access verified: role=${access.effectiveRole}`, { boardId: trimmedBoardId, userId: actorUserId, effectiveRole: access.effectiveRole });
  } catch (err) {
    apiLogger.error('AI', `Board access check failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { boardId: trimmedBoardId, userId: actorUserId });
    return res.status(500).json({ error: 'Unable to validate board access' });
  }

  // Truncate board state to avoid blowing up the context window
  let truncatedBoardState = boardState;
  if (boardState && typeof boardState === 'object') {
    const entries = Object.entries(boardState);
    if (entries.length > MAX_BOARD_STATE_OBJECTS) {
      apiLogger.warn('AI', `Board state truncated: ${entries.length} objects → ${MAX_BOARD_STATE_OBJECTS} (max)`, {
        boardId: trimmedBoardId,
        originalCount: entries.length,
        truncatedTo: MAX_BOARD_STATE_OBJECTS,
      });
      truncatedBoardState = Object.fromEntries(entries.slice(0, MAX_BOARD_STATE_OBJECTS));
    }
  }

  const provider = isAIProvider(requestedProvider)
    ? requestedProvider
    : chooseProviderForRequest(trimmedBoardId, actorUserId);
  res.setHeader('X-AI-Provider', provider);
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured for OpenAI provider' });
  }

  try {
    apiLogger.info('AI', `Generating AI plan via ${provider} (model: ${sanitizedModelOverride || 'default'})`, {
      boardId: trimmedBoardId,
      provider,
      modelOverride: sanitizedModelOverride,
      promptLength: prompt.length,
      boardObjectCount: getBoardObjectCount(truncatedBoardState),
    });

    const planStartMs = Date.now();
    const result = await generatePlan({
      prompt,
      truncatedBoardState,
      boardId: trimmedBoardId,
      actorUserId,
      provider,
      modelOverride: sanitizedModelOverride,
    });
    const planDurationMs = Date.now() - planStartMs;

    apiLogger.info('AI', `AI plan generated: ${result.toolCalls.length} tool call(s) via ${result.provider}/${result.model} in ${planDurationMs}ms`, {
      boardId: trimmedBoardId,
      toolCallCount: result.toolCalls.length,
      toolNames: result.toolCalls.slice(0, 10).map((tc) => tc.name),
      provider: result.provider,
      model: result.model,
      stopReason: result.stopReason,
      durationMs: planDurationMs,
    });

    res.setHeader('X-AI-Model', result.model);
    await flushLangSmithTracesBestEffort();

    return res.status(200).json({
      toolCalls: result.toolCalls,
      message: result.message,
      stopReason: result.stopReason,
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    const isRateLimit =
      err instanceof Error && 'status' in err && (err as { status: number }).status === 429;

    if (isRateLimit) {
      apiLogger.warn('AI', `Rate limit hit for AI request`, { boardId: trimmedBoardId, provider, userId: actorUserId });
      return res.status(429).json({ error: 'AI rate limit reached. Please try again shortly.' });
    }

    apiLogger.error('AI', `AI plan generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`, {
      boardId: trimmedBoardId,
      provider,
      userId: actorUserId,
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(500).json({ error: 'AI request failed' });
  }
}
