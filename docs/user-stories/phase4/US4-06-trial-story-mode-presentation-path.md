# US4-06: Trial Story Mode (Presentation Path)

## Status

- State: Pending (Optional)
- Owner: Codex
- Depends on: US4-05 approved

## Persona

**Alex, the Trial Lead** needs a focused presentation path that strips planning noise.

**Sam, the Team Collaborator** needs to prepare frame-by-frame narrative order before walkthrough.

**Jordan, the Reviewer** needs predictable visibility rules and keyboard navigation behavior.

## User Story

> As Alex, I want a guided story mode so I can present argument flow clearly.

> As Sam, I want to choose and order frames that make up the trial narrative.

> As Jordan, I want deterministic controls for enter/exit/navigation and visibility.

## Goal

Provide an optional presentation mode that converts selected frames into a guided story sequence, hiding non-story clutter while preserving board data integrity.

## Scope

In scope:

1. Story frame picker (selected and ordered frames).
2. Story mode toggle and fullscreen-style presentation shell.
3. Next/previous navigation with keyboard shortcuts.
4. Visibility filter showing only story-relevant objects/connectors.
5. Exit flow restoring normal board view.

Out of scope:

1. Courtroom display integrations.
2. Export to slide deck/video.
3. Speaker notes synchronization.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/frame-grouping.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

## Preparation Phase (Mandatory)

1. Local audit
- Review frame containment and child-membership indexing.
- Review keyboard shortcut handling to avoid collisions.

2. Web research (official docs first)
- React keyboard focus and accessibility guidance.
- Konva rendering filters for conditional visibility.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. User opens `Story Mode` setup.
2. User selects and orders frames.
3. User clicks `Start Story`.
4. Story shell opens with frame 1 focused.
5. User advances with arrows/keyboard.
6. User exits story mode and returns to full board.

Edge cases:

1. Empty frame selection blocks start with guidance.
2. Deleted frame in sequence is skipped gracefully.
3. Escape always exits story mode.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useStoryMode.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useStoryMode.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/components/StoryModePanel.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/StoryModePanel.test.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Story contract:

```ts
interface StorySequence {
  id: string;
  frameIds: string[];
  createdAt: number;
}
```

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useStoryMode.test.ts`
- sequence create/update validation
- navigation behavior
- exit/reset behavior

2. `/Users/youss/Development/gauntlet/collab-board/src/components/StoryModePanel.test.tsx`
- frame selection and ordering controls
- start/exit controls

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- story visibility filtering integration
- keyboard navigation/escape handling

Red -> Green -> Refactor:

1. Add failing hook/UI/integration tests.
2. Implement story mode state + panel + filtering.
3. Refactor for readability and shortcut safety.

## Acceptance Criteria

- [ ] Users can create a story sequence from frames.
- [ ] Story mode displays only selected narrative content.
- [ ] Next/previous and keyboard controls work reliably.
- [ ] Exit returns user to unchanged normal board mode.
- [ ] Feature can be deferred explicitly if risk exceeds time budget.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/hooks/useStoryMode.test.ts src/components/StoryModePanel.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Build story from 3+ frames.
2. Run through full navigation cycle.
3. Verify hidden non-story objects are restored on exit.
4. Confirm no regression in normal board editing.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
