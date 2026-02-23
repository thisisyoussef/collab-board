# LLM Claim Classification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add LLM-powered claim classification (weak/moderate/strong) that reactively evaluates claims when their graph changes, with a manual override dropdown and visual indicators.

**Architecture:** New Vercel serverless endpoint `/api/ai/classify-claim.ts` receives claim subgraph text, returns LLM classification. New client hook `useClaimClassification.ts` detects claim-impacting changes and debounces API calls. Manual override stored on `BoardObject` with priority over AI classification.

**Tech Stack:** Vercel serverless functions, Anthropic Claude (haiku), Firebase Auth, React hooks, existing Socket.IO broadcast for sync.

---

### Task 1: Add New Fields to BoardObject Type

**Files:**
- Modify: `src/types/board.ts:23-63`

**Step 1: Add the three new optional fields to BoardObject interface**

In `src/types/board.ts`, add these fields after line 59 (`relationType`), before `zIndex`:

```typescript
  aiStrengthLevel?: 'weak' | 'moderate' | 'strong';
  aiStrengthReason?: string;
  manualStrengthOverride?: 'weak' | 'moderate' | 'strong';
```

**Step 2: Add the ClaimStrengthLevel type alias**

At the top of the file, after the `LitigationConnectorRelation` type (line 21), add:

```typescript
export type ClaimStrengthLevel = 'weak' | 'moderate' | 'strong';
```

Then update the three new fields to use it:

```typescript
  aiStrengthLevel?: ClaimStrengthLevel;
  aiStrengthReason?: string;
  manualStrengthOverride?: ClaimStrengthLevel;
```

**Step 3: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 4: Commit**

```bash
git add src/types/board.ts
git commit -m "feat: add aiStrengthLevel, aiStrengthReason, manualStrengthOverride to BoardObject"
```

---

### Task 2: Create the Vercel Serverless Endpoint

**Files:**
- Create: `api/ai/classify-claim.ts`

**Step 1: Write a minimal test for the endpoint**

Create `src/api/ai-classify-claim.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock firebase-admin before importing handler
vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => [{ name: 'mock' }]),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user-123' }),
  })),
}));

// Mock Anthropic
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({ messages: { create: mockCreate } })),
}));

let handler: (req: VercelRequest, res: VercelResponse) => Promise<void>;

beforeEach(async () => {
  vi.clearAllMocks();
  const module = await import('../../api/ai/classify-claim');
  handler = module.default;
});

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: {
      boardId: 'board-1',
      claimId: 'claim-1',
      claimText: 'The defendant was at the scene',
      connectedNodes: [
        { id: 'ev-1', role: 'evidence', text: 'CCTV footage shows defendant', relationToClaim: 'supports' },
      ],
    },
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes(): VercelResponse & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null,
    _headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { res._headers[key] = value; return res; },
    status(code: number) { res._status = code; return res; },
    json(data: unknown) { res._json = data; return res; },
  } as unknown as VercelResponse & { _status: number; _json: unknown };
  return res;
}

describe('classify-claim endpoint', () => {
  it('returns 405 for non-POST requests', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 401 when no auth token provided', async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 400 when claimText is missing', async () => {
    const req = makeReq({ body: { boardId: 'b', claimId: 'c', connectedNodes: [] } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns classification on valid request', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"level":"strong","reason":"Supported by CCTV evidence."}' }],
    });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json).toEqual(
      expect.objectContaining({ level: 'strong', reason: expect.any(String) }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/ai-classify-claim.test.ts`
Expected: FAIL — module not found.

**Step 3: Create the endpoint**

Create `api/ai/classify-claim.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const MODEL = process.env.CLAIM_CLASSIFY_MODEL || 'claude-3-5-haiku-latest';

function getFirebasePrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return undefined;
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

function ensureFirebaseAdmin() {
  if (getApps().length > 0) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKey();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured');
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

function extractBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

interface ConnectedNode {
  id: string;
  role: string;
  text: string;
  relationToClaim: string;
}

interface ClassifyRequest {
  boardId: string;
  claimId: string;
  claimText: string;
  connectedNodes: ConnectedNode[];
}

type ClaimLevel = 'weak' | 'moderate' | 'strong';

function isValidLevel(value: unknown): value is ClaimLevel {
  return value === 'weak' || value === 'moderate' || value === 'strong';
}

function buildPrompt(claimText: string, nodes: ConnectedNode[]): string {
  let prompt = `Classify the following legal claim as "weak", "moderate", or "strong" based on its supporting and contradicting evidence.\n\n`;
  prompt += `## Claim\n"${claimText}"\n\n`;

  if (nodes.length > 0) {
    prompt += `## Connected Nodes\n`;
    for (const node of nodes) {
      prompt += `- [${node.role}] (${node.relationToClaim}): "${node.text}"\n`;
    }
    prompt += '\n';
  } else {
    prompt += `No connected evidence, witnesses, or timeline events.\n\n`;
  }

  prompt += `Respond with ONLY a JSON object: {"level": "weak"|"moderate"|"strong", "reason": "<1-2 sentence explanation>"}`;
  return prompt;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  try {
    ensureFirebaseAdmin();
    await getAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const body = req.body as Partial<ClassifyRequest>;
  if (!body.claimText || typeof body.claimText !== 'string' || !body.claimId) {
    return res.status(400).json({ error: 'Missing required fields: claimId, claimText' });
  }

  const connectedNodes: ConnectedNode[] = Array.isArray(body.connectedNodes) ? body.connectedNodes : [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI provider not configured' });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: 'You are a litigation analysis assistant. Classify claim strength based on available evidence. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: buildPrompt(body.claimText, connectedNodes) }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return res.status(500).json({ error: 'No text response from AI' });
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);
    const level = isValidLevel(parsed.level) ? parsed.level : 'moderate';
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 500) : 'No explanation provided.';

    return res.status(200).json({ level, reason });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Classification failed: ${message}` });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/ai-classify-claim.test.ts`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add api/ai/classify-claim.ts src/api/ai-classify-claim.test.ts
git commit -m "feat: add /api/ai/classify-claim serverless endpoint"
```

---

### Task 3: Create the useClaimClassification Hook

**Files:**
- Create: `src/hooks/useClaimClassification.ts`

**Step 1: Write the hook test**

Create `src/hooks/useClaimClassification.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildClaimSubgraph } from '../hooks/useClaimClassification';
import type { BoardObject } from '../types/board';

function makeObject(overrides: Partial<BoardObject>): BoardObject {
  return {
    id: 'obj-1',
    type: 'sticky',
    x: 0, y: 0, width: 100, height: 100,
    rotation: 0,
    color: '#fff',
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildClaimSubgraph', () => {
  it('returns null for non-claim nodes', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('obj-1', makeObject({ id: 'obj-1', nodeRole: 'evidence', text: 'Some evidence' }));
    expect(buildClaimSubgraph('obj-1', objects)).toBeNull();
  });

  it('extracts claim text and connected supporting evidence', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('claim-1', makeObject({ id: 'claim-1', nodeRole: 'claim', text: 'Defendant was present' }));
    objects.set('ev-1', makeObject({ id: 'ev-1', nodeRole: 'evidence', text: 'CCTV footage' }));
    objects.set('conn-1', makeObject({
      id: 'conn-1', type: 'connector', fromId: 'ev-1', toId: 'claim-1', relationType: 'supports',
    }));
    const result = buildClaimSubgraph('claim-1', objects);
    expect(result).toEqual({
      claimId: 'claim-1',
      claimText: 'Defendant was present',
      connectedNodes: [
        { id: 'ev-1', role: 'evidence', text: 'CCTV footage', relationToClaim: 'supports' },
      ],
    });
  });

  it('returns empty connectedNodes when claim has no connections', () => {
    const objects = new Map<string, BoardObject>();
    objects.set('claim-1', makeObject({ id: 'claim-1', nodeRole: 'claim', text: 'Solo claim' }));
    const result = buildClaimSubgraph('claim-1', objects);
    expect(result).toEqual({
      claimId: 'claim-1',
      claimText: 'Solo claim',
      connectedNodes: [],
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useClaimClassification.test.ts`
Expected: FAIL — module not found.

**Step 3: Create the hook**

Create `src/hooks/useClaimClassification.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { logger } from '../lib/logger';
import type { BoardObject, ClaimStrengthLevel } from '../types/board';

const DEBOUNCE_MS = 3000;
const ENDPOINT = '/api/ai/classify-claim';

export interface ClaimSubgraph {
  claimId: string;
  claimText: string;
  connectedNodes: Array<{
    id: string;
    role: string;
    text: string;
    relationToClaim: string;
  }>;
}

/**
 * Extract the claim's text and all directly connected nodes with their relations.
 * Returns null if the objectId is not a claim.
 */
export function buildClaimSubgraph(
  claimId: string,
  objects: Map<string, BoardObject>,
): ClaimSubgraph | null {
  const claim = objects.get(claimId);
  if (!claim || claim.type === 'connector' || claim.nodeRole !== 'claim') {
    return null;
  }

  const connectedNodes: ClaimSubgraph['connectedNodes'] = [];

  objects.forEach((obj) => {
    if (obj.type !== 'connector' || !obj.relationType) return;

    // Connector points TO this claim: the source node is connected
    if (obj.toId === claimId && obj.fromId) {
      const source = objects.get(obj.fromId);
      if (source && source.type !== 'connector' && source.nodeRole) {
        connectedNodes.push({
          id: source.id,
          role: source.nodeRole,
          text: source.text || source.title || '',
          relationToClaim: obj.relationType,
        });
      }
    }

    // Connector points FROM this claim (e.g., depends_on)
    if (obj.fromId === claimId && obj.toId) {
      const target = objects.get(obj.toId);
      if (target && target.type !== 'connector' && target.nodeRole) {
        connectedNodes.push({
          id: target.id,
          role: target.nodeRole,
          text: target.text || target.title || '',
          relationToClaim: obj.relationType,
        });
      }
    }
  });

  return {
    claimId,
    claimText: claim.text || claim.title || '',
    connectedNodes,
  };
}

/**
 * Hash a subgraph to detect meaningful changes (avoids re-classifying identical state).
 */
function hashSubgraph(subgraph: ClaimSubgraph): string {
  const parts = [subgraph.claimText];
  for (const node of subgraph.connectedNodes) {
    parts.push(`${node.id}:${node.role}:${node.relationToClaim}:${node.text}`);
  }
  return parts.join('|');
}

interface UseClaimClassificationOptions {
  boardId?: string;
  user?: User | null;
  objectsRef: React.RefObject<Map<string, BoardObject>>;
  boardRevision: number;
  onClassified: (claimId: string, level: ClaimStrengthLevel, reason: string) => void;
}

/**
 * Reactively classifies claims via LLM when their subgraph changes.
 * Debounces 3s after the last relevant change.
 */
export function useClaimClassification({
  boardId,
  user,
  objectsRef,
  boardRevision,
  onClassified,
}: UseClaimClassificationOptions) {
  const pendingRef = useRef(new Set<string>());
  const hashCacheRef = useRef(new Map<string, string>());
  const debounceTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const classifyClaim = useCallback(
    async (claimId: string) => {
      if (!boardId || !user || !objectsRef.current) return;

      const subgraph = buildClaimSubgraph(claimId, objectsRef.current);
      if (!subgraph) return;

      // Skip if subgraph hasn't changed since last classification
      const hash = hashSubgraph(subgraph);
      if (hashCacheRef.current.get(claimId) === hash) return;

      pendingRef.current.add(claimId);

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          const token = await user.getIdToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          logger.warn('CLAIM_CLASSIFY', 'Could not retrieve auth token');
        }

        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            boardId,
            claimId: subgraph.claimId,
            claimText: subgraph.claimText,
            connectedNodes: subgraph.connectedNodes,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          logger.warn('CLAIM_CLASSIFY', `Classification failed: ${res.status}`, err);
          return;
        }

        const data = await res.json();
        if (data.level && typeof data.reason === 'string') {
          hashCacheRef.current.set(claimId, hash);
          onClassified(claimId, data.level, data.reason);
        }
      } catch (err) {
        logger.warn('CLAIM_CLASSIFY', 'Network error during classification', { error: String(err) });
      } finally {
        pendingRef.current.delete(claimId);
      }
    },
    [boardId, user, objectsRef, onClassified],
  );

  // On every board revision, scan for claims whose subgraph changed and schedule classification
  useEffect(() => {
    if (!objectsRef.current) return;

    const claimIds: string[] = [];
    objectsRef.current.forEach((obj) => {
      if (obj.type !== 'connector' && obj.nodeRole === 'claim') {
        claimIds.push(obj.id);
      }
    });

    for (const claimId of claimIds) {
      // Skip claims with manual override — still classify but don't block
      // The onClassified callback writes aiStrengthLevel regardless

      const subgraph = buildClaimSubgraph(claimId, objectsRef.current);
      if (!subgraph) continue;

      const hash = hashSubgraph(subgraph);
      if (hashCacheRef.current.get(claimId) === hash) continue;

      // Clear existing timer for this claim and set a new debounced one
      const existing = debounceTimersRef.current.get(claimId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(claimId);
        void classifyClaim(claimId);
      }, DEBOUNCE_MS);

      debounceTimersRef.current.set(claimId, timer);
    }

    return () => {
      // Cleanup all timers on unmount
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, [boardRevision, classifyClaim, objectsRef]);

  return { pendingClaimIds: pendingRef };
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useClaimClassification.test.ts`
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/hooks/useClaimClassification.ts src/hooks/useClaimClassification.test.ts
git commit -m "feat: add useClaimClassification hook with debounced LLM calls"
```

---

### Task 4: Add Manual Override Dropdown to BoardInspectorPanel

**Files:**
- Modify: `src/components/BoardInspectorPanel.tsx:175-205`

**Step 1: Add the Claim Strength dropdown after the Node role dropdown**

In `BoardInspectorPanel.tsx`, find the closing of the node role `</label>` block (line 204: `) : null}`). Insert the claim strength dropdown right before that `) : null}`:

After the `</select></label>` for node role (around line 204), before the `) : null}`, add:

```tsx
          {selectedObject.nodeRole === 'claim' ? (
            <label className="property-row" htmlFor="claim-strength-override">
              <span>Claim strength</span>
              <select
                id="claim-strength-override"
                value={selectedObject.manualStrengthOverride || 'auto'}
                disabled={!canEditBoard}
                onChange={(event) => {
                  const value = event.target.value;
                  onUpdateObject(selectedObject.id, {
                    manualStrengthOverride: value === 'auto' ? undefined : (value as 'weak' | 'moderate' | 'strong'),
                  });
                }}
              >
                <option value="auto">Auto (AI)</option>
                <option value="weak">Weak</option>
                <option value="moderate">Moderate</option>
                <option value="strong">Strong</option>
              </select>
            </label>
          ) : null}
```

**Step 2: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add src/components/BoardInspectorPanel.tsx
git commit -m "feat: add claim strength manual override dropdown in inspector"
```

---

### Task 5: Update ClaimStrengthPanel to Show Override Indicators

**Files:**
- Modify: `src/components/ClaimStrengthPanel.tsx`

**Step 1: Write a test for override display**

Add to `src/components/ClaimStrengthPanel.test.tsx` (if it exists, append; if not, create):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaimStrengthPanel } from './ClaimStrengthPanel';

describe('ClaimStrengthPanel override indicators', () => {
  it('shows asterisk when manualStrengthOverride is set', () => {
    render(
      <ClaimStrengthPanel
        results={[
          {
            claimId: 'c1',
            claimLabel: 'Test Claim',
            score: 80,
            level: 'strong',
            supportCount: 3,
            contradictionCount: 0,
            dependencyGapCount: 0,
            reasons: ['Well supported'],
            aiStrengthLevel: 'moderate',
            manualStrengthOverride: 'strong',
            effectiveLevel: 'strong',
            isOverridden: true,
          },
        ]}
        onFocusClaim={vi.fn()}
      />,
    );
    expect(screen.getByText('strong*')).toBeTruthy();
    expect(screen.getByText('AI suggested: moderate')).toBeTruthy();
  });
});
```

**Step 2: Update ClaimStrengthResult to include override info**

In `src/lib/litigation-graph.ts`, extend the `ClaimStrengthResult` interface (line 68-77) by adding:

```typescript
  aiStrengthLevel?: 'weak' | 'moderate' | 'strong';
  manualStrengthOverride?: 'weak' | 'moderate' | 'strong';
  effectiveLevel: 'weak' | 'moderate' | 'strong';
  isOverridden: boolean;
```

Update `evaluateClaimStrength` (line 125-189) to read the new fields from each BoardObject and compute `effectiveLevel`:

After computing `level` (line 162), add:

```typescript
    const obj = objectsById.get(claimId);
    const aiLevel = obj?.aiStrengthLevel;
    const manualOverride = obj?.manualStrengthOverride;

    // Priority: manual > AI > deterministic
    const effectiveLevel: ClaimStrengthResult['level'] =
      manualOverride || aiLevel || level;
    const isOverridden = !!manualOverride;
```

And include these in the return object:

```typescript
    return {
      claimId,
      claimLabel: resolveClaimLabel(objectsById.get(claimId), claimId),
      score,
      level,
      supportCount,
      contradictionCount,
      dependencyGapCount: unresolvedDependencyCount,
      reasons,
      aiStrengthLevel: aiLevel,
      manualStrengthOverride: manualOverride,
      effectiveLevel,
      isOverridden,
    };
```

**Step 3: Update ClaimStrengthPanel component**

Replace `src/components/ClaimStrengthPanel.tsx` with:

```tsx
import type { ClaimStrengthResult } from '../lib/litigation-graph';

interface ClaimStrengthPanelProps {
  results: ClaimStrengthResult[];
  onFocusClaim: (claimId: string) => void;
}

export function ClaimStrengthPanel({ results, onFocusClaim }: ClaimStrengthPanelProps) {
  return (
    <section className="claim-strength-panel properties-panel">
      <div className="claim-strength-panel-header">
        <h3>Claim strength heatmap</h3>
        <p>AI-powered classification with manual override support.</p>
      </div>

      {results.length === 0 ? (
        <p className="claim-strength-empty">Tag at least one claim node to compute strength.</p>
      ) : (
        <ul className="claim-strength-list" aria-label="Claim strength list">
          {results.map((result) => (
            <li key={result.claimId} className={`claim-strength-item level-${result.effectiveLevel}`}>
              <button
                type="button"
                className="claim-strength-focus"
                onClick={() => onFocusClaim(result.claimId)}
                aria-label={`Focus claim ${result.claimLabel}`}
              >
                <span className="claim-strength-label">{result.claimLabel}</span>
                <span className="claim-strength-score">{result.score}</span>
              </button>
              <div className="claim-strength-meta">
                <span
                  className={`claim-strength-level is-${result.effectiveLevel}`}
                  style={result.isOverridden ? { borderStyle: 'dotted' } : undefined}
                >
                  {result.effectiveLevel}{result.isOverridden ? '*' : ''}
                </span>
                <span>
                  S:{result.supportCount} C:{result.contradictionCount} D:{result.dependencyGapCount}
                </span>
              </div>
              {result.isOverridden && result.aiStrengthLevel ? (
                <div className="claim-strength-ai-suggestion">
                  AI suggested: {result.aiStrengthLevel}
                </div>
              ) : null}
              {result.aiStrengthReason ? (
                <div className="claim-strength-ai-reason">{result.aiStrengthReason}</div>
              ) : null}
              <ul className="claim-strength-reasons">
                {result.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run src/components/ClaimStrengthPanel.test.tsx src/lib/litigation-graph.test.ts`
Expected: PASS (may need to update existing tests for new `effectiveLevel`/`isOverridden` fields).

**Step 5: Commit**

```bash
git add src/lib/litigation-graph.ts src/components/ClaimStrengthPanel.tsx src/components/ClaimStrengthPanel.test.tsx
git commit -m "feat: show effective claim level with override indicators in heatmap"
```

---

### Task 6: Integrate useClaimClassification into Board.tsx

**Files:**
- Modify: `src/pages/Board.tsx`

**Step 1: Import the hook**

Add to the imports section (near line 34):

```typescript
import { useClaimClassification } from '../hooks/useClaimClassification';
```

**Step 2: Add the onClassified callback and hook call**

After the `claimStrengthIndicators` useMemo (around line 450), add:

```typescript
  const handleClaimClassified = useCallback(
    (claimId: string, level: ClaimStrengthLevel, reason: string) => {
      const obj = objectsRef.current.get(claimId);
      if (!obj) return;
      handleUpdateObject(claimId, {
        aiStrengthLevel: level,
        aiStrengthReason: reason,
      });
    },
    [handleUpdateObject],
  );

  const { pendingClaimIds } = useClaimClassification({
    boardId,
    user,
    objectsRef,
    boardRevision,
    onClassified: handleClaimClassified,
  });
```

Import `ClaimStrengthLevel` from `../types/board` in the imports.

**Step 3: Update the canvas badge to show asterisk for overrides**

Find the `claimStrengthIndicators` useMemo (line 415-450). Update it to include the `isOverridden` flag:

In the `indicators.push(...)` call, add:

```typescript
        const isOverridden = !!entry.manualStrengthOverride;
        const effectiveLevel = entry.manualStrengthOverride || entry.aiStrengthLevel || result.level;
```

And update `levelLabel` to:

```typescript
        levelLabel: effectiveLevel.toUpperCase() + (isOverridden ? '*' : ''),
```

And update `color` to:

```typescript
        color: claimStrengthColor(effectiveLevel),
```

**Step 4: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add src/pages/Board.tsx
git commit -m "feat: integrate useClaimClassification hook into Board page"
```

---

### Task 7: Add CSS for Override Indicators

**Files:**
- Modify: whichever CSS file contains `.claim-strength-*` styles (likely `src/pages/Board.css` or a global stylesheet)

**Step 1: Find and update the stylesheet**

Search for `.claim-strength-level` in CSS files. Add:

```css
.claim-strength-ai-suggestion {
  font-size: 11px;
  color: #888;
  font-style: italic;
  margin-top: 2px;
}

.claim-strength-ai-reason {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
  line-height: 1.3;
}

.claim-strength-level[style*="dotted"] {
  border-width: 1.5px;
  padding: 1px 6px;
}
```

**Step 2: Commit**

```bash
git add <css-file>
git commit -m "feat: add CSS for claim override indicators"
```

---

### Task 8: Final Integration Test

**Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 2: Run the build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

**Step 3: Manual verification checklist**

- [ ] Create a sticky note, set role to "claim" → AI classification triggers after 3s
- [ ] Add evidence node connected with "supports" → classification re-runs
- [ ] Check ClaimStrengthPanel shows AI level
- [ ] Use inspector dropdown to override to "Weak" → badge shows "WEAK*"
- [ ] Panel shows "AI suggested: strong" below the override
- [ ] Set back to "Auto (AI)" → asterisk disappears, AI level restored
- [ ] Other users see the classification via Socket.IO sync

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete LLM claim classification with manual override"
```
