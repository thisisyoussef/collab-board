# US2-10: Board History Undo and Redo (Deferred Extra Story)

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: US2-04 approved
- Priority: High usability follow-up

## Persona

**Alex, the Fast Collaborator** needs quick recovery from accidental moves, deletes, and transforms during live sessions.

**Sam, the Cautious Writer** needs confidence to experiment because every recent change can be undone and re-applied safely.

**Jordan, the QA Reviewer** needs deterministic undo/redo rules so behavior is testable across manual edits and AI mutations.

## User Story

> As Alex, I want board-level undo/redo so I can recover from mistakes instantly without rebuilding work.

> As Sam, I want redo after undo so I can compare alternatives and keep the version I prefer.

> As Jordan, I want clear history boundaries so team behavior is consistent and verifiable.

## Goal

Add multi-step board history with explicit Undo and Redo controls for local edits, AI applies, and object-level operations, while preserving stable realtime behavior and persistence.

## Scope

In scope:

1. Local history stack with multi-step undo/redo.
2. History entries for create, update, delete, transform, and text edits.
3. Integration with AI apply flow so AI mutations become history transactions.
4. Toolbar/UI controls for Undo and Redo with disabled states.
5. Deterministic redo invalidation when a new mutation occurs after undo.

Out of scope:

1. Cross-user shared global history (each client keeps local history view).
2. Time-travel timeline UI beyond basic Undo/Redo controls.
3. Keyboard shortcut support for undo/redo (can be scoped later).

## Pre-Implementation Audit

Local sources to review before coding:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/ai.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAIExecutor.ts`
7. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/docs/react-konva.md`
9. `/Users/youss/Development/gauntlet/collab-board/docs/konva-api.md`
10. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-03-ai-execution-engine-and-undo.md`
11. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-04-ai-multiplayer-consistency-and-metrics.md`

## Preparation Phase (Mandatory)

1. Local design/code audit:
- map all mutation entry points in `Board.tsx` (manual + AI paths).
- identify current AI undo transaction model and invalidation points.

2. Web research pass (official docs first):
- React state/history patterns for undo/redo reducers.
- Konva transform and drag lifecycle guidance.
- Firestore write cadence considerations for rapid rollback/reapply sequences.

3. Required preparation output in this story before coding:
- docs checked (local + web links, date checked)
- chosen history representation and memory limits
- snapshot vs inverse-operation strategy decision
- failing-first test list
- risk and fallback notes

### Preparation Notes

Local docs reviewed:
1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx` (all persisted mutation paths + AI commit path)
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAIExecutor.ts` (AI transaction apply/undo semantics)
3. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-03-ai-execution-engine-and-undo.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-04-ai-multiplayer-consistency-and-metrics.md`

Web docs checked (official sources, checked February 19, 2026):
1. React reducer/state guidance: https://react.dev/learn/extracting-state-logic-into-a-reducer
2. Konva event model: https://konvajs.org/docs/events/Binding_Events.html
3. Konva transform lifecycle: https://konvajs.org/docs/select_and_transform/Basic_demo.html
4. Firestore update patterns: https://firebase.google.com/docs/firestore/manage-data/add-data#update-data

Decisions:
1. Use snapshot-based local history entries (`before` + `after`) to guarantee deterministic undo/redo.
2. Keep history client-local only; no cross-user global timeline.
3. Invalidate local history on full external board rehydrate (initial load, reconnect resync, background board reload) to avoid replaying stale snapshots over remote refreshes.
4. Track long interactions (drag/transform/draft shape/connector) as single history transactions by capturing baseline at interaction start and committing on persist boundary.

## History Contract (Implemented)

```ts
export interface BoardHistoryEntry {
  id: string;
  source: 'manual' | 'ai';
  createdAt: number;
  before: Record<string, BoardObject>;
  after: Record<string, BoardObject>;
}

export interface BoardHistoryTransition {
  direction: 'undo' | 'redo';
  entry: BoardHistoryEntry;
  from: Record<string, BoardObject>;
  to: Record<string, BoardObject>;
}
```

Transaction rules:

1. Every committed mutation pushes one entry to `undoStack`.
2. `redoStack` is cleared on any new mutation after an undo.
3. Undo pops from `undoStack`, applies `before`, pushes entry to `redoStack`.
4. Redo pops from `redoStack`, applies `after`, pushes entry to `undoStack`.
5. New commit after any undo clears `redoStack`.
6. No-op snapshots are ignored (no history entry recorded).

## UX Script

Happy path:

1. User creates/edits objects.
2. Undo button becomes enabled after first committed mutation.
3. User clicks Undo repeatedly to step backward through recent edits.
4. User clicks Redo to re-apply reverted edits.
5. User performs a new edit after undo; Redo is cleared.

Edge cases:

1. Undo while disconnected should still apply locally and sync on reconnect.
2. AI auto-apply transaction should be undoable and redoable as one unit.
3. Undo/Redo controls remain disabled when stacks are empty.

## Implementation Details (Shipped)

Shipped files:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardHistory.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardHistory.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.test.tsx`

Data flow:

1. Mutation entry points capture baseline snapshots (create/delete/update/text edit/drag/transform/connector edit).
2. Persisted mutation boundaries commit one history entry (`source: manual`) with `{ before, after }`.
3. AI apply commits one history entry (`source: ai`) per applied AI transaction.
4. Undo/Redo transitions rehydrate target snapshot, compute board diff (`created/updated/deleted`), emit realtime updates, and flush save.
5. Topbar `Undo`/`Redo` controls and AI panel `Undo last change` reflect stack availability via disabled states.

## TDD Plan

Failing-first tests added and driven to green:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardHistory.test.ts`
- pushes entries on commit, ignores no-op commits, and caps stack length
- undo/redo transitions update both stacks correctly
- new commit after undo clears redo stack
- snapshots are immutable against caller mutation

2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- Undo/Redo controls render in topbar and start disabled
- AI undo control label updated to `Undo last change`

3. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.test.tsx`
- validates new undo control label and callback behavior remains intact

Red -> Green -> Refactor:

1. Added failing history-hook tests for stack semantics and snapshot immutability.
2. Implemented `useBoardHistory` and wired board mutation boundaries.
3. Updated UI/tests for undo control semantics and topbar controls.
4. Refactored baseline capture + commit helpers in board mutation pipeline.

## Acceptance Criteria

- [x] Multi-step undo and redo work for manual board edits.
- [x] AI applies are represented as single undo/redo transactions.
- [x] Redo is cleared when a new mutation occurs after undo.
- [x] Undo/Redo controls always reflect actual stack state.
- [x] Persistence/realtime remain consistent after undo/redo operations.

## Local Validation (When Implemented)

1. `npm run lint` ✅
2. `npm run test -- src/hooks/useBoardHistory.test.ts src/components/AICommandCenter.test.tsx src/pages/Board.test.tsx src/hooks/useAIExecutor.test.ts` ✅
3. `npm run test` ✅ (37 files, 247 tests)
4. `npm run build` ✅ (Node/Vite version warning + chunk-size warning only)

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test (When Implemented)

1. Create three manual mutations, then undo three times and verify exact rollback order.
2. Redo three times and verify exact re-apply order.
3. Undo once, perform a new edit, confirm Redo is disabled immediately.
4. Run one AI apply, undo once, redo once, verify one-step atomic transaction boundaries.
5. Refresh after undo/redo and confirm converged board state persists.
6. Open second tab, verify undo/redo emits and converges via realtime.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending
- Notes:
  - Shipped bounded local history with baseline capture for drag/transform/draft interactions.
  - External full board rehydrate (initial load/reconnect/background board reload) resets local history stacks intentionally.
