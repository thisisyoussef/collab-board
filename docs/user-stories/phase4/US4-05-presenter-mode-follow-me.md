# US4-05: Presenter Mode (Follow Me)

## Status

- State: Pending
- Owner: Codex
- Depends on: US4-04 approved

## Persona

**Alex, the Presenter** needs to lead the team through a case map without asking everyone to pan manually.

**Sam, the Participant** needs opt-in following with a quick escape path.

**Jordan, the Realtime Reviewer** needs robust viewport sync behavior under reconnect and multi-user conditions.

## User Story

> As Alex, I want to broadcast my viewport so teammates can follow live walkthroughs.

> As Sam, I want to opt in and opt out of follow mode safely.

> As Jordan, I want consistent sync semantics and clean handoff behavior.

## Goal

Implement presenter mode with viewport broadcast, participant opt-in follow mode, escape controls, and resilient realtime behavior.

## Scope

In scope:

1. Presenter toggle and broadcast state.
2. Viewport sync socket event protocol.
3. Participant follow opt-in/opt-out controls.
4. Escape handling and manual override.
5. Presenter handoff behavior.
6. Reconnect recovery for presenter/follower states.

Out of scope:

1. Voice/video conferencing features.
2. Recording presenter sessions.
3. Multi-presenter simultaneous broadcast.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useSocket.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
3. `/Users/youss/Development/gauntlet/collab-board/server/index.js`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/lib/viewport.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useSocket.test.tsx`

## Preparation Phase (Mandatory)

1. Local audit
- Review viewport persistence/read/write behavior and stage transform lifecycle.
- Review socket auth/join flows for room-scoped presenter state events.

2. Web research (official docs first)
- Socket.IO event delivery patterns and reconnection semantics.
- Konva stage transform update best practices.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. Presenter enables `Presenter Mode`.
2. Other users see banner: `Alex is presenting` with `Follow` button.
3. Follower opts in.
4. Presenter pans/zooms; follower viewport mirrors in near realtime.
5. Follower presses `Esc` (or toggle) to stop following.

Edge cases:

1. Presenter disconnects -> followers auto-exit follow mode.
2. New presenter takeover -> followers prompted to follow new presenter.
3. Viewer role can follow but cannot start presenter mode.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
2. `/Users/youss/Development/gauntlet/collab-board/server/index.js`
3. `/Users/youss/Development/gauntlet/collab-board/server/index.test.js`
4. `/Users/youss/Development/gauntlet/collab-board/src/hooks/usePresenterMode.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/hooks/usePresenterMode.test.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/PresenterBanner.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/components/PresenterBanner.test.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
9. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Realtime contract:

```ts
interface PresenterViewportPayload {
  boardId: string;
  presenterUserId: string;
  x: number;
  y: number;
  scale: number;
  _ts: number;
}
```

Rules:

1. Only one active presenter per board room.
2. Broadcast interval is throttled to prevent update storms.
3. Followers must explicitly opt in; no forced takeover.
4. `Esc` always exits follow mode immediately.

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/server/index.test.js`
- presenter state announce/clear
- viewport broadcast routing
- disconnect cleanup behavior

2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/usePresenterMode.test.tsx`
- follow opt-in/out flow
- escape handling
- reconnect/presenter handoff behavior

3. `/Users/youss/Development/gauntlet/collab-board/src/components/PresenterBanner.test.tsx`
- banner states and action callbacks

4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- integration of presenter controls and follower viewport updates

Red -> Green -> Refactor:

1. Add failing server event tests.
2. Add failing hook/UI tests.
3. Implement socket protocol + hook + banner.
4. Refactor throttling and cleanup logic.

## Acceptance Criteria

- [ ] Presenter mode can be started/stopped by eligible users.
- [ ] Followers can opt in and mirror presenter viewport.
- [ ] Followers can exit instantly via toggle or Escape.
- [ ] Presenter disconnect/handoff behavior is graceful.
- [ ] Reconnect behavior restores correct presenter/follow states.

## Local Validation

1. `npm run lint`
2. `npm run test -- server/index.test.js src/hooks/usePresenterMode.test.tsx src/components/PresenterBanner.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Start presenter mode in one browser.
2. Follow from second browser and verify viewport sync.
3. Exit follow mode with Escape.
4. Re-enable follow and simulate presenter disconnect.
5. Verify followers recover and can continue normal navigation.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
