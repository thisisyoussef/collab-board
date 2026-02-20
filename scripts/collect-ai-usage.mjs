#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://collab-board-iota.vercel.app';
const DEFAULT_DAYS = 30;
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'docs/submission/usage');

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

function parseInteger(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
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

function timestampSlug(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}Z`;
}

function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function formatCurrency(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A';
  }
  return `$${value.toFixed(4)}`;
}

function formatNumber(value) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return numeric.toLocaleString('en-US');
}

function topModels(models, limit = 5) {
  return Object.entries(asObject(models))
    .map(([model, stats]) => {
      const record = asObject(stats);
      return {
        model,
        inputTokens: Number(record.inputTokens || 0),
        outputTokens: Number(record.outputTokens || 0),
        requestCount: Number(record.requestCount || 0),
      };
    })
    .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens))
    .slice(0, limit);
}

function formatMarkdownReport(payload) {
  const snapshot = asObject(payload.snapshot);
  const providers = asObject(snapshot.providers);
  const openai = asObject(providers.openai);
  const anthropic = asObject(providers.anthropic);
  const totals = asObject(snapshot.totals);
  const window = asObject(snapshot.window);

  const lines = [];
  lines.push('# AI Usage Snapshot');
  lines.push('');
  lines.push(`- Generated at: ${snapshot.generatedAt || 'unknown'}`);
  lines.push(`- Snapshot ID: ${snapshot.id || 'unknown'}`);
  lines.push(`- Range: ${window.startAt || 'unknown'} -> ${window.endAt || 'unknown'} (${window.days || 'n/a'} days)`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---:|');
  lines.push(`| Input tokens | ${formatNumber(Number(totals.inputTokens || 0))} |`);
  lines.push(`| Output tokens | ${formatNumber(Number(totals.outputTokens || 0))} |`);
  lines.push(`| Request count | ${formatNumber(Number(totals.requestCount || 0))} |`);
  lines.push(`| Cost (USD) | ${formatCurrency(Number(totals.costUsd))} |`);
  lines.push('');
  lines.push('## Provider Summary');
  lines.push('');
  lines.push('| Provider | Available | Fetched | Input Tokens | Output Tokens | Requests | Cost (USD) | Error |');
  lines.push('|---|---|---|---:|---:|---:|---:|---|');
  [openai, anthropic].forEach((provider) => {
    lines.push(
      `| ${provider.provider || 'unknown'} | ${provider.available ? 'Yes' : 'No'} | ${provider.fetched ? 'Yes' : 'No'} | ${formatNumber(Number(provider.inputTokens || 0))} | ${formatNumber(Number(provider.outputTokens || 0))} | ${formatNumber(Number(provider.requestCount || 0))} | ${formatCurrency(Number(provider.costUsd))} | ${(provider.error || '').toString().replaceAll('|', '\\|')} |`,
    );
  });
  lines.push('');
  lines.push('## Top Models (by token volume)');
  lines.push('');
  lines.push('| Provider | Model | Input Tokens | Output Tokens | Requests |');
  lines.push('|---|---|---:|---:|---:|');
  [
    { provider: 'openai', models: openai.models },
    { provider: 'anthropic', models: anthropic.models },
  ].forEach(({ provider, models }) => {
    topModels(models, 5).forEach((row) => {
      lines.push(
        `| ${provider} | ${row.model} | ${formatNumber(row.inputTokens)} | ${formatNumber(row.outputTokens)} | ${formatNumber(row.requestCount)} |`,
      );
    });
  });

  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.has('help')) {
    console.log(`Usage:
  node scripts/collect-ai-usage.mjs \\
    [--base-url https://collab-board-iota.vercel.app] \\
    [--secret <collector-secret>] \\
    [--days 30] \\
    [--save true] \\
    [--output-dir docs/submission/usage]

Env fallback:
  AI_BASE_URL, AI_USAGE_COLLECT_SECRET, AI_USAGE_DEFAULT_LOOKBACK_DAYS
`);
    process.exit(0);
  }

  const baseUrl = (args.get('base-url') || process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/$/,
    '',
  );
  const secret = args.get('secret') || process.env.AI_USAGE_COLLECT_SECRET || '';
  const days = Math.max(
    1,
    parseInteger(
      args.get('days') || process.env.AI_USAGE_DEFAULT_LOOKBACK_DAYS,
      DEFAULT_DAYS,
    ),
  );
  const save = parseBoolean(args.get('save'), true);
  const outputDir = args.get('output-dir') || DEFAULT_OUTPUT_DIR;
  const endpoint = `${baseUrl}/api/cron/ai-usage`;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (secret) {
    headers['X-Usage-Collector-Secret'] = secret;
  }

  console.log(`[usage-collect] requesting ${endpoint} days=${days} save=${String(save)}`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ days, save }),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      `collector request failed (${response.status}): ${JSON.stringify(payload, null, 2) || text}`,
    );
  }

  const slug = timestampSlug();
  await fs.mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `usage-snapshot-${slug}.json`);
  const mdPath = path.join(outputDir, `usage-snapshot-${slug}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, formatMarkdownReport(payload), 'utf8');

  const snapshot = asObject(payload.snapshot);
  const totals = asObject(snapshot.totals);
  console.log(
    `[usage-collect] tokens in=${formatNumber(Number(totals.inputTokens || 0))} out=${formatNumber(Number(totals.outputTokens || 0))} requests=${formatNumber(Number(totals.requestCount || 0))} cost=${formatCurrency(Number(totals.costUsd))}`,
  );
  console.log(`[usage-collect] json: ${jsonPath}`);
  console.log(`[usage-collect] markdown: ${mdPath}`);
}

main().catch((err) => {
  console.error(`[usage-collect] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
