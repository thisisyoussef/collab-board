# Phase III User Stories

This folder tracks Phase III execution to close all remaining PRD requirements and complete submission artifacts.

## Workflow Rules

1. Read the story's Pre-Implementation Audit and complete Preparation Phase before coding.
2. Implement one story only.
3. Run local validation (`npm run lint`, `npm run test`, `npm run build`) plus story-specific checks.
4. Deploy frontend and socket backend to production for stories that change runtime behavior.
5. Record checkpoint evidence in `phase3-checkpoint-log.md`.
6. Stop for manual approval before starting the next story.

## Preparation Phase (Mandatory)

Before coding any Phase III story:

1. Local Doc Audit
- Read story-linked local docs and current implementation.
- Capture current-vs-target behavior.

2. Web Research (Official Sources First)
- Verify unstable external behavior in primary docs:
  - React: https://react.dev
  - Socket.IO: https://socket.io/docs/v4/
  - Firebase Auth/Firestore: https://firebase.google.com/docs
  - Konva: https://konvajs.org/docs/
  - Anthropic: https://docs.anthropic.com
- Record links + date checked in each story.

3. Preparation Output
- Add Preparation Notes before implementation:
  - assumptions
  - risks
  - failing-first tests

## TDD Rules (Phase III)

1. Start with failing tests for required behavior.
2. Implement minimal code to pass.
3. Refactor only with green tests.
4. Add regression tests for each discovered bug.

## Story Order

1. `US3-00-phase3-prd-gap-contracts.md`
2. `US3-01-board-operations-duplicate-copy-paste.md`
3. `US3-02-style-controls-and-manual-color-editing.md`
4. `US3-03-frame-grouping-and-organization-semantics.md`
5. `US3-04-ai-prd-command-validation-and-hardening.md`
6. `US3-05-performance-target-validation-and-scale-checks.md`
7. `US3-06-submission-artifacts-and-release-package.md`
8. `US3-07-final-prd-signoff.md`

## Definition of Done (Phase III)

1. PRD feature requirements are implemented and validated.
2. PRD performance and AI validation matrices are documented with evidence.
3. Required submission artifacts are complete and linked.
4. Final signoff story is approved with no blocking gaps.

## Reusable Story Docs

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-TEMPLATE.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-AUTHORING-GUIDE.md`

## Phase III Evidence Templates

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/templates/prd-traceability-matrix.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/templates/ai-command-validation-matrix.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/templates/performance-evidence-template.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/submission/README.md`
