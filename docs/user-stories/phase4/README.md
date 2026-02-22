# Phase IV User Stories

This folder tracks Phase IV delivery for litigation-specific product differentiation features while preserving CollabBoard's realtime and AI reliability baseline.

## Workflow Rules

1. Read the story's Pre-Implementation Audit and complete Preparation Phase before coding.
2. Implement one story only.
3. Run local validation (`npm run lint`, `npm run test`, `npm run build`) plus story-specific checks.
4. Commit implementation and docs, then push branch to `origin`.
5. Deploy frontend and socket backend to production for stories that change runtime behavior.
6. Record deployed URLs and commit SHA in story `Checkpoint Result` and in `phase4-checkpoint-log.md`.
7. Stop for manual approval before starting the next story.

## Preparation Phase (Mandatory)

Before coding any Phase IV story:

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

## TDD Rules (Phase IV)

1. Start with failing tests for required behavior.
2. Implement minimal code to pass.
3. Refactor only with green tests.
4. Add regression tests for each discovered bug.

## Story Order

1. `US4-00-phase4-litigation-mode-gap-contracts.md`
2. `US4-01-litigation-intake-dialog-and-case-to-board-builder.md`
3. `US4-02-claim-evidence-graph-and-strength-heatmap.md`
4. `US4-03-ai-contradiction-radar-source-cited.md`
5. `US4-04-board-timeline-replay-session-time-machine.md`
6. `US4-05-presenter-mode-follow-me.md`
7. `US4-06-trial-story-mode-presentation-path.md`
8. `US4-07-phase4-validation-and-signoff.md`

## Definition of Done (Phase IV)

1. Litigation intake-to-board flow is implemented with human approval before apply.
2. Claim-evidence graph scoring and heatmap are deterministic and explainable.
3. Contradiction radar outputs source-cited results with guardrails.
4. Session replay and presenter mode are production-validated for collaboration workflows.
5. Optional trial story mode is delivered or explicitly deferred with rationale.
6. Final signoff story is approved with no blocking gaps.

## Reusable Story Docs

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-TEMPLATE.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-AUTHORING-GUIDE.md`

## Phase IV Evidence Templates

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase4/templates/litigation-intake-sample-template.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase4/templates/contradiction-validation-matrix.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase4/templates/replay-presenter-evidence-template.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase4/templates/phase4-traceability-matrix.md`
