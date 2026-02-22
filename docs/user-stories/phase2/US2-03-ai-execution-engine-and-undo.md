# US2-03: AI Execution Engine and Undo

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: US2-02 approved

## Persona

**Alex, the Fast Operator** wants AI to execute multi-step board actions instantly.

**Sam, the Risk-Averse Teammate** wants one-click undo after AI changes.

**Jordan, the Debugger** needs deterministic transaction boundaries for reliable troubleshooting.

## User Story

> As Alex, I want AI action plans to mutate the board directly so I can complete repetitive work quickly.

> As Sam, I want transactional undo for AI applies so mistakes are reversible.

> As Jordan, I want execution failures to rollback cleanly so shared boards never land in partial states.

## Goal

Implement AI action execution for all core primitives, supporting preview apply and auto-apply modes, with single-step transactional undo.

## Scope

In scope:

1. Action executor for create/update/delete operations.
2. Support for all object types from US2-02.
3. Preview apply and auto-apply behavior.
4. Single-step undo for latest AI transaction.
5. Rollback behavior for partial failures.

Out of scope:

1. Multiplayer dedupe/idempotency across clients (US2-04).
2. Access role enforcement (US2-05).

## Pre-Implementation Audit

Local sources:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/types/ai.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.ts`
6. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-01-ai-command-center.md`
7. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-02-object-model-v2-core-primitives.md`

## Preparation Phase (Mandatory)

1. Confirm AI action payload assumptions from US2-01 outputs.
2. Web-check official docs for transaction/rollback-friendly patterns:
- state snapshot strategies
- deterministic operation ordering
3. Record Preparation Notes with:
- action normalization rules
- rollback strategy
- invalid action handling policy

### Preparation Notes (Completed February 18, 2026)

Local docs/code reviewed:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/types/ai.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-01-ai-command-center.md`
7. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-02-object-model-v2-core-primitives.md`

Official docs checked:

1. https://react.dev/reference/react/useState
2. https://react.dev/reference/react/useRef
3. https://react.dev/reference/react/useCallback
4. https://konvajs.org/docs/shapes/Line.html
5. https://konvajs.org/docs/shapes/Arrow.html

Key decisions:

1. Use a pure executor (`ai-executor`) that computes next board state and inverse actions before mutating UI state.
2. Apply/rollback atomically by committing a full board snapshot only after successful execution.
3. Track one AI transaction only (single-step undo), and invalidate undo on manual non-AI mutations.
4. Treat unsupported/malformed tool calls as hard execution failures.

## Execution Contract

Normalized action model:

```ts
export type ExecutableAIAction =
  | { kind: 'create'; object: BoardObject }
  | { kind: 'update'; objectId: string; patch: Partial<BoardObject> }
  | { kind: 'delete'; objectId: string };

export interface AIActionPlan {
  planId: string;
  actions: ExecutableAIAction[];
  message: string | null;
}
```

Transaction model:

```ts
export interface AITransaction {
  txId: string;
  actions: ExecutableAIAction[];
  inverseActions: ExecutableAIAction[];
  createdAt: number;
  actorUserId: string;
}
```

## UX Script

1. User submits prompt and gets action plan.
2. In preview mode, user clicks Apply.
3. Plan executes in order; board updates immediately.
4. Undo control appears for last transaction.
5. User clicks Undo and board reverts exactly.
6. In auto mode, apply occurs immediately after response.

Failure path:

1. One action in plan fails validation.
2. Executor halts and rejects commit.
3. User sees failure notice; board remains unchanged.

## Implementation Details

Implemented files:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAIExecutor.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAIExecutor.test.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
9. `/Users/youss/Development/gauntlet/collab-board/src/types/ai.ts`
10. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.ts`

Behavior rules:

1. Preserve action ordering from plan.
2. Assign single `txId` per apply.
3. Invalidate undo when non-AI manual mutation occurs.
4. Auto mode now applies generated actions immediately.
5. Preview mode requires explicit apply.
6. Failed execution never commits partial changes.

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.test.ts`
- applies ordered action list correctly
- builds inverse actions
- fails safely on invalid action and keeps source state intact

2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAIExecutor.test.ts`
- apply commits and enables undo
- undo reverts latest transaction exactly once
- invalid plans report error and avoid commit

3. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.test.tsx`
- apply/undo controls visible and wired

4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- preview mode shows manual apply guidance
- action plan enables apply and keeps undo disabled pre-execution

Red -> Green -> Refactor:

1. Added failing tests for apply, rollback, and undo.
2. Implemented minimal executor/hook logic.
3. Refactored board integration to snapshot-commit + diff-based realtime emission.

## Acceptance Criteria

- [x] Action plans execute correctly for all core primitive types.
- [x] Preview mode requires explicit apply.
- [x] Auto mode applies immediately.
- [x] Undo reverts latest AI transaction exactly once.
- [x] Failed applies rollback partial mutations.

## Local Validation

1. `npm run lint` -> pass
2. `npm run test -- src/lib/ai-executor.test.ts src/hooks/useAIExecutor.test.ts src/components/AICommandCenter.test.tsx src/hooks/useAICommandCenter.test.ts src/pages/Board.test.tsx` -> pass
3. `npm run test` -> pass (28 files, 179 tests)
4. `npm run build` -> pass (Node 18 warning from Vite recommending Node 20.19+ or 22.12+)

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Run three preview-mode prompts and click Apply for each.
2. Undo each apply and verify exact rollback.
3. Switch to Auto mode and run two prompts.
4. Trigger one malformed plan and verify no partial board mutation is committed.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending manual checkpoint
- Notes:
  - Added transaction-based AI executor with inverse action generation and deterministic rollback behavior.
  - Added `useAIExecutor` hook for apply/undo lifecycle and execution feedback.
  - Upgraded AI panel with active Apply/Undo controls and preview/auto guidance.
  - Integrated auto-apply behavior in board flow and manual-apply behavior in preview mode.
  - Fix-forward: removed hardcoded template expansion and replaced it with generic plan-quality behavior in `/api/ai/generate`:
    improved planning instructions + one self-correction pass when complex prompts return under-scoped tool plans.
  - Fix-forward: `/api/ai/generate` now validates required tool inputs and runs one correction pass when the first plan is malformed (for example, missing `width`/`height` on `createShape`).
  - Fix-forward: added explicit `deleteObject` tool contract to API planning so delete plans no longer rely on model guesswork.
  - Fix-forward: executor now tolerates missing `createShape` dimensions by applying defaults, and supports `x2`/`y2` line endpoint inputs.
  - UX tweak: when undo is invalidated by manual edits, the Undo action is now disabled with no "Nothing to undo" error flash.
  - Reliability tweak: board client now sends periodic socket server wake pings (`/health`) while active and keeps status in `connecting` during first cold-start retries to avoid false-offline confusion.
  - Deployed to Vercel production deployment `AhJ5s14VZzPmcuD9xxwQznGpijWa` (aliased to `https://collab-board-iota.vercel.app`) on February 18, 2026.
