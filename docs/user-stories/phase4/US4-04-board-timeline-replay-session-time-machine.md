# US4-04: Board Timeline Replay (Session Time Machine)

## Status

- State: Pending
- Owner: Codex
- Depends on: US4-03 approved

## Persona

**Alex, the Team Lead** needs to replay strategy evolution for review and coaching.

**Sam, the Investigator** needs to inspect who changed what and when.

**Jordan, the QA Reviewer** needs deterministic replay and restore behavior for debugging.

## User Story

> As Alex, I want a timeline scrubber so I can replay board evolution during case prep.

> As Sam, I want state checkpoints so I can inspect and recover previous board states.

> As Jordan, I want replay behavior to be deterministic and safe under realtime collaboration.

## Goal

Implement a session time machine that persists replay-ready snapshots from board action hooks, provides timeline playback/scrubbing UI, and supports explicit checkpoint restore.

## Scope

In scope:

1. Persist replay events/snapshots from existing action-log hooks.
2. Build replay timeline panel with play/pause/scrub.
3. Render board in replay mode without mutating live state.
4. Restore selected checkpoint to live board on explicit confirmation.
5. Protect realtime/persistence behavior during replay mode.

Out of scope:

1. Cross-session diff merge tools.
2. Global analytics storage in BigQuery.
3. Infinite retention without pruning.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-action-log.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-action-log.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardHistory.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/lib/firestore-client.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

## Preparation Phase (Mandatory)

1. Local audit
- Identify all mutation points already emitting detailed action logs.
- Identify safest persistence path for replay artifacts (same board doc vs side-collection).

2. Web research (official docs first)
- React rendering patterns for timeline playback.
- Firestore write-size constraints and document growth limits.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. User opens `Session Time Machine` panel.
2. Timeline list loads events/checkpoints with timestamps and actor labels.
3. User scrubs slider and sees board render historical state.
4. User clicks play to animate event sequence.
5. User clicks `Restore checkpoint` and confirms.
6. Live board is updated to chosen state and synced.

Edge cases:

1. Empty timeline shows clear onboarding state.
2. Replay mode disables editing actions until exit.
3. Restore blocked for viewers.
4. Corrupt snapshot event is skipped with warning.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-action-log.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-action-log.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/session-replay.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/lib/session-replay.test.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/SessionReplayPanel.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/SessionReplayPanel.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Replay artifact contract:

```ts
interface BoardReplayCheckpoint {
  id: string;
  atMs: number;
  actorUserId?: string;
  action: string;
  boardState: Record<string, unknown>;
}
```

Safety rules:

1. Replay mode uses isolated derived state; no live mutation while scrubbing.
2. Restore requires explicit confirmation and editor permission.
3. Snapshot count is capped with pruning policy.
4. Large snapshots are compacted/truncated with warning logs.

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/session-replay.test.ts`
- build ordered timeline from events
- replay state reconstruction correctness
- prune policy behavior

2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-action-log.test.ts`
- snapshot payload generation for replay contract

3. `/Users/youss/Development/gauntlet/collab-board/src/components/SessionReplayPanel.test.tsx`
- play/pause/scrub rendering behavior
- restore button state and confirmation flow

4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- replay mode integration and restore behavior

Red -> Green -> Refactor:

1. Add failing replay utility tests.
2. Add failing panel and Board integration tests.
3. Implement replay data/model and panel wiring.
4. Refactor storage and reconstruction helpers.

## Acceptance Criteria

- [ ] Replay checkpoints are persisted from board action flow.
- [ ] Session replay panel supports scrub and playback.
- [ ] Replay mode does not mutate live board state.
- [ ] Restore checkpoint works for editors and syncs correctly.
- [ ] Snapshot growth is bounded via pruning/limits.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/lib/board-action-log.test.ts src/lib/session-replay.test.ts src/components/SessionReplayPanel.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Perform mixed edits (manual + AI + undo/redo) across 3+ minutes.
2. Open replay panel and scrub across events.
3. Validate replay visuals against known action history.
4. Restore older checkpoint and verify realtime/persistence convergence.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
