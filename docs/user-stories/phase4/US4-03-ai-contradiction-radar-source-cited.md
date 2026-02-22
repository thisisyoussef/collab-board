# US4-03: AI Contradiction Radar (Source-Cited)

## Status

- State: Pending
- Owner: Codex
- Depends on: US4-02 approved

## Persona

**Alex, the Deposition Lead** needs fast contradiction discovery across witness/evidence notes.

**Sam, the Collaborator** needs source-cited outputs that can be verified quickly.

**Jordan, the Risk Reviewer** needs strict guardrails to prevent ungrounded AI claims from being applied.

## User Story

> As Alex, I want AI to suggest contradictions so I can focus review on high-impact conflicts.

> As Sam, I want every contradiction linked to source quotes and page/line references.

> As Jordan, I want confidence and citation validation before any contradiction object can be created.

## Goal

Deliver a contradiction radar workflow that analyzes selected witness/evidence nodes, returns structured source-cited contradictions, and applies only user-approved items above a configurable confidence threshold.

## Scope

In scope:

1. Contradiction radar trigger for selected litigation nodes.
2. Dedicated contradiction analysis API endpoint.
3. Structured output schema with required citations.
4. Confidence threshold control and review queue.
5. Accept/reject per contradiction before apply.
6. Apply flow creating contradiction cards/connectors with citation metadata.

Out of scope:

1. Automatic contradiction application.
2. Full legal opinion generation.
3. Background async processing pipeline.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/types/ai.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-generate.test.ts`

## Preparation Phase (Mandatory)

1. Local audit
- Review current AI auth/access checks and structured tool-call validation patterns.
- Identify safest insertion point for contradiction-specific endpoint and client hook.

2. Web research (official docs first)
- Anthropic structured output and validation patterns.
- Firebase auth validation behavior for serverless endpoints.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. User selects witness/evidence nodes.
2. User clicks `Run Contradiction Radar`.
3. Panel displays contradictions with:
   - topic
   - source A quote + citation
   - source B quote + citation
   - confidence
   - rationale
4. User sets confidence threshold (default 0.70).
5. User accepts/rejects each result.
6. User clicks `Apply accepted`.
7. Board creates contradiction cards and relation connectors.

Edge cases:

1. Missing/invalid citation fields => item blocked from apply.
2. No contradictions found => informative empty state.
3. Endpoint timeout/failure => retry flow without board changes.
4. Viewer role cannot run/apply radar.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/api/ai/contradictions.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-contradictions.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useContradictionRadar.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useContradictionRadar.test.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/ContradictionRadarPanel.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/ContradictionRadarPanel.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Response contract:

```ts
interface ContradictionCandidate {
  id: string;
  topic: string;
  confidence: number; // 0..1
  rationale: string;
  sourceA: {
    objectId: string;
    label: string;
    quote: string;
    citation: { page?: string; line?: string; ref: string };
  };
  sourceB: {
    objectId: string;
    label: string;
    quote: string;
    citation: { page?: string; line?: string; ref: string };
  };
}
```

Guardrails:

1. Reject result if either source citation/ref is missing.
2. Reject result if sourceA.objectId == sourceB.objectId.
3. Reject result if quote length is below minimum signal threshold.
4. Enforce `maxCandidates` and input size limits.
5. Require signed-in editor role for both analyze and apply.

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-contradictions.test.ts`
- auth/access checks
- citation-required schema validation
- confidence range and source uniqueness validation
- error/timeout handling

2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useContradictionRadar.test.ts`
- threshold filtering
- accept/reject state transitions
- apply payload generation from accepted items

3. `/Users/youss/Development/gauntlet/collab-board/src/components/ContradictionRadarPanel.test.tsx`
- rendering cards
- threshold control
- apply disabled when no valid accepted items

4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- run/apply integration and no-auto-apply guard

Red -> Green -> Refactor:

1. Add failing endpoint contract tests.
2. Add failing UI/hook tests.
3. Implement endpoint + hook + panel.
4. Wire into Board apply flow.
5. Refactor shared validation helpers.

## Acceptance Criteria

- [ ] Contradiction radar runs only for signed-in editors.
- [ ] Every returned contradiction includes source-cited quotes.
- [ ] Confidence threshold and accept/reject review works.
- [ ] No contradiction is applied without explicit user action.
- [ ] Applied contradictions create board objects with citation metadata.
- [ ] Invalid/low-signal contradictions are blocked by guardrails.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/api/ai-contradictions.test.ts src/hooks/useContradictionRadar.test.ts src/components/ContradictionRadarPanel.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Select witness/evidence nodes with conflicting quotes.
2. Run radar and verify citations/confidence display.
3. Reject one item, accept one item, apply accepted.
4. Verify created contradiction card metadata and connectors.
5. Confirm second client sees realtime result and can undo via history.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
