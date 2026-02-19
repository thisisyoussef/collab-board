import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_BASE_URL = 'https://collab-board-iota.vercel.app';
const DEFAULT_PROMPT_SUITE_PATH = 'scripts/ab-prompt-suite.json';
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_ROUNDS = 4;
const DEFAULT_DELAY_MS = 0;
const DEFAULT_AUTO_CREATE_BOARDS = 6;
const DEFAULT_MAX_REQUESTS = 0;
const DEFAULT_MODEL_MATRIX =
  'anthropic:claude-sonnet-4-20250514,anthropic:claude-3-5-haiku-latest,openai:gpt-4.1-mini,openai:gpt-4.1,openai:gpt-4o-mini';
const MODEL_NAME_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
const FALLBACK_PROMPT_SUITE: PromptEntry[] = [
  {
    id: 'create_sticky',
    category: 'creation',
    prompt: "Add a yellow sticky note that says 'User Research'.",
  },
  {
    id: 'create_shape',
    category: 'creation',
    prompt: 'Create a blue rectangle at position 100, 200.',
  },
  {
    id: 'change_color',
    category: 'manipulation',
    prompt: 'Change the sticky note color to green.',
  },
  {
    id: 'move_notes',
    category: 'manipulation',
    prompt: 'Move all pink sticky notes to the right side.',
  },
  {
    id: 'grid_arrange',
    category: 'layout',
    prompt: 'Arrange these sticky notes in a grid.',
  },
  {
    id: 'grid_generate',
    category: 'layout',
    prompt: 'Create a 2x3 grid of sticky notes for pros and cons.',
  },
  {
    id: 'swot_template',
    category: 'complex',
    prompt: 'Create a SWOT analysis template with four quadrants.',
  },
  {
    id: 'retro_template',
    category: 'complex',
    prompt:
      "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns.",
  },
];

interface PromptEntry {
  id: string;
  category: string;
  prompt: string;
}

interface MatrixEntry {
  provider: 'anthropic' | 'openai';
  model: string;
}

interface BenchmarkRequestItem {
  round: number;
  boardId: string;
  promptId: string;
  category: string;
  prompt: string;
  providerOverride: 'anthropic' | 'openai';
  modelOverride: string;
}

interface BenchmarkRow {
  success: boolean;
  status: number;
  latencyMs: number;
  boardId: string;
  round: number;
  promptId: string;
  category: string;
  provider: string | null;
  model: string | null;
  requestedProvider: 'anthropic' | 'openai';
  requestedModel: string;
  toolCallCount: number;
  accuracyScore: number;
  toolNames: string[];
  error: string | null;
}

interface AuthContext {
  token: string;
  userId: string;
  source: 'explicit-token' | 'service-account-custom-token';
}

interface ProviderModelStats {
  provider: string;
  model: string;
  requests: number;
  successes: number;
  failures: number;
  latencies: number[];
  toolCalls: number[];
  accuracies: number[];
}

interface PromptProviderModelStats {
  promptId: string;
  category: string;
  provider: string;
  model: string;
  requests: number;
  successes: number;
  failures: number;
  latencies: number[];
  toolCalls: number[];
  accuracies: number[];
}

export const config = {
  maxDuration: 300,
};

function parseInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseBoardIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((entry) => String(entry).trim()).filter(Boolean))];
  }
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function timestampSlug(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}Z`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (part / total) * 100;
}

function safeModelName(value: unknown): string {
  const model = String(value || '').trim();
  if (!model || !MODEL_NAME_PATTERN.test(model)) {
    throw new Error(`Invalid model name in matrix: "${String(value || '')}"`);
  }
  return model;
}

function parseModelMatrix(raw: unknown): MatrixEntry[] {
  const matrix = String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [providerRaw, ...modelRest] = entry.split(':');
      const provider = String(providerRaw || '').trim();
      if (provider !== 'anthropic' && provider !== 'openai') {
        throw new Error(`Invalid provider in matrix entry "${entry}".`);
      }
      const model = safeModelName(modelRest.join(':'));
      return { provider, model } as MatrixEntry;
    });

  if (matrix.length === 0) {
    throw new Error('Model matrix is empty.');
  }

  return matrix;
}

function getFirebasePrivateKey(): string | null {
  const value = process.env.FIREBASE_PRIVATE_KEY;
  if (!value || typeof value !== 'string') {
    return null;
  }
  return value.replace(/\\n/g, '\n');
}

function ensureFirebaseAdmin(): void {
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

async function resolveAuthToken(): Promise<AuthContext> {
  const explicitToken = process.env.AI_AUTH_TOKEN;
  if (explicitToken && explicitToken.trim().length > 0) {
    return {
      token: explicitToken.trim(),
      userId: process.env.BENCHMARK_USER_ID || 'unknown',
      source: 'explicit-token',
    };
  }

  ensureFirebaseAdmin();
  const webApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  const benchmarkUserId = process.env.BENCHMARK_USER_ID;
  if (!webApiKey || !benchmarkUserId) {
    throw new Error(
      'Missing auth credentials. Set AI_AUTH_TOKEN or FIREBASE_WEB_API_KEY + BENCHMARK_USER_ID + Firebase Admin service account env vars.',
    );
  }

  const customToken = await getAuth().createCustomToken(benchmarkUserId);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(
      webApiKey,
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    },
  );

  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  const idToken = typeof payload.idToken === 'string' ? payload.idToken : '';
  if (!response.ok || !idToken) {
    throw new Error(`Failed to mint benchmark ID token (status ${response.status})`);
  }

  return {
    token: idToken,
    userId: benchmarkUserId,
    source: 'service-account-custom-token',
  };
}

async function createBenchmarkBoards(
  autoCreateCount: number,
  boardPrefix: string,
  userId: string,
): Promise<string[]> {
  if (autoCreateCount <= 0) {
    return [];
  }

  ensureFirebaseAdmin();
  const firestore = getFirestore();
  const stamp = timestampSlug();
  const boardIds: string[] = [];

  for (let i = 0; i < autoCreateCount; i += 1) {
    const suffix = String(i + 1).padStart(2, '0');
    const boardId = `${boardPrefix}-${stamp}-${suffix}`;
    boardIds.push(boardId);

    await firestore.collection('boards').doc(boardId).set(
      {
        title: `AB Benchmark ${suffix}`,
        ownerId: userId,
        createdBy: userId,
        sharing: {
          visibility: 'private',
          authLinkRole: 'editor',
          publicLinkRole: 'viewer',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    await firestore
      .collection('boardMembers')
      .doc(`${boardId}_${userId}`)
      .set(
        {
          boardId,
          userId,
          role: 'owner',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
  }

  return boardIds;
}

async function loadPromptSuite(promptSuitePath: string): Promise<PromptEntry[]> {
  let parsed: unknown;
  try {
    const absolutePath = path.isAbsolute(promptSuitePath)
      ? promptSuitePath
      : path.resolve(process.cwd(), promptSuitePath);
    const raw = await fs.readFile(absolutePath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return FALLBACK_PROMPT_SUITE;
    }
    throw err;
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Prompt suite must be a JSON array.');
  }

  const prompts = parsed
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          id: `prompt_${index + 1}`,
          category: 'unspecified',
          prompt: entry.trim(),
        };
      }

      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const id =
        typeof entry.id === 'string' && entry.id.trim()
          ? entry.id.trim()
          : `prompt_${index + 1}`;
      const category =
        typeof entry.category === 'string' && entry.category.trim()
          ? entry.category.trim()
          : 'unspecified';
      const prompt = typeof entry.prompt === 'string' ? entry.prompt.trim() : '';

      if (!prompt) {
        return null;
      }

      return { id, category, prompt };
    })
    .filter((entry): entry is PromptEntry => Boolean(entry));

  if (prompts.length === 0) {
    throw new Error('Prompt suite is empty.');
  }

  return prompts;
}

function buildRequestMatrix(
  boardIds: string[],
  prompts: PromptEntry[],
  modelMatrix: MatrixEntry[],
  rounds: number,
  maxRequests: number,
): BenchmarkRequestItem[] {
  const requests: BenchmarkRequestItem[] = [];

  for (let round = 1; round <= rounds; round += 1) {
    boardIds.forEach((boardId) => {
      prompts.forEach((promptEntry) => {
        modelMatrix.forEach((modelEntry) => {
          requests.push({
            round,
            boardId,
            promptId: promptEntry.id,
            category: promptEntry.category,
            prompt: promptEntry.prompt,
            providerOverride: modelEntry.provider,
            modelOverride: modelEntry.model,
          });
        });
      });
    });
  }

  if (maxRequests > 0) {
    return requests.slice(0, maxRequests);
  }
  return requests;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    (async () => {
      while (true) {
        const currentIndex = index;
        index += 1;
        if (currentIndex >= items.length) {
          break;
        }
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

function summarizeResults(results: BenchmarkRow[]) {
  const byProvider: Record<
    string,
    {
      requests: number;
      successes: number;
      failures: number;
      latencies: number[];
      toolCalls: number[];
      accuracies: number[];
    }
  > = {};
  const byProviderModel: Record<string, ProviderModelStats> = {};
  const byPromptProviderModel: Record<string, PromptProviderModelStats> = {};
  const failures: Array<{
    round: number;
    boardId: string;
    promptId: string;
    provider: string | null;
    model: string | null;
    status: number;
    error: string | null;
  }> = [];

  results.forEach((row) => {
    const providerKey = row.provider || 'unknown';
    const modelKey = row.model || 'unknown';
    const providerModelKey = `${providerKey}:${modelKey}`;
    const promptProviderModelKey = `${row.promptId}:${providerKey}:${modelKey}`;

    if (!byProvider[providerKey]) {
      byProvider[providerKey] = {
        requests: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        toolCalls: [],
        accuracies: [],
      };
    }

    if (!byProviderModel[providerModelKey]) {
      byProviderModel[providerModelKey] = {
        provider: providerKey,
        model: modelKey,
        requests: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        toolCalls: [],
        accuracies: [],
      };
    }

    if (!byPromptProviderModel[promptProviderModelKey]) {
      byPromptProviderModel[promptProviderModelKey] = {
        promptId: row.promptId,
        category: row.category,
        provider: providerKey,
        model: modelKey,
        requests: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        toolCalls: [],
        accuracies: [],
      };
    }

    byProvider[providerKey].requests += 1;
    byProvider[providerKey].latencies.push(row.latencyMs);
    byProvider[providerKey].toolCalls.push(row.toolCallCount);
    byProvider[providerKey].accuracies.push(row.accuracyScore);

    byProviderModel[providerModelKey].requests += 1;
    byProviderModel[providerModelKey].latencies.push(row.latencyMs);
    byProviderModel[providerModelKey].toolCalls.push(row.toolCallCount);
    byProviderModel[providerModelKey].accuracies.push(row.accuracyScore);

    byPromptProviderModel[promptProviderModelKey].requests += 1;
    byPromptProviderModel[promptProviderModelKey].latencies.push(row.latencyMs);
    byPromptProviderModel[promptProviderModelKey].toolCalls.push(row.toolCallCount);
    byPromptProviderModel[promptProviderModelKey].accuracies.push(row.accuracyScore);

    if (row.success) {
      byProvider[providerKey].successes += 1;
      byProviderModel[providerModelKey].successes += 1;
      byPromptProviderModel[promptProviderModelKey].successes += 1;
    } else {
      byProvider[providerKey].failures += 1;
      byProviderModel[providerModelKey].failures += 1;
      byPromptProviderModel[promptProviderModelKey].failures += 1;
      failures.push({
        round: row.round,
        boardId: row.boardId,
        promptId: row.promptId,
        provider: row.provider,
        model: row.model,
        status: row.status,
        error: row.error,
      });
    }
  });

  const providers = Object.fromEntries(
    Object.entries(byProvider).map(([provider, stats]) => [
      provider,
      {
        requests: stats.requests,
        successes: stats.successes,
        failures: stats.failures,
        successRate: percent(stats.successes, stats.requests),
        avgLatencyMs: average(stats.latencies),
        avgToolCalls: average(stats.toolCalls),
        avgAccuracyScore: average(stats.accuracies),
      },
    ]),
  );

  const providerModels = Object.fromEntries(
    Object.entries(byProviderModel).map(([key, stats]) => [
      key,
      {
        provider: stats.provider,
        model: stats.model,
        requests: stats.requests,
        successes: stats.successes,
        failures: stats.failures,
        successRate: percent(stats.successes, stats.requests),
        avgLatencyMs: average(stats.latencies),
        avgToolCalls: average(stats.toolCalls),
        avgAccuracyScore: average(stats.accuracies),
      },
    ]),
  );

  const promptProviderModels = Object.fromEntries(
    Object.entries(byPromptProviderModel).map(([key, stats]) => [
      key,
      {
        promptId: stats.promptId,
        category: stats.category,
        provider: stats.provider,
        model: stats.model,
        requests: stats.requests,
        successes: stats.successes,
        failures: stats.failures,
        successRate: percent(stats.successes, stats.requests),
        avgLatencyMs: average(stats.latencies),
        avgToolCalls: average(stats.toolCalls),
        avgAccuracyScore: average(stats.accuracies),
      },
    ]),
  );

  const complexPromptProviderModels = Object.fromEntries(
    Object.entries(promptProviderModels).filter(([, stats]) => stats.category === 'complex'),
  );

  return {
    totalRequests: results.length,
    totalSuccesses: results.filter((row) => row.success).length,
    totalFailures: failures.length,
    providers,
    providerModels,
    promptProviderModels,
    complexPromptProviderModels,
    failures: failures.slice(0, 25),
  };
}

function getRequestSecret(req: VercelRequest): string {
  const headerSecret = req.headers['x-benchmark-secret'];
  if (typeof headerSecret === 'string' && headerSecret.trim().length > 0) {
    return headerSecret.trim();
  }

  const bodySecret = req.body?.secret;
  if (typeof bodySecret === 'string' && bodySecret.trim().length > 0) {
    return bodySecret.trim();
  }

  const querySecret = req.query.secret;
  if (typeof querySecret === 'string' && querySecret.trim().length > 0) {
    return querySecret.trim();
  }

  return '';
}

function getBaseUrl(req: VercelRequest, bodyBaseUrl?: string): string {
  if (typeof bodyBaseUrl === 'string' && bodyBaseUrl.trim()) {
    return bodyBaseUrl.trim().replace(/\/$/, '');
  }

  if (typeof process.env.AI_BASE_URL === 'string' && process.env.AI_BASE_URL.trim()) {
    return process.env.AI_BASE_URL.trim().replace(/\/$/, '');
  }

  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    typeof protoHeader === 'string' && protoHeader.trim()
      ? protoHeader.split(',')[0].trim()
      : 'https';
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  if (typeof hostHeader === 'string' && hostHeader.trim()) {
    return `${proto}://${hostHeader.trim()}`.replace(/\/$/, '');
  }

  return DEFAULT_BASE_URL;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiReady(baseApiUrl: string, timeoutMs: number, intervalMs: number): Promise<void> {
  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    try {
      const response = await fetch(baseApiUrl, { method: 'OPTIONS' });
      if (response.ok) {
        return;
      }
    } catch {
      // Best-effort polling until timeout.
    }
    await delay(intervalMs);
  }

  throw new Error(`Timed out waiting for API readiness at ${baseApiUrl}`);
}

interface NormalizedToolCall {
  name: string;
  input: Record<string, unknown>;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function extractToolCalls(payload: Record<string, unknown>): NormalizedToolCall[] {
  const raw = payload.toolCalls;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => toRecord(entry))
    .map((entry) => ({
      name: typeof entry.name === 'string' ? entry.name : '',
      input: toRecord(entry.input),
    }))
    .filter((entry) => entry.name.length > 0);
}

function hasNumericField(input: Record<string, unknown>, key: string): boolean {
  return typeof input[key] === 'number' && Number.isFinite(input[key] as number);
}

function scorePromptAccuracy(promptId: string, toolCalls: NormalizedToolCall[], success: boolean): number {
  if (!success) {
    return 0;
  }

  const byName = new Map<string, NormalizedToolCall[]>();
  toolCalls.forEach((call) => {
    const arr = byName.get(call.name) || [];
    arr.push(call);
    byName.set(call.name, arr);
  });

  const getCalls = (name: string) => byName.get(name) || [];
  const hasTool = (name: string) => getCalls(name).length > 0;
  const stickyCalls = getCalls('createStickyNote');
  const shapeCalls = getCalls('createShape');
  const frameCalls = getCalls('createFrame');
  const moveCalls = getCalls('moveObject');
  const colorCalls = getCalls('changeColor');
  const hasBoardStateCall = hasTool('getBoardState');

  let score = 0;
  switch (promptId) {
    case 'create_sticky': {
      score += hasTool('createStickyNote') ? 0.6 : 0;
      score += stickyCalls.some((call) =>
        String(call.input.text || '')
          .toLowerCase()
          .includes('user research'),
      )
        ? 0.2
        : 0;
      score += stickyCalls.some(
        (call) => hasNumericField(call.input, 'x') && hasNumericField(call.input, 'y'),
      )
        ? 0.2
        : 0;
      break;
    }
    case 'create_shape': {
      score += hasTool('createShape') ? 0.6 : 0;
      score += shapeCalls.some((call) => String(call.input.type || '') === 'rect') ? 0.2 : 0;
      score += shapeCalls.some(
        (call) => hasNumericField(call.input, 'x') && hasNumericField(call.input, 'y'),
      )
        ? 0.2
        : 0;
      break;
    }
    case 'change_color': {
      score += hasTool('changeColor') ? 0.7 : 0;
      score += colorCalls.some(
        (call) =>
          typeof call.input.objectId === 'string' &&
          String(call.input.objectId).trim().length > 0 &&
          typeof call.input.color === 'string' &&
          String(call.input.color).trim().length > 0,
      )
        ? 0.3
        : 0;
      break;
    }
    case 'move_notes': {
      score += hasTool('moveObject') ? 0.5 : 0;
      score += hasBoardStateCall ? 0.3 : 0;
      score += moveCalls.some(
        (call) => hasNumericField(call.input, 'x') && hasNumericField(call.input, 'y'),
      )
        ? 0.2
        : 0;
      break;
    }
    case 'grid_arrange': {
      score += hasTool('moveObject') ? 0.5 : 0;
      score += hasBoardStateCall ? 0.3 : 0;
      score += toolCalls.length >= 2 ? 0.2 : 0;
      break;
    }
    case 'grid_generate': {
      score += stickyCalls.length >= 4 ? 0.5 : 0;
      score += stickyCalls.length >= 6 ? 0.3 : 0;
      score += hasTool('createFrame') || hasTool('createShape') ? 0.2 : 0;
      break;
    }
    case 'swot_template': {
      score += frameCalls.length >= 1 ? 0.4 : 0;
      score += stickyCalls.length >= 4 || shapeCalls.length >= 4 ? 0.4 : 0;
      score += toolCalls.length >= 5 ? 0.2 : 0;
      break;
    }
    case 'retro_template': {
      score += frameCalls.length >= 1 ? 0.4 : 0;
      score += stickyCalls.length >= 3 ? 0.4 : 0;
      score += toolCalls.length >= 4 ? 0.2 : 0;
      break;
    }
    default: {
      score = 1;
      break;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Benchmark-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const runSecret = process.env.BENCHMARK_RUN_SECRET;
  if (!runSecret || !runSecret.trim()) {
    return res.status(500).json({
      error: 'BENCHMARK_RUN_SECRET is not configured',
    });
  }

  const providedSecret = getRequestSecret(req);
  if (providedSecret !== runSecret.trim()) {
    return res.status(401).json({ error: 'Unauthorized benchmark trigger' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const rounds = clamp(
      parseInteger(body.rounds ?? process.env.AB_ROUNDS, DEFAULT_ROUNDS),
      1,
      20,
    );
    const concurrency = clamp(
      parseInteger(body.concurrency ?? process.env.AB_CONCURRENCY, DEFAULT_CONCURRENCY),
      1,
      20,
    );
    const delayMs = clamp(
      parseInteger(body.delayMs ?? process.env.AB_DELAY_MS, DEFAULT_DELAY_MS),
      0,
      5000,
    );
    const timeoutMs = clamp(
      parseInteger(body.timeoutMs ?? process.env.AB_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      1000,
      120000,
    );
    const autoCreateBoards = clamp(
      parseInteger(
        body.autoCreateBoards ?? process.env.AB_AUTO_CREATE_BOARDS,
        DEFAULT_AUTO_CREATE_BOARDS,
      ),
      0,
      20,
    );
    const maxRequests = clamp(
      parseInteger(body.maxRequests ?? process.env.AB_MAX_REQUESTS, DEFAULT_MAX_REQUESTS),
      0,
      2000,
    );
    const waitReady = body.waitReady === true || process.env.AB_WAIT_READY === 'true';
    const readyTimeoutMs = clamp(
      parseInteger(body.readyTimeoutMs ?? process.env.AB_READY_TIMEOUT_MS, 600000),
      5000,
      1200000,
    );
    const readyIntervalMs = clamp(
      parseInteger(body.readyIntervalMs ?? process.env.AB_READY_INTERVAL_MS, 10000),
      1000,
      60000,
    );
    const boardPrefix =
      typeof body.boardPrefix === 'string' && body.boardPrefix.trim()
        ? body.boardPrefix.trim()
        : process.env.AB_BOARD_PREFIX || 'ab-bench';
    const promptSuitePath =
      typeof body.promptSuitePath === 'string' && body.promptSuitePath.trim()
        ? body.promptSuitePath.trim()
        : process.env.AB_PROMPT_SUITE || DEFAULT_PROMPT_SUITE_PATH;
    const matrix = parseModelMatrix(
      body.matrix ?? process.env.AB_MODEL_MATRIX ?? DEFAULT_MODEL_MATRIX,
    );
    const explicitBoardIds = parseBoardIds(body.boardIds ?? process.env.AB_BOARD_IDS);
    const baseUrl = getBaseUrl(req, body.baseUrl);

    const [promptEntries, auth] = await Promise.all([
      loadPromptSuite(promptSuitePath),
      resolveAuthToken(),
    ]);

    const createdBoardIds = await createBenchmarkBoards(
      autoCreateBoards,
      boardPrefix,
      auth.userId,
    );
    const boardIds = [...new Set([...explicitBoardIds, ...createdBoardIds])];
    if (boardIds.length === 0) {
      return res.status(400).json({
        error: 'No board IDs available. Provide boardIds or enable autoCreateBoards.',
      });
    }

    const requests = buildRequestMatrix(boardIds, promptEntries, matrix, rounds, maxRequests);
    const apiUrl = `${baseUrl}/api/ai/generate`;

    if (waitReady) {
      await waitForApiReady(apiUrl, readyTimeoutMs, readyIntervalMs);
    }

    const startedAt = Date.now();
    const results = await runWithConcurrency(requests, concurrency, async (item) => {
      if (delayMs > 0) {
        await delay(delayMs);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const requestStartedAt = Date.now();

      let status = 0;
      let provider: string | null = null;
      let model: string | null = null;
      let toolCallCount = 0;
      let toolNames: string[] = [];
      let error: string | null = null;
      let accuracyScore = 0;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            prompt: item.prompt,
            boardId: item.boardId,
            boardState: {},
            providerOverride: item.providerOverride,
            modelOverride: item.modelOverride,
          }),
          signal: controller.signal,
        });

        status = response.status;
        const payload = await response.json().catch(() => ({} as Record<string, unknown>));
        const parsedToolCalls = extractToolCalls(payload);
        provider =
          response.headers.get('x-ai-provider') ||
          (typeof payload.provider === 'string' ? payload.provider : null);
        model =
          response.headers.get('x-ai-model') ||
          (typeof payload.model === 'string' ? payload.model : null);
        toolCallCount = parsedToolCalls.length;
        toolNames = parsedToolCalls.map((call) => call.name).slice(0, 12);
        accuracyScore = scorePromptAccuracy(
          item.promptId,
          parsedToolCalls,
          response.ok,
        );

        if (!response.ok) {
          error = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timeout);
      }

      const latencyMs = Date.now() - requestStartedAt;
      return {
        success: status >= 200 && status < 300 && !error,
        status,
        latencyMs,
        boardId: item.boardId,
        round: item.round,
        promptId: item.promptId,
        category: item.category,
        provider,
        model,
        requestedProvider: item.providerOverride,
        requestedModel: item.modelOverride,
        toolCallCount,
        accuracyScore,
        toolNames,
        error,
      };
    });

    const summary = summarizeResults(results);
    const durationMs = Date.now() - startedAt;

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      config: {
        baseUrl,
        requestCount: requests.length,
        promptCount: promptEntries.length,
        boardCount: boardIds.length,
        autoCreatedBoardCount: createdBoardIds.length,
        modelMatrix: matrix,
        rounds,
        concurrency,
        delayMs,
        timeoutMs,
        maxRequests,
        authSource: auth.source,
        durationMs,
      },
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown benchmark failure';
    console.error('[ai/benchmark] Error:', err);
    return res.status(500).json({ error: message });
  }
}
