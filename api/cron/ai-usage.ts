import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 366;
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';
const DEFAULT_FIRESTORE_COLLECTION = 'aiUsageSnapshots';
const MAX_PAGES = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

type ProviderName = 'openai' | 'anthropic';

interface ProviderModelSummary {
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}

interface ProviderUsageSummary {
  provider: ProviderName;
  available: boolean;
  fetched: boolean;
  window: {
    startAt: string;
    endAt: string;
    bucketWidth: '1d';
  };
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  costUsd: number | null;
  costCurrency: string | null;
  models: Record<string, ProviderModelSummary>;
  rawPageCount: number;
  error: string | null;
}

interface SnapshotStorageResult {
  stored: boolean;
  collection: string | null;
  documentId: string | null;
  error: string | null;
}

interface SnapshotPayload {
  id: string;
  generatedAt: string;
  source: 'vercel-cron' | 'manual';
  window: {
    startAt: string;
    endAt: string;
    days: number;
  };
  providers: {
    openai: ProviderUsageSummary;
    anthropic: ProviderUsageSummary;
  };
  totals: {
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    costUsd: number | null;
    providersWithCost: number;
  };
}

interface OpenAICostAggregate {
  amountUsd: number;
  currency: string | null;
  rawPageCount: number;
}

interface AnthropicCostAggregate {
  amountUsd: number;
  currency: string | null;
  rawPageCount: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberFromUnknown(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function optionalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') {
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
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

function getFirebasePrivateKey(): string | null {
  const value = readEnv('FIREBASE_PRIVATE_KEY');
  if (!value) {
    return null;
  }
  return value.replace(/\\n/g, '\n').trim();
}

function ensureFirebaseAdmin(): boolean {
  if (getApps().length > 0) {
    return true;
  }

  const projectId = readEnv('FIREBASE_PROJECT_ID');
  const clientEmail = readEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = getFirebasePrivateKey();
  if (!projectId || !clientEmail || !privateKey) {
    return false;
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return true;
}

function appendArrayParams(searchParams: URLSearchParams, key: string, values: string[]) {
  values.forEach((value) => {
    if (value.trim().length > 0) {
      searchParams.append(key, value.trim());
    }
  });
}

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getAnthropicUsageHeaders(adminKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'x-api-key': adminKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  };
  const betaHeader = process.env.ANTHROPIC_USAGE_BETA_HEADER;
  if (typeof betaHeader === 'string' && betaHeader.trim().length > 0) {
    headers['anthropic-beta'] = betaHeader.trim();
  }
  return headers;
}

function getPayload(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  return {};
}

function getSecretCandidate(req: VercelRequest): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const headerSecret = req.headers['x-usage-collector-secret'];
  if (typeof headerSecret === 'string' && headerSecret.trim()) {
    return headerSecret.trim();
  }

  const payload = getPayload(req);
  const bodySecret = payload.secret;
  if (typeof bodySecret === 'string' && bodySecret.trim()) {
    return bodySecret.trim();
  }

  const querySecret = req.query.secret;
  if (typeof querySecret === 'string' && querySecret.trim()) {
    return querySecret.trim();
  }

  return '';
}

function isVercelCronInvocation(req: VercelRequest): boolean {
  const header = req.headers['x-vercel-cron'];
  if (typeof header !== 'string') {
    return false;
  }
  return header.trim().length > 0;
}

function isAuthorized(req: VercelRequest): boolean {
  const expectedSecret = readEnv('AI_USAGE_COLLECT_SECRET') || '';
  const providedSecret = getSecretCandidate(req);
  const fromCron = isVercelCronInvocation(req);

  if (expectedSecret) {
    if (providedSecret === expectedSecret) {
      return true;
    }
    const allowCronWithoutSecret = readEnv('AI_USAGE_ALLOW_VERCEL_CRON') === 'true';
    return allowCronWithoutSecret && fromCron;
  }

  if (fromCron) {
    return true;
  }

  // In non-production environments, allow manual invocation without a secret to simplify setup.
  return process.env.VERCEL_ENV !== 'production';
}

function mergeModelUsage(
  target: Record<string, ProviderModelSummary>,
  model: string,
  inputTokens: number,
  outputTokens: number,
  requestCount: number,
) {
  const key = model.trim() || 'unknown';
  if (!target[key]) {
    target[key] = {
      inputTokens: 0,
      outputTokens: 0,
      requestCount: 0,
    };
  }
  target[key].inputTokens += inputTokens;
  target[key].outputTokens += outputTokens;
  target[key].requestCount += requestCount;
}

function extractOpenAIUsageResultEntries(bucket: Record<string, unknown>): Record<string, unknown>[] {
  const results = asArray(bucket.results);
  if (results.length > 0) {
    return results.map(asRecord);
  }
  // Backward compatibility with historical schema examples that used "result".
  const result = asArray(bucket.result);
  return result.map(asRecord);
}

function extractOpenAICost(entry: Record<string, unknown>): { amountUsd: number; currency: string | null } {
  const amount = asRecord(entry.amount);
  const amountValue = amount.value;
  if (amountValue !== undefined) {
    return {
      amountUsd: numberFromUnknown(amountValue),
      currency: typeof amount.currency === 'string' ? amount.currency : null,
    };
  }

  // Fallback for schema variations.
  if (entry.cost_usd !== undefined) {
    return { amountUsd: numberFromUnknown(entry.cost_usd), currency: 'usd' };
  }
  if (entry.usd !== undefined) {
    return { amountUsd: numberFromUnknown(entry.usd), currency: 'usd' };
  }

  return { amountUsd: 0, currency: null };
}

function extractAnthropicCacheCreationInputTokens(cacheCreation: unknown): number {
  const cacheRecord = asRecord(cacheCreation);
  return Object.values(cacheRecord).reduce((sum, value) => sum + numberFromUnknown(value), 0);
}

function extractAnthropicCost(entry: Record<string, unknown>): { amountUsd: number; currency: string | null } {
  if (entry.amount !== undefined) {
    const amountRecord = asRecord(entry.amount);
    if (Object.keys(amountRecord).length > 0) {
      const value =
        amountRecord.value ??
        amountRecord.usd ??
        amountRecord.amount ??
        amountRecord.total ??
        amountRecord.total_usd;
      const currency =
        typeof amountRecord.currency === 'string'
          ? amountRecord.currency
          : typeof amountRecord.unit === 'string'
            ? amountRecord.unit
            : 'usd';
      return {
        amountUsd: numberFromUnknown(value),
        currency,
      };
    }

    const numericAmount = numberFromUnknown(entry.amount);
    if (numericAmount !== 0) {
      return {
        amountUsd: numericAmount,
        currency: 'usd',
      };
    }
  }

  const fallbackCost =
    entry.cost_usd ??
    entry.usd ??
    entry.total_cost_usd ??
    entry.total_cost ??
    entry.cost;
  if (fallbackCost !== undefined) {
    return {
      amountUsd: numberFromUnknown(fallbackCost),
      currency: 'usd',
    };
  }

  return { amountUsd: 0, currency: null };
}

function getErrorMessage(payload: Record<string, unknown>, fallbackText: string): string {
  const payloadError = payload.error;
  if (typeof payloadError === 'string') {
    return payloadError;
  }
  if (payloadError && typeof payloadError === 'object') {
    const errorMessage = asRecord(payloadError).message;
    if (typeof errorMessage === 'string') {
      return errorMessage;
    }
  }
  return fallbackText || 'Unknown error';
}

async function fetchPaginated(
  baseUrl: string,
  endpointPath: string,
  headers: Record<string, string>,
  initialParams: URLSearchParams,
): Promise<Record<string, unknown>[]> {
  const pages: Record<string, unknown>[] = [];
  let nextPage: string | null = null;

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const params = new URLSearchParams(initialParams);
    if (nextPage) {
      params.set('page', nextPage);
    }

    const url = `${baseUrl}${endpointPath}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    const responseText = await response.text();
    let payload: unknown = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = {};
    }
    const payloadRecord = asRecord(payload);

    if (!response.ok) {
      throw new Error(
        `${endpointPath} failed with status ${response.status}: ${getErrorMessage(
          payloadRecord,
          responseText,
        )}`,
      );
    }

    pages.push(payloadRecord);

    const hasMore = payloadRecord.has_more === true;
    const pageCursor = typeof payloadRecord.next_page === 'string' ? payloadRecord.next_page : '';
    if (!hasMore || !pageCursor) {
      break;
    }
    nextPage = pageCursor;
  }

  return pages;
}

async function fetchOpenAICostAggregate(
  apiKey: string,
  startAt: Date,
  endAt: Date,
): Promise<OpenAICostAggregate> {
  const params = new URLSearchParams({
    start_time: String(unixSeconds(startAt)),
    end_time: String(unixSeconds(endAt)),
    bucket_width: '1d',
  });

  const pages = await fetchPaginated(
    OPENAI_API_BASE,
    '/organization/costs',
    {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    params,
  );

  let amountUsd = 0;
  let currency: string | null = null;

  pages.forEach((page) => {
    const buckets = asArray(page.data).map(asRecord);
    buckets.forEach((bucket) => {
      const entries = asArray(bucket.results).map(asRecord);
      entries.forEach((entry) => {
        const extracted = extractOpenAICost(entry);
        amountUsd += extracted.amountUsd;
        if (!currency && extracted.currency) {
          currency = extracted.currency;
        }
      });
    });
  });

  return {
    amountUsd,
    currency,
    rawPageCount: pages.length,
  };
}

async function collectOpenAIUsage(
  apiKey: string,
  startAt: Date,
  endAt: Date,
): Promise<ProviderUsageSummary> {
  const summary: ProviderUsageSummary = {
    provider: 'openai',
    available: true,
    fetched: false,
    window: {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      bucketWidth: '1d',
    },
    inputTokens: 0,
    outputTokens: 0,
    requestCount: 0,
    costUsd: null,
    costCurrency: null,
    models: {},
    rawPageCount: 0,
    error: null,
  };

  try {
    const usageParams = new URLSearchParams({
      start_time: String(unixSeconds(startAt)),
      end_time: String(unixSeconds(endAt)),
      bucket_width: '1d',
    });
    appendArrayParams(usageParams, 'group_by[]', ['model']);

    const usagePages = await fetchPaginated(
      OPENAI_API_BASE,
      '/organization/usage/completions',
      {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      usageParams,
    );

    usagePages.forEach((page) => {
      const buckets = asArray(page.data).map(asRecord);
      buckets.forEach((bucket) => {
        extractOpenAIUsageResultEntries(bucket).forEach((result) => {
          const model = typeof result.model === 'string' ? result.model : 'unknown';
          const inputTokens = numberFromUnknown(result.input_tokens);
          const outputTokens = numberFromUnknown(result.output_tokens);
          const requestCount = numberFromUnknown(result.num_model_requests);

          summary.inputTokens += inputTokens;
          summary.outputTokens += outputTokens;
          summary.requestCount += requestCount;
          mergeModelUsage(summary.models, model, inputTokens, outputTokens, requestCount);
        });
      });
    });

    summary.rawPageCount += usagePages.length;

    const costAggregate = await fetchOpenAICostAggregate(apiKey, startAt, endAt);
    summary.costUsd = costAggregate.amountUsd;
    summary.costCurrency = costAggregate.currency ?? 'usd';
    summary.rawPageCount += costAggregate.rawPageCount;
    summary.fetched = true;
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
  }

  return summary;
}

async function fetchAnthropicCostAggregate(
  adminKey: string,
  startAt: Date,
  endAt: Date,
): Promise<AnthropicCostAggregate> {
  const params = new URLSearchParams({
    starting_at: startAt.toISOString(),
    ending_at: endAt.toISOString(),
    bucket_width: '1d',
  });

  const pages = await fetchPaginated(
    ANTHROPIC_API_BASE,
    '/organizations/cost_report',
    getAnthropicUsageHeaders(adminKey),
    params,
  );

  let amountUsd = 0;
  let currency: string | null = null;

  pages.forEach((page) => {
    const buckets = asArray(page.data).map(asRecord);
    buckets.forEach((bucket) => {
      const results = asArray(bucket.results).map(asRecord);
      results.forEach((result) => {
        const extracted = extractAnthropicCost(result);
        amountUsd += extracted.amountUsd;
        if (!currency && extracted.currency) {
          currency = extracted.currency;
        }
      });
    });
  });

  return {
    amountUsd,
    currency,
    rawPageCount: pages.length,
  };
}

async function collectAnthropicUsage(
  adminKey: string,
  startAt: Date,
  endAt: Date,
): Promise<ProviderUsageSummary> {
  const summary: ProviderUsageSummary = {
    provider: 'anthropic',
    available: true,
    fetched: false,
    window: {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      bucketWidth: '1d',
    },
    inputTokens: 0,
    outputTokens: 0,
    requestCount: 0,
    costUsd: null,
    costCurrency: null,
    models: {},
    rawPageCount: 0,
    error: null,
  };

  try {
    const usageParams = new URLSearchParams({
      starting_at: startAt.toISOString(),
      ending_at: endAt.toISOString(),
      bucket_width: '1d',
    });
    appendArrayParams(usageParams, 'group_by[]', ['model']);

    const usagePages = await fetchPaginated(
      ANTHROPIC_API_BASE,
      '/organizations/usage_report/messages',
      getAnthropicUsageHeaders(adminKey),
      usageParams,
    );

    usagePages.forEach((page) => {
      const buckets = asArray(page.data).map(asRecord);
      buckets.forEach((bucket) => {
        const results = asArray(bucket.results).map(asRecord);
        results.forEach((result) => {
          const model = typeof result.model === 'string' ? result.model : 'unknown';
          const uncachedInputTokens = numberFromUnknown(result.uncached_input_tokens);
          const cacheReadInputTokens = numberFromUnknown(result.cache_read_input_tokens);
          const cacheCreationInputTokens = extractAnthropicCacheCreationInputTokens(
            result.cache_creation,
          );
          const outputTokens = numberFromUnknown(result.output_tokens);
          const requestCount =
            numberFromUnknown(result.num_model_requests) || numberFromUnknown(result.request_count);
          const inputTokens =
            uncachedInputTokens + cacheReadInputTokens + cacheCreationInputTokens;

          summary.inputTokens += inputTokens;
          summary.outputTokens += outputTokens;
          summary.requestCount += requestCount;
          mergeModelUsage(summary.models, model, inputTokens, outputTokens, requestCount);
        });
      });
    });

    summary.rawPageCount += usagePages.length;

    const costAggregate = await fetchAnthropicCostAggregate(adminKey, startAt, endAt);
    summary.costUsd = costAggregate.amountUsd;
    summary.costCurrency = costAggregate.currency ?? 'usd';
    summary.rawPageCount += costAggregate.rawPageCount;
    summary.fetched = true;
  } catch (err) {
    summary.error = err instanceof Error ? err.message : String(err);
  }

  return summary;
}

function unavailableProviderSummary(
  provider: ProviderName,
  startAt: Date,
  endAt: Date,
  reason: string,
): ProviderUsageSummary {
  return {
    provider,
    available: false,
    fetched: false,
    window: {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      bucketWidth: '1d',
    },
    inputTokens: 0,
    outputTokens: 0,
    requestCount: 0,
    costUsd: null,
    costCurrency: null,
    models: {},
    rawPageCount: 0,
    error: reason,
  };
}

function resolveWindow(req: VercelRequest): {
  startAt: Date;
  endAt: Date;
  days: number;
} | null {
  const payload = getPayload(req);
  const now = new Date();
  const defaultDays = clamp(
    parseInteger(readEnv('AI_USAGE_DEFAULT_LOOKBACK_DAYS'), DEFAULT_LOOKBACK_DAYS),
    1,
    MAX_LOOKBACK_DAYS,
  );

  const days = clamp(
    parseInteger(payload.days ?? req.query.days, defaultDays),
    1,
    MAX_LOOKBACK_DAYS,
  );

  const endAtCandidate = optionalDate(payload.endAt ?? req.query.endAt);
  const endAt = endAtCandidate ?? now;

  const startAtCandidate = optionalDate(payload.startAt ?? req.query.startAt);
  const fallbackStartAt = new Date(endAt.getTime() - days * DAY_MS);
  const startAt = startAtCandidate ?? fallbackStartAt;

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return null;
  }
  if (startAt.getTime() >= endAt.getTime()) {
    return null;
  }

  return { startAt, endAt, days };
}

function shouldPersistSnapshot(req: VercelRequest): boolean {
  const payload = getPayload(req);
  return parseBoolean(payload.save ?? req.query.save, true);
}

async function persistSnapshot(
  snapshot: SnapshotPayload,
  enabled: boolean,
): Promise<SnapshotStorageResult> {
  if (!enabled) {
    return {
      stored: false,
      collection: null,
      documentId: null,
      error: null,
    };
  }

  if (!ensureFirebaseAdmin()) {
    return {
      stored: false,
      collection: null,
      documentId: null,
      error: 'Firebase Admin is not configured for snapshot persistence.',
    };
  }

  const collectionName = readEnv('AI_USAGE_FIRESTORE_COLLECTION') || DEFAULT_FIRESTORE_COLLECTION;
  const firestore = getFirestore();
  const documentId = snapshot.id;

  try {
    await firestore.collection(collectionName).doc(documentId).set(snapshot, { merge: true });
    return {
      stored: true,
      collection: collectionName,
      documentId,
      error: null,
    };
  } catch (err) {
    return {
      stored: false,
      collection: collectionName,
      documentId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Usage-Collector-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized usage collection request',
    });
  }

  const window = resolveWindow(req);
  if (!window) {
    return res.status(400).json({
      error: 'Invalid window. Ensure startAt/endAt are valid and startAt < endAt.',
    });
  }

  const openAIKey = readEnv('OPENAI_ADMIN_API_KEY') || readEnv('OPENAI_API_KEY');
  const anthropicAdminKey = readEnv('ANTHROPIC_ADMIN_API_KEY') || readEnv('ANTHROPIC_API_KEY');

  const [openaiSummary, anthropicSummary] = await Promise.all([
    openAIKey
      ? collectOpenAIUsage(openAIKey, window.startAt, window.endAt)
      : Promise.resolve(
          unavailableProviderSummary(
            'openai',
            window.startAt,
            window.endAt,
            'Missing OPENAI_ADMIN_API_KEY (or OPENAI_API_KEY fallback).',
          ),
        ),
    anthropicAdminKey
      ? collectAnthropicUsage(anthropicAdminKey, window.startAt, window.endAt)
      : Promise.resolve(
          unavailableProviderSummary(
            'anthropic',
            window.startAt,
            window.endAt,
            'Missing ANTHROPIC_ADMIN_API_KEY (or ANTHROPIC_API_KEY fallback).',
          ),
        ),
  ]);

  const costContributors = [openaiSummary, anthropicSummary].filter(
    (summary) => summary.costUsd !== null,
  );
  const totals = {
    inputTokens: openaiSummary.inputTokens + anthropicSummary.inputTokens,
    outputTokens: openaiSummary.outputTokens + anthropicSummary.outputTokens,
    requestCount: openaiSummary.requestCount + anthropicSummary.requestCount,
    costUsd:
      costContributors.length > 0
        ? costContributors.reduce((sum, summary) => sum + (summary.costUsd ?? 0), 0)
        : null,
    providersWithCost: costContributors.length,
  };

  const snapshot: SnapshotPayload = {
    id: `usage-${timestampSlug()}`,
    generatedAt: new Date().toISOString(),
    source: isVercelCronInvocation(req) ? 'vercel-cron' : 'manual',
    window: {
      startAt: window.startAt.toISOString(),
      endAt: window.endAt.toISOString(),
      days: window.days,
    },
    providers: {
      openai: openaiSummary,
      anthropic: anthropicSummary,
    },
    totals,
  };

  const storage = await persistSnapshot(snapshot, shouldPersistSnapshot(req));

  return res.status(200).json({
    ok: true,
    snapshot,
    storage,
  });
}
