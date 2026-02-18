# US2-08: Phase II Validation and Signoff

## Status

- State: Pending
- Owner: Codex
- Depends on: US2-07 approved

## Persona

**Alex, the Product Lead** needs proof that Phase II is production-ready and not just feature-complete.

**Sam, the QA Collaborator** needs a deterministic matrix that validates real user behavior across AI + permissions + collaboration.

**Jordan, the Release Decision Maker** needs concise evidence of pass/fail outcomes and regression safety.

## User Story

> As Alex, I want a rigorous final validation pass so we can sign off Phase II with confidence.

> As Sam, I want each high-risk scenario tested in production so hidden edge cases are surfaced before release.

> As Jordan, I want documented evidence tied to test outcomes so release decisions are objective.

## Goal

Execute full Phase II validation matrix, close blocking defects with test-backed fixes, and publish sign-off evidence in the checkpoint log.

## Scope

In scope:

1. AI preview/auto/undo matrix.
2. Role and visibility matrix.
3. Multiplayer AI convergence and reconnect matrix.
4. Shared dashboard matrix (explicit + recents).
5. Phase I regression sanity checks.
6. Evidence capture and sign-off summary.

Out of scope:

1. New features not required to fix discovered defects.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-01-ai-command-center.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-02-object-model-v2-core-primitives.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-03-ai-execution-engine-and-undo.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-04-ai-multiplayer-consistency-and-metrics.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-05-access-control-v2-and-rules.md`
6. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-06-sharing-ui-and-membership-workflow.md`
7. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-07-dashboard-shared-with-me-and-recents.md`
8. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/phase2-checkpoint-log.md`

## Preparation Phase (Mandatory)

1. Confirm final production URLs and test accounts.
2. Web-check any unstable dependencies/limits relevant to validation (Firebase rules behavior, Socket reconnect behavior, model/API responses).
3. Create final execution checklist with owner, tester, date/time, and expected outcomes.

## Validation Matrix

### AI Workflow Matrix

1. Preview mode no-op before apply.
2. Preview apply mutation correctness.
3. Auto mode immediate mutation correctness.
4. Undo rollback correctness.
5. Invalid action rollback behavior.

### Access Matrix

1. `private`: owner/editor/viewer/non-member/anonymous
2. `auth_link`: owner/editor/viewer/non-member/anonymous
3. `public_link`: owner/editor/viewer/non-member/anonymous
4. AI apply permission for each role/auth combination

### Multiplayer Matrix

1. Two-user concurrent AI commands.
2. Reconnect during AI apply.
3. Duplicate/replayed event resilience.
4. Convergence after rapid mixed operations.

### Dashboard Matrix

1. Explicit shared listing.
2. Recent shared listing.
3. Dedupe and sorting correctness.

### Regression Matrix

1. Phase I cursor/presence stability.
2. Phase I object sync and persistence.
3. Phase I auth and board CRUD baseline.

## UX Script

1. Run matrix with two signed-in users and one anonymous browser session.
2. Capture pass/fail for each scenario in checkpoint log.
3. For any failure, write failing test first and fix-forward.
4. Re-run affected matrix cells after fix.
5. Publish final status: pass with notes, or blocked with explicit remaining risks.

## Implementation Details

Evidence artifacts:

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/phase2-checkpoint-log.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-08-phase2-validation-and-signoff.md`
3. Links/screenshots/log snippets referenced in Notes column

Defect policy:

1. Blocking defects must be fixed before sign-off.
2. Non-blocking defects must be logged with owner and planned follow-up.
3. Every fix should include regression coverage where feasible.

## TDD Plan

1. For each discovered bug, add a failing test first.
2. Implement minimum fix to pass the new test.
3. Re-run full suite and impacted matrix sections.
4. Record `failing test -> fix -> passing test` evidence in checkpoint notes.

## Acceptance Criteria

- [ ] Full matrix executed in production.
- [ ] Blocking defects fixed and retested.
- [ ] Regression suite is green.
- [ ] Final sign-off notes documented.

## Local Validation

1. `npm run lint`
2. `npm run test`
3. `npm run build`

## User Checkpoint Test

1. Run complete validation matrix with agreed accounts/sessions.
2. Confirm each scenario has pass/fail evidence.
3. Approve Phase II sign-off if all blocking gates pass.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
