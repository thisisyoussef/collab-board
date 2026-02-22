# US3-03: Frame Grouping and Organization Semantics

## Status

- State: Pending
- Owner: Codex
- Depends on: US3-02 approved

## Persona

**Alex, the Planner** uses frames to structure sections and expects organized movement behavior.

**Sam, the Collaborator** wants predictable frame behavior when rearranging board regions.

**Jordan, the QA Reviewer** needs explicit frame-child rules for deterministic testing.

## User Story

> As Alex, I want frames to organize objects as coherent areas so planning boards remain manageable.

> As Sam, I want moving a frame to move its contained objects when grouping mode is enabled.

> As Jordan, I want clear inclusion/exclusion rules so frame interactions are verifiable.

## Goal

Deliver PRD-aligned frame semantics that make frames truly useful for organizing content areas, including explicit child containment behavior and safe transform interactions.

## Scope

In scope:

1. Define frame containment model (`inside` threshold/logic).
2. Track frame-child relationships in runtime state.
3. Optional "move with frame" behavior for contained children.
4. Frame resize updates containment membership.
5. Realtime and persistence compatibility for frame grouping metadata.

Out of scope:

1. Nested frame hierarchy beyond one level (unless required by implementation path).
2. Auto-layout inside frames.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.object-v2.test.tsx`

## Preparation Phase (Mandatory)

1. Local audit
- Review current frame primitive behavior and transform flow.
- Identify safe place to compute containment updates.

2. Web research (official docs first)
- Konva group/transform performance guidance.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. User creates a frame around several objects.
2. Objects become associated with frame.
3. User drags frame; associated objects move together.
4. User resizes frame; membership updates.

Edge cases:

1. Objects partially crossing boundary follow deterministic threshold rule.
2. Deleting frame detaches children without data loss.
3. Remote frame move converges correctly in other clients.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/frame-grouping.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/frame-grouping.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.object-v2.test.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.realtime-v2.test.tsx`

Containment contract:

```ts
interface FrameMembership {
  frameId: string;
  childIds: string[];
  updatedAt: string;
}
```

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/frame-grouping.test.ts`
- containment detection by bounds threshold
- membership update on frame resize

2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.object-v2.test.tsx`
- moving frame moves contained objects when grouping mode active
- deleting frame keeps child objects intact

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.realtime-v2.test.tsx`
- remote frame move/resize keeps membership convergence

Red -> Green -> Refactor:

1. Add failing containment tests.
2. Wire membership updates into frame transforms.
3. Refactor into reusable grouping utility.

## Acceptance Criteria

- [ ] Frames provide explicit content-area grouping behavior.
- [ ] Contained objects move with frame according to contract.
- [ ] Frame resize updates child membership deterministically.
- [ ] Grouping behavior syncs and persists correctly.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/lib/frame-grouping.test.ts src/pages/Board.object-v2.test.tsx src/pages/Board.realtime-v2.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Create frame and place objects inside/outside.
2. Move and resize frame and verify membership behavior.
3. Validate behavior across two browser sessions.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
