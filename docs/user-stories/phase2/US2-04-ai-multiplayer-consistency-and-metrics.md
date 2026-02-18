# US2-04: AI Multiplayer Consistency and Metrics

## Status

- State: Pending
- Owner: Codex
- Depends on: US2-03 approved

## Persona

**Alex, the Host** expects all participants to see identical AI results.

**Sam, the Co-Editor** might run AI commands simultaneously and expects no duplicates or desync.

**Jordan, the Operator** needs metrics to diagnose performance and consistency issues quickly.

## User Story

> As Alex, I want AI changes to converge for everyone on the board so collaboration remains trustworthy.

> As Sam, I want concurrent AI commands to resolve deterministically without duplicate mutations.

> As Jordan, I want visibility into AI latency and dedupe behavior so issues can be detected early.

## Goal

Add transaction metadata, idempotency controls, and AI metrics so multiplayer AI operations remain deterministic and observable.

## Scope

In scope:

1. Realtime metadata propagation (`txId`, `source`, `actorUserId`).
2. Dedupe/idempotency safeguards for repeated or replayed events.
3. Stale update rejection using timestamps.
4. AI metrics in overlay/checkpoint notes.

Out of scope:

1. Access control/rules changes (US2-05).
2. Sharing UI/dashboard changes.

## Pre-Implementation Audit

Local sources:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
2. `/Users/youss/Development/gauntlet/collab-board/server/index.js`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/MetricsOverlay.tsx`

## Preparation Phase (Mandatory)

1. Review current realtime event lifecycle from client emit to server rebroadcast.
2. Web-check official docs for:
- Socket.IO delivery semantics and reconnect behavior
- practical idempotency strategies for websocket events
3. Record Preparation Notes with:
- dedupe key design
- cache TTL strategy
- stale-event resolution policy

## Consistency Contract

1. One AI apply corresponds to one `txId`.
2. Every emitted object event includes optional metadata fields.
3. Client dedupe signature includes event type + txId + objectId + timestamp.
4. Old/stale updates are discarded if local `updatedAt` is newer.

## Metrics Contract

Track and display:

1. `AI apply avg (ms)`
2. `AI applies count`
3. `AI dedupe drops`

## UX Script

1. User A runs AI command producing multiple object updates.
2. User B sees those updates once, in deterministic final state.
3. User B runs overlapping command; both clients converge.
4. Metrics panel reflects applies and dedupe behavior.
5. Reconnect/replay does not produce duplicate objects.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/realtime-dedupe.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/MetricsOverlay.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/server/index.js`

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/realtime-dedupe.test.ts`
- first event accepted, exact duplicate rejected
- cache TTL expiry behavior

2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.ai-realtime.test.tsx`
- duplicate events do not double-apply
- stale updates are ignored
- concurrent AI events converge

3. `/Users/youss/Development/gauntlet/collab-board/server/index.test.js`
- metadata preserved in rebroadcast payloads

Red -> Green -> Refactor:

1. Add failing dedupe and stale-order tests.
2. Implement dedupe layer and guards.
3. Refactor metrics collection and event parsing.

## Acceptance Criteria

- [ ] Metadata fields propagate end-to-end.
- [ ] Replay/duplicate events do not duplicate board mutations.
- [ ] Concurrent AI applies converge across clients.
- [ ] Metrics panel includes AI apply and dedupe metrics.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/lib/realtime-dedupe.test.ts src/pages/Board.ai-realtime.test.tsx server/index.test.js`
3. `npm run test`
4. `npm run build`

## User Checkpoint Test

1. Open same board in two tabs/users.
2. Run overlapping AI commands from both users.
3. Confirm identical final state and no duplicate objects.
4. Confirm AI metrics are visible and updating.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
