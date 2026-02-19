#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BASE_URL = 'https://collab-board-iota.vercel.app';
const DEFAULT_PROMPTS_FILE = path.join(__dirname, 'ab-prompt-suite.json');
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'docs/submission/ab-results');
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_DELAY_MS = 150;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith('--')) {
      continue;
    }

    const key = value.slice(2);
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
  if (value == null) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoardIds(raw) {
  return String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percent(part, total) {
  if (total === 0) {
    return 0;
  }
  return (part / total) * 100;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTimestampSlug(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}Z`;
}

async function loadPromptSuite(promptSuitePath) {
  const raw = await fs.readFile(promptSuitePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Prompt suite must be a JSON array.');
  }

  const normalized = parsed.map((item, index) => {
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

    const entry = item;
    const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `prompt_${index + 1}`;
    const category =
      typeof entry.category === 'string' && entry.category.trim() ? entry.category.trim() : 'unspecified';
    const prompt = typeof entry.prompt === 'string' ? entry.prompt.trim() : '';

    if (!prompt) {
      throw new Error(`Prompt entry at index ${index} is missing a non-empty "prompt" value.`);
    }

    return {
      id,
      category,
      prompt,
    };
  });

  return normalized;
}

function formatMarkdownReport(report) {
  const lines = [];
  lines.push('# AI Provider A/B Report');
  lines.push('');
  lines.push(`- Generated at (UTC): ${report.generatedAt}`);
  lines.push(`- Base URL: ${report.config.baseUrl}`);
  lines.push(`- Provider mode (expected): ${report.config.providerMode}`);
  lines.push(`- OpenAI split % (expected): ${report.config.openAiPercent}`);
  lines.push(`- Board IDs tested: ${report.config.boardIds.length}`);
  lines.push(`- Prompt count: ${report.config.promptCount}`);
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
  lines.push('## Prompt-Level Success');
  lines.push('');
  lines.push('| Prompt ID | Category | Provider | Requests | Success % | Avg Latency (ms) | Avg Tool Calls |');
  lines.push('|---|---|---|---:|---:|---:|---:|');

  report.summary.promptProviderStats
    .sort((a, b) => a.promptId.localeCompare(b.promptId) || a.provider.localeCompare(b.provider))
    .forEach((row) => {
      lines.push(
        `| ${row.promptId} | ${row.category} | ${row.provider} | ${row.requests} | ${row.successRate.toFixed(1)} | ${row.avgLatencyMs.toFixed(1)} | ${row.avgToolCalls.toFixed(2)} |`,
      );
    });

  lines.push('');
  lines.push('## Failures');
  lines.push('');
  if (report.summary.failures.length === 0) {
    lines.push('No failed requests recorded.');
  } else {
    lines.push('| Board ID | Prompt ID | Provider | Status | Error |');
    lines.push('|---|---|---|---:|---|');
    report.summary.failures.forEach((failure) => {
      lines.push(
        `| ${failure.boardId} | ${failure.promptId} | ${failure.provider || 'unknown'} | ${failure.status} | ${String(
          failure.error || '',
        ).replaceAll('|', '\\|')} |`,
      );
    });
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.has('help')) {
    console.log(`Usage:\n  node scripts/run-ai-ab-suite.mjs \\
    --token <firebase_id_token> \\
    --board-ids <id1,id2,id3> \\
    [--base-url https://collab-board-iota.vercel.app] \\
    [--prompt-suite scripts/ab-prompt-suite.json] \\
    [--output-dir docs/submission/ab-results] \\
    [--timeout-ms 30000] \\
    [--delay-ms 150] \\
    [--max-requests 0]\n\nEnv fallback:\n  AI_AUTH_TOKEN, AB_BOARD_IDS, AI_BASE_URL, AB_PROMPT_SUITE, AB_OUTPUT_DIR, AB_TIMEOUT_MS, AB_DELAY_MS, AB_MAX_REQUESTS\n`);
    process.exit(0);
  }

  const baseUrl =
    args.get('base-url') || process.env.AI_BASE_URL || DEFAULT_BASE_URL;
  const token = args.get('token') || process.env.AI_AUTH_TOKEN || '';
  const boardIdsRaw = args.get('board-ids') || process.env.AB_BOARD_IDS || '';
  const promptSuitePath =
    args.get('prompt-suite') || process.env.AB_PROMPT_SUITE || DEFAULT_PROMPTS_FILE;
  const outputDir =
    args.get('output-dir') || process.env.AB_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const timeoutMs = toInt(args.get('timeout-ms') || process.env.AB_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const delayMs = toInt(args.get('delay-ms') || process.env.AB_DELAY_MS, DEFAULT_DELAY_MS);
  const maxRequests = Math.max(0, toInt(args.get('max-requests') || process.env.AB_MAX_REQUESTS, 0));

  if (!token) {
    throw new Error('Missing auth token. Pass --token or set AI_AUTH_TOKEN.');
  }

  const boardIds = parseBoardIds(boardIdsRaw);
  if (boardIds.length === 0) {
    throw new Error('Missing board IDs. Pass --board-ids or set AB_BOARD_IDS.');
  }

  const prompts = await loadPromptSuite(path.resolve(promptSuitePath));
  if (prompts.length === 0) {
    throw new Error('Prompt suite is empty.');
  }

  const requests = [];
  boardIds.forEach((boardId) => {
    prompts.forEach((promptEntry) => {
      requests.push({
        boardId,
        promptId: promptEntry.id,
        category: promptEntry.category,
        prompt: promptEntry.prompt,
      });
    });
  });

  const finalRequests = maxRequests > 0 ? requests.slice(0, maxRequests) : requests;

  const runStartedAt = new Date();
  console.log(
    `[ab-suite] starting ${finalRequests.length} requests (${boardIds.length} boards x ${prompts.length} prompts) against ${baseUrl}`,
  );

  const results = [];

  for (let i = 0; i < finalRequests.length; i += 1) {
    const request = finalRequests[i];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    let status = 0;
    let provider = null;
    let stopReason = null;
    let toolCallCount = 0;
    let messageLength = 0;
    let error = null;

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          boardId: request.boardId,
          boardState: {},
        }),
        signal: controller.signal,
      });

      status = response.status;
      provider = response.headers.get('x-ai-provider');

      const payload = await response
        .json()
        .catch(() => ({}));

      if (Array.isArray(payload.toolCalls)) {
        toolCallCount = payload.toolCalls.length;
      }
      if (typeof payload.stopReason === 'string') {
        stopReason = payload.stopReason;
      }
      if (typeof payload.message === 'string') {
        messageLength = payload.message.length;
      }

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
      index: i + 1,
      boardId: request.boardId,
      promptId: request.promptId,
      category: request.category,
      prompt: request.prompt,
      success,
      status,
      provider,
      latencyMs,
      toolCallCount,
      stopReason,
      messageLength,
      error,
      timestamp: new Date().toISOString(),
    };

    results.push(row);

    const statusLabel = success ? 'OK' : 'ERR';
    console.log(
      `[ab-suite] ${String(i + 1).padStart(3, '0')}/${String(finalRequests.length).padStart(3, '0')} ${statusLabel} board=${request.boardId} prompt=${request.promptId} provider=${provider || 'unknown'} status=${status} latency=${latencyMs}ms tools=${toolCallCount}${error ? ` error=\"${error}\"` : ''}`,
    );

    if (delayMs > 0 && i < finalRequests.length - 1) {
      await sleep(delayMs);
    }
  }

  const providers = {};
  const promptProviderAggregate = new Map();
  const failures = [];

  results.forEach((row) => {
    const providerKey = row.provider || 'unknown';
    if (!providers[providerKey]) {
      providers[providerKey] = {
        requests: 0,
        successes: 0,
        failures: 0,
        latencies: [],
        toolCalls: [],
      };
    }

    providers[providerKey].requests += 1;
    providers[providerKey].latencies.push(row.latencyMs);
    providers[providerKey].toolCalls.push(row.toolCallCount);

    if (row.success) {
      providers[providerKey].successes += 1;
    } else {
      providers[providerKey].failures += 1;
      failures.push({
        boardId: row.boardId,
        promptId: row.promptId,
        provider: row.provider,
        status: row.status,
        error: row.error,
      });
    }

    const promptProviderKey = `${row.promptId}::${providerKey}`;
    if (!promptProviderAggregate.has(promptProviderKey)) {
      promptProviderAggregate.set(promptProviderKey, {
        promptId: row.promptId,
        category: row.category,
        provider: providerKey,
        requests: 0,
        successes: 0,
        latencies: [],
        toolCalls: [],
      });
    }

    const agg = promptProviderAggregate.get(promptProviderKey);
    agg.requests += 1;
    agg.latencies.push(row.latencyMs);
    agg.toolCalls.push(row.toolCallCount);
    if (row.success) {
      agg.successes += 1;
    }
  });

  const providerSummary = Object.fromEntries(
    Object.entries(providers).map(([provider, stats]) => [
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

  const promptProviderStats = Array.from(promptProviderAggregate.values()).map((row) => ({
    promptId: row.promptId,
    category: row.category,
    provider: row.provider,
    requests: row.requests,
    successRate: percent(row.successes, row.requests),
    avgLatencyMs: average(row.latencies),
    avgToolCalls: average(row.toolCalls),
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl,
      providerMode: process.env.AI_PROVIDER_MODE || 'unknown',
      openAiPercent: process.env.AI_OPENAI_PERCENT || 'unknown',
      boardIds,
      promptSuitePath: path.resolve(promptSuitePath),
      promptCount: prompts.length,
      requestsExecuted: finalRequests.length,
      timeoutMs,
      delayMs,
      maxRequests,
    },
    summary: {
      totalRequests: results.length,
      totalSuccesses: results.filter((row) => row.success).length,
      totalFailures: failures.length,
      providers: providerSummary,
      promptProviderStats,
      failures,
    },
    results,
  };

  await fs.mkdir(outputDir, { recursive: true });
  const stamp = getTimestampSlug(runStartedAt);
  const jsonPath = path.join(outputDir, `ab-report-${stamp}.json`);
  const mdPath = path.join(outputDir, `ab-report-${stamp}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, formatMarkdownReport(report), 'utf8');

  console.log('');
  console.log(`[ab-suite] complete. JSON: ${jsonPath}`);
  console.log(`[ab-suite] complete. Markdown: ${mdPath}`);
  console.log(
    `[ab-suite] success=${report.summary.totalSuccesses}/${report.summary.totalRequests} failures=${report.summary.totalFailures}`,
  );

  if (report.summary.totalFailures > 0) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`[ab-suite] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
