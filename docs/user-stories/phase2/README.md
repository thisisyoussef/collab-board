# Phase II User Stories

This folder tracks Phase II delivery with strict story gates, test-driven development, and mandatory preparation before coding.

## Workflow Rules

1. Read the story's Pre-Implementation Audit and complete Preparation Phase before coding.
2. Implement one story only.
3. Run local validation (`npm run lint`, `npm run test`, `npm run build`) plus story-specific checks.
4. Deploy frontend and socket backend to production.
5. If schema/rules changed, deploy Firestore rules/indexes and verify.
6. Update `phase2-checkpoint-log.md` with links, commit, TDD evidence, and results.
7. Stop for manual approval before starting the next story.

## Preparation Phase (Mandatory)

Before writing code for any Phase II story, complete this sequence:

1. Local Doc Audit
- Read all story-specific local docs first.
- Identify contracts, edge cases, and known anti-patterns.

2. Web Research (Official Sources First)
- Search official docs for each unstable area (API changes, auth behavior, rules syntax, library patterns).
- Prefer primary sources:
  - Socket.IO docs: https://socket.io/docs/v4/
  - Firebase Auth/Firestore docs: https://firebase.google.com/docs
  - React docs: https://react.dev
  - React Router docs: https://reactrouter.com
  - Konva docs: https://konvajs.org/docs/
  - Anthropic docs: https://docs.anthropic.com
- Capture version assumptions and date checked in the story notes.

3. Preparation Output (Required)
- Record a brief "Preparation Notes" block in the story before coding:
  - local docs reviewed
  - web docs checked
  - key decisions/risks
  - planned test list (failing-first)

## TDD Rules (Phase II)

1. Start each story by writing tests that fail for the target behavior.
2. Record the failing test list in the story's `TDD Plan` section.
3. Implement the smallest change set to make tests pass.
4. Refactor while keeping all tests green.
5. Include at least one integration-level test for each story.
6. Keep a story-specific regression list so fixes remain covered.

## Locked Phase II Direction

1. AI agent first.
2. Story-by-story checkpoints.
3. Mixed access model: auth-link and public-link modes.
4. New boards default to private.
5. Roles: owner/editor/viewer.
6. Viewers are strict read-only.
7. AI supports preview mode and auto-apply mode.
8. Anthropic remains provider for this phase.
9. AI apply is allowed only for signed-in editors/owners.
10. Public-link role must be chosen by owner when enabling public mode.

## Story Order

1. `US2-00-phase2-docs-and-contracts.md`
2. `US2-01-ai-command-center.md`
3. `US2-02-object-model-v2-core-primitives.md`
4. `US2-03-ai-execution-engine-and-undo.md`
5. `US2-04-ai-multiplayer-consistency-and-metrics.md`
6. `US2-05-access-control-v2-and-rules.md`
7. `US2-06-sharing-ui-and-membership-workflow.md`
8. `US2-07-dashboard-shared-with-me-and-recents.md`
9. `US2-08-phase2-validation-and-signoff.md`

## Deferred Extra Stories

1. `US2-09-figma-connector-parity.md` (added from user-provided research; intentionally parked for later execution)
2. `US2-10-board-history-undo-redo.md` (full board-level multi-step undo/redo follow-up; now implemented and awaiting user checkpoint)
3. `US2-11-figjam-layout-and-contextual-controls.md` (FigJam-like floating layout + contextual right inspector follow-up; implemented and pending user checkpoint)

## Story Template (Required Sections)

Every story must include:

1. Status
2. Persona (expanded narrative)
3. User Story (at least two persona-centered story statements)
4. Goal
5. Scope (in/out)
6. Pre-Implementation Audit
7. Preparation Phase
8. UX Script
9. Implementation Details
10. TDD Plan
11. Acceptance Criteria
12. Local Validation
13. User Checkpoint Test
14. Checkpoint Result

Reusable references:

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-TEMPLATE.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-AUTHORING-GUIDE.md`

## Definition of Done (Phase II)

1. All stories are approved in sequence.
2. AI command flow is deterministic for core command classes.
3. Access and role model is enforced for board and AI operations.
4. Shared with me and recents are production-verified.
5. Phase II validation matrix is complete in `US2-08` and checkpoint log.
