#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BASE_URL = 'https://collab-board-iota.vercel.app';
const DEFAULT_PROMPTS_FILE = path.join(__dirname, 'ab-prompt-suite.json');
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'docs/submission/ab-results');
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_DELAY_MS = 50;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_ROUNDS = 2;
const DEFAULT_WAIT_READY = false;
const DEFAULT_READY_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_READY_INTERVAL_MS = 10000;
const DEFAULT_MODEL_MATRIX =
  'anthropic:claude-sonnet-4-20250514,openai:gpt-4.1-mini,openai:gpt-4.1';
const MAX_PROMPT_PREVIEW = 100;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, 'true');
      continue;
    }

    args.set(key, next);
    i += 1;
  }
  return args;
}

function toInt(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value == null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseBoardIds(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percent(part, total) {
  if (total === 0) {
    return 0;
  }
  return (part / total) * 100;
}

function timestampSlug(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}Z`;
}

function safeModelName(value) {
  const model = String(value || '').trim();
  if (!model || !/^[a-zA-Z0-9._:-]{1,128}$/.test(model)) {
    throw new Error(`Invalid model name in matrix: "${value}"`);
  }
  return model;
}

function parseModelMatrix(raw) {
  const matrix = String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [providerRaw, ...rest] = entry.split(':');
      const provider = String(providerRaw || '').trim();
      const model = safeModelName(rest.join(':'));
      if (provider !== 'anthropic' && provider !== 'openai') {
        throw new Error(`Invalid provider in matrix entry "${entry}". Use anthropic or openai.`);
      }

      return {
        provider,
        model,
        key: `${provider}:${model}`,
      };
    });

  if (matrix.length === 0) {
    throw new Error('Model matrix is empty.');
  }

  return matrix;
}

async function loadPromptSuite(promptSuitePath) {
  const raw = await fs.readFile(promptSuitePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Prompt suite must be a JSON array.');
  }

  const prompts = parsed.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `prompt_${index + 1}`,
        category: 'unspecified',
        prompt: item,
      };
    }

    if (!item || typeof item !== 'object') {
      throw new Error(`Prompt entry at index ${index} is invalid.`);
    }

    const id =
      typeof item.id === 'string' && item.id.trim().length > 0
        ? item.id.trim()
        : `prompt_${index + 1}`;
    const category =
      typeof item.category === 'string' && item.category.trim().length > 0
        ? item.category.trim()
        : 'unspecified';
    const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';

    if (!prompt) {
      throw new Error(`Prompt entry at index ${index} is missing a non-empty "prompt" value.`);
    }

    return { id, category, prompt };
  });

  return prompts;
}

function getFirebasePrivateKeyFromEnv() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  return raw.replace(/\\n/g, '\n');
}

async function getFirebaseAdminClientsOrNull() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKeyFromEnv();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  const appModule = await import('firebase-admin/app');
  const authModule = await import('firebase-admin/auth');
  const firestoreModule = await import('firebase-admin/firestore');

  if (appModule.getApps().length === 0) {
    appModule.initializeApp({
      credential: appModule.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return {
    auth: authModule.getAuth(),
    firestore: firestoreModule.getFirestore(),
  };
}

async function resolveAuthToken(explicitToken) {
  if (explicitToken) {
    return {
      token: explicitToken,
      userId: process.env.BENCHMARK_USER_ID || 'unknown',
      source: 'explicit-token',
    };
  }

  const clients = await getFirebaseAdminClientsOrNull();
  const webApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  const benchmarkUserId = process.env.BENCHMARK_USER_ID;

  if (!clients || !webApiKey || !benchmarkUserId) {
    throw new Error(
      'Missing auth credentials. Provide --token / AI_AUTH_TOKEN, or set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_WEB_API_KEY/BENCHMARK_USER_ID.',
    );
  }

  const customToken = await clients.auth.createCustomToken(benchmarkUserId);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(
      webApiKey,
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.idToken !== 'string' || !payload.idToken) {
    throw new Error(
      `Unable to mint benchmark ID token via Firebase Identity Toolkit (status ${response.status}).`,
    );
  }

  return {
    token: payload.idToken,
    userId: benchmarkUserId,
    source: 'service-account-custom-token',
  };
}

async function createBenchmarkBoards({ autoCreateCount, boardPrefix, userId }) {
  if (autoCreateCount <= 0) {
    return [];
  }

  const clients = await getFirebaseAdminClientsOrNull();
  if (!clients) {
    throw new Error('Auto-create boards requested but Firebase Admin credentials are not configured.');
  }

  const firestore = clients.firestore;
  const stamp = timestampSlug();
  const boardIds = [];

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

function buildRequestMatrix({ boardIds, prompts, modelMatrix, rounds, maxRequests }) {
  const requests = [];

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
            matrixKey: modelEntry.key,
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

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    (async () => {
      while (true) {
        const current = index;
        index += 1;
        if (current >= items.length) {
          break;
        }
        results[current] = await worker(items[current], current);
      }
    })(),
  );

  await Promise.all(workers);
  return results;
}

function summarizeResults(results) {
  const byProvider = {};
  const byProviderModel = {};
  const byPromptProviderModel = new Map();
  const failures = [];

  results.forEach((row) => {
    const providerKey = row.provider || 'unknown';
    const modelKey = row.model || 'unknown';
    const providerModelKey = `${providerKey}:${modelKey}`;

    if (!byProvider[providerKey]) {
      byProvider[providerKey] = {
        requests: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        toolCalls: [],
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
      };
    }

    byProvider[providerKey].requests += 1;
    byProvider[providerKey].latencies.push(row.latencyMs);
    byProvider[providerKey].toolCalls.push(row.toolCallCount);

    byProviderModel[providerModelKey].requests += 1;
    byProviderModel[providerModelKey].latencies.push(row.latencyMs);
    byProviderModel[providerModelKey].toolCalls.push(row.toolCallCount);

    if (row.success) {
      byProvider[providerKey].successes += 1;
      byProviderModel[providerModelKey].successes += 1;
    } else {
      byProvider[providerKey].failures += 1;
      byProviderModel[providerModelKey].failures += 1;
      failures.push({
        boardId: row.boardId,
        round: row.round,
        promptId: row.promptId,
        provider: row.provider,
        model: row.model,
        status: row.status,
        error: row.error,
      });
    }

    const promptKey = `${row.promptId}::${providerKey}::${modelKey}`;
    if (!byPromptProviderModel.has(promptKey)) {
      byPromptProviderModel.set(promptKey, {
        promptId: row.promptId,
        category: row.category,
        provider: providerKey,
        model: modelKey,
        requests: 0,
        successes: 0,
        latencies: [],
        toolCalls: [],
      });
    }

    const entry = byPromptProviderModel.get(promptKey);
    entry.requests += 1;
    entry.latencies.push(row.latencyMs);
    entry.toolCalls.push(row.toolCallCount);
    if (row.success) {
      entry.successes += 1;
    }
  });

  const providerSummary = Object.fromEntries(
    Object.entries(byProvider).map(([provider, stats]) => [
      provider,
      {
        requests: stats.requests,
        successes: stats.successes,
        failures: stats.failures,
        successRate: percent(stats.successes, stats.requests),
        avgLatencyMs: average(stats.latencies),
        avgToolCalls: average(stats.toolCalls),
      },
    ]),
  );

  const providerModelSummary = Object.fromEntries(
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
      },
    ]),
  );

  const promptProviderModelStats = Array.from(byPromptProviderModel.values()).map((row) => ({
    promptId: row.promptId,
    category: row.category,
    provider: row.provider,
    model: row.model,
    requests: row.requests,
    successRate: percent(row.successes, row.requests),
    avgLatencyMs: average(row.latencies),
    avgToolCalls: average(row.toolCalls),
  }));

  return {
    totalRequests: results.length,
    totalSuccesses: results.filter((row) => row.success).length,
    totalFailures: failures.length,
    providers: providerSummary,
    providerModels: providerModelSummary,
    promptProviderModelStats,
    failures,
  };
}

function formatMarkdownReport(report) {
  const lines = [];
  lines.push('# AI Provider/Model Benchmark Report');
  lines.push('');
  lines.push(`- Generated at (UTC): ${report.generatedAt}`);
  lines.push(`- Base URL: ${report.config.baseUrl}`);
  lines.push(`- Auth source: ${report.config.authSource}`);
  lines.push(`- User ID: ${report.config.userId}`);
  lines.push(`- Board IDs tested: ${report.config.boardIds.length}`);
  lines.push(`- Auto-created boards: ${report.config.autoCreatedBoardCount}`);
  lines.push(`- Prompt count: ${report.config.promptCount}`);
  lines.push(`- Model matrix size: ${report.config.modelMatrix.length}`);
  lines.push(`- Rounds: ${report.config.rounds}`);
  lines.push(`- Total requests: ${report.summary.totalRequests}`);
  lines.push('');

  lines.push('## Provider Summary');
  lines.push('');
  lines.push('| Provider | Requests | Success | Failure | Avg Latency (ms) | Avg Tool Calls |');
  lines.push('|---|---:|---:|---:|---:|---:|');

  Object.entries(report.summary.providers)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([provider, stats]) => {
      lines.push(
        `| ${provider} | ${stats.requests} | ${stats.successes} | ${stats.failures} | ${stats.avgLatencyMs.toFixed(1)} | ${stats.avgToolCalls.toFixed(2)} |`,
      );
    });

  lines.push('');
  lines.push('## Provider + Model Summary');
  lines.push('');
  lines.push('| Provider | Model | Requests | Success % | Avg Latency (ms) | Avg Tool Calls |');
  lines.push('|---|---|---:|---:|---:|---:|');

  Object.values(report.summary.providerModels)
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
    .forEach((row) => {
      lines.push(
        `| ${row.provider} | ${row.model} | ${row.requests} | ${row.successRate.toFixed(1)} | ${row.avgLatencyMs.toFixed(1)} | ${row.avgToolCalls.toFixed(2)} |`,
      );
    });

  lines.push('');
  lines.push('## Prompt-Level Provider/Model Performance');
  lines.push('');
  lines.push('| Prompt ID | Category | Provider | Model | Requests | Success % | Avg Latency (ms) | Avg Tool Calls |');
  lines.push('|---|---|---|---|---:|---:|---:|---:|');

  report.summary.promptProviderModelStats
    .sort(
      (a, b) =>
        a.promptId.localeCompare(b.promptId) ||
        a.provider.localeCompare(b.provider) ||
        a.model.localeCompare(b.model),
    )
    .forEach((row) => {
      lines.push(
        `| ${row.promptId} | ${row.category} | ${row.provider} | ${row.model} | ${row.requests} | ${row.successRate.toFixed(1)} | ${row.avgLatencyMs.toFixed(1)} | ${row.avgToolCalls.toFixed(2)} |`,
      );
    });

  lines.push('');
  lines.push('## Failures');
  lines.push('');
  if (report.summary.failures.length === 0) {
    lines.push('No failed requests recorded.');
  } else {
    lines.push('| Round | Board ID | Prompt ID | Provider | Model | Status | Error |');
    lines.push('|---:|---|---|---|---|---:|---|');
    report.summary.failures.forEach((failure) => {
      lines.push(
        `| ${failure.round} | ${failure.boardId} | ${failure.promptId} | ${failure.provider || 'unknown'} | ${failure.model || 'unknown'} | ${failure.status} | ${String(failure.error || '').replaceAll('|', '\\|')} |`,
      );
    });
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function waitForApiReady({ baseApiUrl, timeoutMs, intervalMs }) {
  const started = Date.now();
  let attempts = 0;
  let lastStatus = 'n/a';
  let lastError = '';

  while (Date.now() - started <= timeoutMs) {
    attempts += 1;
    try {
      const response = await fetch(baseApiUrl, { method: 'OPTIONS' });
      lastStatus = String(response.status);
      if (response.ok) {
        console.log(
          `[ab-suite] deployment ready after ${attempts} probe(s) (${Date.now() - started}ms)`,
        );
        return;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    await sleep(intervalMs);
  }

  const details = lastError ? `${lastStatus} (${lastError})` : lastStatus;
  throw new Error(
    `Timed out waiting for deployed API readiness at ${baseApiUrl} after ${timeoutMs}ms. Last probe: ${details}`,
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.has('help')) {
    console.log(`Usage:\n  node scripts/run-ai-ab-suite.mjs \\
    [--token <firebase_id_token>] \\
    [--board-ids <id1,id2,id3>] \\
    [--auto-create-boards <count>] \\
    [--board-prefix ab-bench] \\
    [--rounds 2] \\
    [--matrix anthropic:claude-sonnet-4-20250514,openai:gpt-4.1-mini] \\
    [--concurrency 4] \\
    [--wait-ready] \\
    [--ready-timeout-ms 600000] \\
    [--ready-interval-ms 10000] \\
    [--base-url https://collab-board-iota.vercel.app] \\
    [--prompt-suite scripts/ab-prompt-suite.json] \\
    [--output-dir docs/submission/ab-results] \\
    [--timeout-ms 45000] \\
    [--delay-ms 50] \\
    [--max-requests 0]\n\nEnv fallback:\n  AI_AUTH_TOKEN, AI_BASE_URL, AB_BOARD_IDS, AB_AUTO_CREATE_BOARDS, AB_BOARD_PREFIX, AB_ROUNDS, AB_MODEL_MATRIX, AB_CONCURRENCY, AB_PROMPT_SUITE, AB_OUTPUT_DIR, AB_TIMEOUT_MS, AB_DELAY_MS, AB_MAX_REQUESTS, AB_WAIT_READY, AB_READY_TIMEOUT_MS, AB_READY_INTERVAL_MS, FIREBASE_* and BENCHMARK_USER_ID\n`);
    process.exit(0);
  }

  const baseUrl = args.get('base-url') || process.env.AI_BASE_URL || DEFAULT_BASE_URL;
  const tokenArg = args.get('token') || process.env.AI_AUTH_TOKEN || '';
  const boardIdsRaw = args.get('board-ids') || process.env.AB_BOARD_IDS || '';
  const autoCreateBoards = Math.max(
    0,
    toInt(args.get('auto-create-boards') || process.env.AB_AUTO_CREATE_BOARDS, 0),
  );
  const boardPrefix = args.get('board-prefix') || process.env.AB_BOARD_PREFIX || 'ab-bench';
  const rounds = Math.max(1, toInt(args.get('rounds') || process.env.AB_ROUNDS, DEFAULT_ROUNDS));
  const matrixRaw = args.get('matrix') || process.env.AB_MODEL_MATRIX || DEFAULT_MODEL_MATRIX;
  const concurrency = Math.max(
    1,
    toInt(args.get('concurrency') || process.env.AB_CONCURRENCY, DEFAULT_CONCURRENCY),
  );
  const promptSuitePath = args.get('prompt-suite') || process.env.AB_PROMPT_SUITE || DEFAULT_PROMPTS_FILE;
  const outputDir = args.get('output-dir') || process.env.AB_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const timeoutMs = Math.max(1000, toInt(args.get('timeout-ms') || process.env.AB_TIMEOUT_MS, DEFAULT_TIMEOUT_MS));
  const delayMs = Math.max(0, toInt(args.get('delay-ms') || process.env.AB_DELAY_MS, DEFAULT_DELAY_MS));
  const maxRequests = Math.max(0, toInt(args.get('max-requests') || process.env.AB_MAX_REQUESTS, 0));
  const waitReady = toBool(args.get('wait-ready') || process.env.AB_WAIT_READY, DEFAULT_WAIT_READY);
  const readyTimeoutMs = Math.max(
    5000,
    toInt(args.get('ready-timeout-ms') || process.env.AB_READY_TIMEOUT_MS, DEFAULT_READY_TIMEOUT_MS),
  );
  const readyIntervalMs = Math.max(
    1000,
    toInt(
      args.get('ready-interval-ms') || process.env.AB_READY_INTERVAL_MS,
      DEFAULT_READY_INTERVAL_MS,
    ),
  );

  const promptEntries = await loadPromptSuite(path.resolve(promptSuitePath));
  const modelMatrix = parseModelMatrix(matrixRaw);
  const auth = await resolveAuthToken(tokenArg);

  const explicitBoardIds = parseBoardIds(boardIdsRaw);
  const createdBoardIds = await createBenchmarkBoards({
    autoCreateCount: autoCreateBoards,
    boardPrefix,
    userId: auth.userId,
  });
  const boardIds = uniqueStrings([...explicitBoardIds, ...createdBoardIds]);

  if (boardIds.length === 0) {
    throw new Error('No board IDs available. Provide --board-ids or use --auto-create-boards.');
  }

  const matrixRequests = buildRequestMatrix({
    boardIds,
    prompts: promptEntries,
    modelMatrix,
    rounds,
    maxRequests,
  });

  console.log(
    `[ab-suite] starting ${matrixRequests.length} requests on ${boardIds.length} boards with ${promptEntries.length} prompts, ${modelMatrix.length} provider/model configs, rounds=${rounds}, concurrency=${concurrency}`,
  );
  console.log(`[ab-suite] auth source=${auth.source} user=${auth.userId} baseUrl=${baseUrl}`);

  const startedAt = new Date();
  const baseApiUrl = `${baseUrl.replace(/\/$/, '')}/api/ai/generate`;

  if (waitReady) {
    console.log(
      `[ab-suite] waiting for deployment readiness at ${baseApiUrl} (timeout=${readyTimeoutMs}ms interval=${readyIntervalMs}ms)`,
    );
    await waitForApiReady({
      baseApiUrl,
      timeoutMs: readyTimeoutMs,
      intervalMs: readyIntervalMs,
    });
  }

  const results = await runWithConcurrency(matrixRequests, concurrency, async (request, index) => {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();

    let status = 0;
    let provider = null;
    let model = null;
    let stopReason = null;
    let toolCallCount = 0;
    let messageLength = 0;
    let error = null;

    try {
      const response = await fetch(baseApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          boardId: request.boardId,
          boardState: {},
          providerOverride: request.providerOverride,
          modelOverride: request.modelOverride,
        }),
        signal: controller.signal,
      });

      status = response.status;
      const payload = await response.json().catch(() => ({}));
      provider = response.headers.get('x-ai-provider') || payload.provider || null;
      model = response.headers.get('x-ai-model') || payload.model || null;
      stopReason = typeof payload.stopReason === 'string' ? payload.stopReason : null;
      toolCallCount = Array.isArray(payload.toolCalls) ? payload.toolCalls.length : 0;
      messageLength = typeof payload.message === 'string' ? payload.message.length : 0;

      if (!response.ok) {
        error = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - started;
    const success = status >= 200 && status < 300 && !error;

    const row = {
      index: index + 1,
      round: request.round,
      boardId: request.boardId,
      promptId: request.promptId,
      category: request.category,
      prompt: request.prompt,
      promptPreview: request.prompt.slice(0, MAX_PROMPT_PREVIEW),
      requestedProvider: request.providerOverride,
      requestedModel: request.modelOverride,
      provider,
      model,
      success,
      status,
      latencyMs,
      toolCallCount,
      stopReason,
      messageLength,
      error,
      timestamp: new Date().toISOString(),
    };

    const label = success ? 'OK' : 'ERR';
    console.log(
      `[ab-suite] ${String(row.index).padStart(4, '0')}/${String(matrixRequests.length).padStart(4, '0')} ${label} board=${row.boardId} round=${row.round} prompt=${row.promptId} requested=${row.requestedProvider}:${row.requestedModel} actual=${row.provider || 'unknown'}:${row.model || 'unknown'} status=${row.status} latency=${row.latencyMs}ms tools=${row.toolCallCount}${row.error ? ` error=\"${row.error}\"` : ''}`,
    );

    return row;
  });

  const summary = summarizeResults(results);
  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl,
      authSource: auth.source,
      userId: auth.userId,
      boardIds,
      autoCreatedBoardCount: createdBoardIds.length,
      promptSuitePath: path.resolve(promptSuitePath),
      promptCount: promptEntries.length,
      modelMatrix,
      rounds,
      concurrency,
      timeoutMs,
      delayMs,
      maxRequests,
      waitReady,
      readyTimeoutMs,
      readyIntervalMs,
      requestCount: results.length,
    },
    summary,
    results,
  };

  await fs.mkdir(outputDir, { recursive: true });
  const slug = timestampSlug(startedAt);
  const jsonPath = path.join(outputDir, `ab-report-${slug}.json`);
  const mdPath = path.join(outputDir, `ab-report-${slug}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, formatMarkdownReport(report), 'utf8');

  console.log('');
  console.log(`[ab-suite] complete JSON: ${jsonPath}`);
  console.log(`[ab-suite] complete markdown: ${mdPath}`);
  console.log(
    `[ab-suite] success=${summary.totalSuccesses}/${summary.totalRequests} failures=${summary.totalFailures}`,
  );

  if (summary.totalFailures > 0) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`[ab-suite] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
