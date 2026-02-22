# US3-04: AI PRD Command Validation and Hardening

## Status

- State: Pending
- Owner: Codex
- Depends on: US3-03 approved

## Persona

**Alex, the Demo Presenter** needs high-confidence AI behavior on canonical PRD prompts.

**Sam, the Collaborator** needs multi-step AI output that is reliable during shared sessions.

**Jordan, the Evaluator** needs objective proof that PRD AI criteria are met.

## User Story

> As Alex, I want the AI agent to reliably execute PRD prompt categories so demos and evaluations pass.

> As Sam, I want complex template requests to produce complete multi-step board output.

> As Jordan, I want a repeatable validation matrix with pass/fail evidence.

## Goal

Close PRD AI requirements by implementing and validating a command matrix covering creation, manipulation, layout, and complex template prompts with deterministic outcomes.

## Scope

In scope:

1. Build PRD-aligned AI command matrix and expected outcomes.
2. Harden tool-plan generation and action translation for under-scoped plans.
3. Validate command breadth (6+ distinct command types) and multi-step behavior.
4. Validate shared AI state behavior across multiple users.
5. Publish evidence table for each required PRD example.

Out of scope:

1. Switching model providers.
2. New non-PRD tool families.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.ts`
5. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-03-ai-execution-engine-and-undo.md`
6. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-04-ai-multiplayer-consistency-and-metrics.md`

## Preparation Phase (Mandatory)

1. Local audit
- Review existing tool schema and executor behavior.
- Identify failure classes: under-scoped plans, invalid references, partial execution.

2. Web research (official docs first)
- Anthropic tool-use planning patterns and reliability guidance.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

1. User submits PRD creation prompt.
2. AI returns complete actionable plan.
3. User applies and sees expected board state.
4. User submits layout/complex prompt and sees multi-step output.
5. Two users submit overlapping prompts and converge.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-generate.test.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.test.ts`
5. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/US3-04-ai-prd-command-validation-and-hardening.md`
6. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/templates/ai-command-validation-matrix.md`

Validation contract:

```ts
interface AIPRDCase {
  id: string;
  prompt: string;
  expectedSignals: string[];
  pass: boolean;
  evidence: string;
}
```

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-generate.test.ts`
- complex prompt expansion behavior
- malformed plan handling

2. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.test.ts`
- multi-step plan atomicity
- invalid reference rollback behavior

3. PRD prompt matrix test harness (new test file)
- creation/manipulation/layout/complex categories
- minimum 6 command-type coverage check

Red -> Green -> Refactor:

1. Add failing matrix and reliability tests.
2. Implement planning/execution hardening.
3. Refactor prompt-quality helper logic.

## Acceptance Criteria

- [ ] PRD command categories are all validated with passing evidence.
- [ ] At least 6 distinct command types are demonstrated.
- [ ] Complex prompts produce multi-step plans and expected board structures.
- [ ] AI shared-state behavior converges in multi-user scenarios.
- [ ] Failure cases do not produce partial persistent corruption.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/api/ai-generate.test.ts src/lib/ai-executor.test.ts`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Run full PRD AI prompt matrix in production.
2. Record pass/fail + screenshot/video evidence per case.
3. Verify two-user simultaneous AI behavior for convergence.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
