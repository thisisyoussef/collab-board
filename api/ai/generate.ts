import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeBoardRole, resolveBoardAccess } from '../../src/lib/access.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const { prompt, boardState, boardId } = req.body ?? {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  if (!boardId || typeof boardId !== 'string' || !boardId.trim()) {
    return res.status(400).json({ error: 'Missing or invalid boardId' });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` });
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
  } catch (err) {
    if (err instanceof Error && err.message.includes('Firebase Admin is not configured')) {
      return res.status(500).json({ error: 'Auth service not configured' });
    }
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
      return res.status(403).json({ error: 'You do not have editor access for AI on this board.' });
    }
  } catch (err) {
    console.error('[ai/generate] Access check failed:', err);
    return res.status(500).json({ error: 'Unable to validate board access' });
  }

  // Truncate board state to avoid blowing up the context window
  let truncatedBoardState = boardState;
  if (boardState && typeof boardState === 'object') {
    const entries = Object.entries(boardState);
    if (entries.length > MAX_BOARD_STATE_OBJECTS) {
      truncatedBoardState = Object.fromEntries(entries.slice(0, MAX_BOARD_STATE_OBJECTS));
    }
  }

  try {
    const initialMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: toolDefinitions,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildInitialUserContent(prompt, truncatedBoardState),
        },
      ],
    });

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
      const expandedMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
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
      });
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

    return res.status(200).json({
      toolCalls: outgoingToolCalls,
      message: assistantText,
      stopReason: finalMessage.stop_reason,
    });
  } catch (err) {
    console.error('[ai/generate] Error:', err);

    const isRateLimit =
      err instanceof Error && 'status' in err && (err as { status: number }).status === 429;

    if (isRateLimit) {
      return res.status(429).json({ error: 'AI rate limit reached. Please try again shortly.' });
    }

    return res.status(500).json({ error: 'AI request failed' });
  }
}
