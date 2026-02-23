# LLM Claim Classification with Manual Override

**Date:** 2026-02-22
**Status:** Approved

## Problem

The existing claim strength system is purely graph-structural — it counts support edges, contradiction edges, and dependency gaps to produce a numeric score. It has no semantic understanding of node content: whether the evidence text actually supports the claim, how persuasive a witness statement is, or whether a contradiction is material.

## Solution

Add an LLM classification layer that reads claim text and connected node content to produce a semantic weak/moderate/strong rating. Provide a manual override so users can overrule the AI with their own judgment, with a visual indicator distinguishing AI-generated from user-set labels.

## Architecture: Vercel Serverless Endpoint

Matches the existing `/api/ai/generate.ts` pattern. A new `/api/ai/classify-claim.ts` endpoint receives the claim's subgraph and returns an LLM classification.

## Data Model Changes

Three new optional fields on `BoardObject` in `types/board.ts`:

```typescript
aiStrengthLevel?: 'weak' | 'moderate' | 'strong';       // LLM-generated classification
aiStrengthReason?: string;                                // LLM reasoning (1-2 sentences)
manualStrengthOverride?: 'weak' | 'moderate' | 'strong'; // User's manual override
```

**Priority stack (what wins):**
1. `manualStrengthOverride` — user's judgment, displayed with `*` indicator
2. `aiStrengthLevel` — LLM classification
3. Deterministic graph score — existing system, always visible separately in heatmap

## API Endpoint: `/api/ai/classify-claim.ts`

**Request:**
```typescript
{
  boardId: string;
  claimId: string;
  claimText: string;
  connectedNodes: Array<{
    id: string;
    role: LitigationNodeRole;
    text: string;
    relationToClaim: LitigationConnectorRelation;
  }>;
  // Future: documentRefs?: string[];
}
```

**Response:**
```typescript
{ level: 'weak' | 'moderate' | 'strong', reason: string }
```

**Model:** Cheap/fast model (haiku or gpt-4o-mini) — simple classification task.

**Auth:** Firebase Admin SDK token verification (same pattern as `generate.ts`).

## Client-Side Trigger: `useClaimClassification.ts`

**Trigger conditions** — re-classify a claim when:
- A node's `nodeRole` is set to `'claim'` (initial classification)
- A claim node's text content changes
- A connector is added/removed/changed that touches a claim node
- A connected node's text or role changes

**Debounce:** 3 seconds after the last relevant change.

**Result handling:** Write `aiStrengthLevel` and `aiStrengthReason` onto the BoardObject via the existing `updateObject` path (broadcasts via Socket.IO + debounced Firestore save).

**Loading state:** Show "Analyzing..." spinner on the claim's strength badge while in-flight. Track pending claim IDs in a `Set<string>` ref.

**Skip display if overridden:** If `manualStrengthOverride` is set, still call the LLM (keeps `aiStrengthLevel` fresh) but displayed value remains the manual one.

## Manual Override UX

**Location:** `BoardInspectorPanel.tsx`, below the `nodeRole` dropdown. Only visible when selected object has `nodeRole === 'claim'`.

**UI:**
- Label: "Claim Strength"
- Dropdown: Auto (AI) | Weak | Moderate | Strong
- "Auto (AI)" = `manualStrengthOverride` is `undefined`, AI classification used
- Selecting a level sets `manualStrengthOverride`

**Canvas indicator:** Strength badge pill shows effective level. When manually overridden, append asterisk: `STRONG*`, `MODERATE*`, `WEAK*`.

**Heatmap panel indicator:** Level badge gets dotted border when overridden. AI's original classification shown below: "AI suggested: weak".

**Clearing override:** Select "Auto (AI)" from dropdown — removes `manualStrengthOverride`, reverts to AI-generated level.

## Data Flow

```
User edits claim/connection
  → useClaimClassification detects change (3s debounce)
  → POST /api/ai/classify-claim with claim text + connected nodes
  → LLM returns { level, reason }
  → Written to BoardObject.aiStrengthLevel / aiStrengthReason
  → Broadcasts via Socket.IO to all users
  → Badge updates on canvas (unless manualStrengthOverride is set)
```

## Files

**New:**
- `api/ai/classify-claim.ts` — Vercel serverless function
- `src/hooks/useClaimClassification.ts` — change detection + debounced API calls

**Modified:**
- `src/types/board.ts` — add 3 fields to `BoardObject`
- `src/components/BoardInspectorPanel.tsx` — add Claim Strength dropdown for claim nodes
- `src/components/ClaimStrengthPanel.tsx` — show effective level, override indicators
- `src/pages/Board.tsx` — integrate hook, update badge rendering

## Future Extensibility

The API payload includes a placeholder for `documentRefs?: string[]` — when document storage is added to Firestore, the endpoint can fetch and include document content in the LLM prompt without changing the client-side trigger logic.
