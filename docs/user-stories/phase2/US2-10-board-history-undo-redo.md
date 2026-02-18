# US2-10: Board History Undo and Redo (Deferred Extra Story)

## Status

- State: Deferred Backlog (Planned, not started)
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

- Pending implementation kickoff.
- This story is intentionally parked as a follow-up backlog item.

## History Contract (Planned)

```ts
export interface BoardHistoryEntry {
  id: string;
  source: 'manual' | 'ai';
  createdAt: number;
  before: Record<string, BoardObject>;
  after: Record<string, BoardObject>;
}

export interface BoardHistoryState {
  undoStack: BoardHistoryEntry[];
  redoStack: BoardHistoryEntry[];
  maxEntries: number;
}
```

Transaction rules:

1. Every committed mutation pushes one entry to `undoStack`.
2. `redoStack` is cleared on any new mutation after an undo.
3. Undo pops from `undoStack`, applies `before`, pushes entry to `redoStack`.
4. Redo pops from `redoStack`, applies `after`, pushes entry to `undoStack`.

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

## Implementation Details (Planned)

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardHistory.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardHistory.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAIExecutor.ts`

Data flow:

1. Mutation commit path emits `{ before, after, source }` into history hook.
2. History hook maintains bounded stacks and exposes `undo`, `redo`, `canUndo`, `canRedo`.
3. Undo/Redo apply full board snapshot through existing board diff emitter/persistence path.
4. Realtime messages are emitted only from committed current state after undo/redo apply.

## TDD Plan

Write failing tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardHistory.test.ts`
- pushes entries on commit and caps stack length
- undo/redo transitions update both stacks correctly
- new commit after undo clears redo stack

2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- Undo/Redo controls render disabled when no history exists
- local mutation enables Undo and drives visible board rollback
- redo re-applies reverted board mutation

3. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAIExecutor.test.ts`
- AI apply writes a single history transaction
- undo/redo around AI transaction remains atomic

Red -> Green -> Refactor:

1. Add failing tests for stack behavior and board integration.
2. Implement minimal history hook and board wiring.
3. Refactor commit-path duplication after tests pass.
4. Add regression tests for bugs found during manual checkpoint.

## Acceptance Criteria

- [ ] Multi-step undo and redo work for manual board edits.
- [ ] AI applies are represented as single undo/redo transactions.
- [ ] Redo is cleared when a new mutation occurs after undo.
- [ ] Undo/Redo controls always reflect actual stack state.
- [ ] Persistence/realtime remain consistent after undo/redo operations.

## Local Validation (When Implemented)

1. `npm run lint`
2. `npm run test -- src/hooks/useBoardHistory.test.ts src/hooks/useAIExecutor.test.ts src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## User Checkpoint Test (When Implemented)

1. Create three mutations, then undo three times and verify exact rollback.
2. Redo three times and verify exact re-apply order.
3. Undo once, perform a new edit, confirm Redo is disabled.
4. Run one AI apply, undo once, redo once, verify transaction boundaries.
5. Repeat with two browser sessions and verify state convergence after reconnect.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes:
  - Added as deferred Phase II backlog story for full board-level undo/redo (beyond AI-only undo in US2-03).
