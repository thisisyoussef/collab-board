# US4-02: Claim-Evidence Graph and Strength Heatmap

## Status

- State: In Progress
- Owner: Codex
- Depends on: US4-01 approved

## Persona

**Alex, the Trial Strategist** needs a fast read on argument strength and weak links.

**Sam, the Team Member** needs consistent tagging semantics so everyone models the case the same way.

**Jordan, the Evaluator** needs deterministic scoring with explainable factors.

## User Story

> As Alex, I want claims scored visually so I can prioritize strategy work.

> As Sam, I want object and connector tags for legal semantics so structure is explicit.

> As Jordan, I want scoring logic to be deterministic and testable.

## Goal

Implement litigation graph metadata, deterministic claim-scoring logic, and a heatmap UI that explains why each claim is strong/medium/weak.

## Scope

In scope:

1. Board object role tagging for legal entities.
2. Connector relation tagging for legal semantics.
3. Graph extraction from current board state.
4. Deterministic claim score computation and level mapping.
5. Heatmap panel and claim-level visual indicators.
6. Explainability output (`reasons`) for each score.

Out of scope:

1. Machine-learned scoring model.
2. Automatic legal conclusion generation.
3. Cross-board graph aggregation.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.test.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`

## Preparation Phase (Mandatory)

1. Local audit
- Verify board object shape extension points and Firestore sanitize/normalize paths.
- Verify inspector patterns for adding role/relation controls.

2. Web research (official docs first)
- React memoization/perf patterns for derived graph state.
- Konva overlay rendering patterns for non-destructive status indicators.

3. Preparation Notes
- assumptions:
  - Existing board object persistence and realtime paths remain the single source of truth.
  - Deterministic scoring is preferred over probabilistic model output for legal explainability.
- risks:
  - Frequent recompute on large boards could add UI overhead if not revision-gated.
  - Connector relation fallbacks (from labels) could conflict with user-authored freeform labels.
- planned failing tests:
  - metadata roundtrip: `nodeRole` / `relationType` survive normalize + sanitize.
  - graph extraction + score cap behavior.
  - inspector controls for role/relation update callbacks.
  - right-rail heatmap integration and empty-state behavior.

## UX Script

Happy path:

1. User selects object and sets `Node role` to claim/evidence/witness/timeline.
2. User selects connector and sets relation type (`supports`, `contradicts`, `depends_on`).
3. Heatmap panel shows all claims with score + level + reasons.
4. Clicking a claim row focuses claim object on canvas.
5. Claim indicators update live as links/tags change.

Edge cases:

1. Untagged objects are ignored by scoring engine.
2. Claims with no links show `weak` with explicit missing-dependency reasons.
3. Invalid relation tags are ignored safely.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/lib/litigation-graph.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/lib/litigation-graph.test.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/ClaimStrengthPanel.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/components/ClaimStrengthPanel.test.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.tsx`
9. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.test.tsx`
10. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
11. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Score contract:

```ts
interface ClaimStrengthResult {
  claimId: string;
  score: number; // 0..100
  level: 'strong' | 'medium' | 'weak';
  supportCount: number;
  contradictionCount: number;
  dependencyGapCount: number;
  reasons: string[];
}
```

Deterministic scoring rule (initial):

1. Base score: 50.
2. +10 per `supports` from evidence/witness/timeline (cap +40).
3. -12 per `contradicts` link (cap -36).
4. -15 per unresolved `depends_on` gap (cap -30).
5. Clamp to 0..100.

Level mapping:

- `>= 70` => strong
- `45..69` => medium
- `< 45` => weak

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`
- litigation metadata survives normalize/sanitize roundtrip

2. `/Users/youss/Development/gauntlet/collab-board/src/lib/litigation-graph.test.ts`
- graph extraction from tagged objects/connectors
- score determinism and level mapping
- explainability reason generation

3. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.test.tsx`
- role/relation controls render and emit updates

4. `/Users/youss/Development/gauntlet/collab-board/src/components/ClaimStrengthPanel.test.tsx`
- claim list rendering and click-to-focus callback

5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- heatmap panel integration + indicator toggle

Red -> Green -> Refactor:

1. Add failing metadata and graph tests.
2. Implement data model extensions + graph engine.
3. Add and wire UI components.
4. Refactor for performance and readability.

## Acceptance Criteria

- [x] Object role and connector relation tags are editable in inspector.
- [x] Board model persists tags through Firestore/realtime roundtrips.
- [x] Claim scoring is deterministic and test-backed.
- [x] Heatmap panel shows score, level, and reasons per claim.
- [x] Canvas indicators are visible and non-destructive.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/lib/board-object.test.ts src/lib/litigation-graph.test.ts src/components/BoardInspectorPanel.test.tsx src/components/ClaimStrengthPanel.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Tag at least 2 claims, 3 evidence nodes, and 2 witness nodes.
2. Link objects with support/contradict/dependency connectors.
3. Verify heatmap values and reason text updates after edits.
4. Validate second-user session sees identical scores and indicators.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes:
  - Added litigation graph metadata to board object model: `nodeRole` + `relationType`.
  - Added deterministic graph pass (`evaluateClaimStrength`) with explainability reasons and score caps.
  - Added `ClaimStrengthPanel` in right rail with click-to-focus claim behavior.
  - Added non-destructive on-canvas claim heatmap indicators (outline + level badge) driven by graph output.
  - TDD evidence:
    - `npm run test -- src/lib/board-object.test.ts src/lib/litigation-graph.test.ts src/components/BoardInspectorPanel.test.tsx src/components/ClaimStrengthPanel.test.tsx src/pages/Board.test.tsx`
    - `npm run lint`
    - `npm run test`
    - `npm run build`
