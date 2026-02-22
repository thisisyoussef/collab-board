# US3-02: Style Controls and Manual Color Editing

## Status

- State: Pending
- Owner: Codex
- Depends on: US3-01 approved

## Persona

**Alex, the Facilitator** needs quick visual formatting controls while running workshops.

**Sam, the Student User** wants to edit note and shape colors without relying on AI commands.

**Jordan, the QA Reviewer** needs predictable style-control behavior by object type.

## User Story

> As Alex, I want contextual style controls so I can quickly format selected content.

> As Sam, I want direct color editing for sticky notes and shapes so I can organize ideas visually.

> As Jordan, I want object-type-aware controls so unsupported edits are safely disabled.

## Goal

Implement manual styling controls to satisfy PRD expectations around editable object appearance, especially sticky note color changes and shape style adjustments.

## Scope

In scope:

1. Color picker or swatch controls for selected objects.
2. Stroke/strokeWidth controls where supported.
3. Text font size controls for text/sticky where applicable.
4. Multi-select shared-style updates.
5. Safe disable states when style is unsupported for selection.
6. Realtime + persistence behavior for style edits.

Out of scope:

1. Full design-token/theme system.
2. Advanced typography tooling beyond core size/color controls.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/index.css`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

## Preparation Phase (Mandatory)

1. Local audit
- Enumerate style-capable fields per object type.
- Map mutation path to ensure AI undo invalidation rules remain correct.

2. Web research (official docs first)
- HTML input accessibility for color/range controls.
- Konva style update performance guidance.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. User selects sticky note.
2. User changes fill color.
3. Canvas updates immediately and syncs to collaborators.
4. User selects line and changes stroke width.
5. User selects text and adjusts font size.

Edge cases:

1. Mixed unsupported selections disable unavailable controls.
2. Invalid color input reverts safely.
3. Style changes while offline reconcile after reconnect.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/StyleControlsPanel.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/components/StyleControlsPanel.test.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Style patch contract:

```ts
interface StylePatch {
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
}
```

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/StyleControlsPanel.test.tsx`
- renders controls for supported selection
- disables unsupported controls

2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- applying color updates selected sticky/shape
- applying stroke width updates line/connector/shape where valid
- style updates propagate realtime and persist

Red -> Green -> Refactor:

1. Add failing UI control-state tests.
2. Add failing board integration tests.
3. Implement minimal style mutation wiring.
4. Refactor style mapping helpers.

## Acceptance Criteria

- [ ] Sticky notes support manual color change.
- [ ] Shapes support manual fill/stroke edits where applicable.
- [ ] Text-like objects support manual font-size edits.
- [ ] Style edits are persisted and synced realtime.
- [ ] Unsupported control combinations are safely disabled.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/components/StyleControlsPanel.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Change sticky and shape colors manually.
2. Verify style updates in second tab.
3. Refresh and verify persistence.
4. Verify disabled controls for unsupported selections.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
