# US4-00: Phase IV Litigation Mode Gap Contracts

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: Phase III complete
- Closes: Planning/contract story (no runtime gap directly closed)

## Persona

**Alex, the Product Owner** needs a single source of truth mapping every Phase IV differentiation objective to executable stories.

**Sam, the Implementer** needs deterministic sequencing and acceptance contracts to avoid overlap across realtime, AI, and UX-heavy features.

**Jordan, the Reviewer** needs measurable closure criteria for each gap so approvals remain checkpoint-driven.

## User Story

> As Alex, I want a complete Phase IV gap map so advanced features land without destabilizing core collaboration.

> As Sam, I want every differentiation feature split into clear implementation stories with explicit test-first gates.

> As Jordan, I want an auditable ownership matrix with objective pass/fail criteria before signoff.

## Goal

Establish a decision-complete Phase IV execution contract for litigation-mode differentiation features: intake-to-board generation, claim-evidence intelligence, contradiction radar guardrails, replay, presenter workflows, optional story mode, and final validation signoff.

## Scope

In scope:

1. Gap mapping for all requested Phase IV features.
2. Dependency chain and story order (US4-00 through US4-07).
3. Ownership and acceptance evidence definitions.
4. Preparation notes with local and official web references.
5. Checkpoint gating criteria for each downstream story.

Out of scope:

1. Runtime feature implementation code.
2. New deployment topology changes.
3. Billing/commercial packaging work.

## Pre-Implementation Audit

Local docs and code reviewed:

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/README.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/phase3-checkpoint-log.md`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-action-log.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
7. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`

## Preparation Phase (Mandatory)

1. Local audit
- Existing board runtime architecture and event hooks were reviewed for extension points.
- Existing AI endpoint/tooling and executor flow were reviewed for safe guardrail extensions.
- Existing story/checkpoint conventions were reviewed for format parity.

2. Web research (official docs first)
- React docs: [https://react.dev](https://react.dev)
- Socket.IO docs: [https://socket.io/docs/v4/](https://socket.io/docs/v4/)
- Firebase docs: [https://firebase.google.com/docs](https://firebase.google.com/docs)
- Konva docs: [https://konvajs.org/docs/](https://konvajs.org/docs/)
- Anthropic docs: [https://docs.anthropic.com](https://docs.anthropic.com)

3. Preparation Notes (Completed February 22, 2026)
- assumptions:
  - Phase III baseline (realtime + AI + inspector + history) remains regression-locked.
  - Litigation features are additive and optional in UX, not required for generic board usage.
- risks:
  - Board.tsx complexity can increase quickly if feature logic is not modularized.
  - Replay and presenter features can conflict with viewport persistence without strict state boundaries.
  - Contradiction radar quality can degrade if citation schema is weak.
- open questions:
  - Whether story mode ships in this phase or is explicitly deferred remains checkpoint-driven in US4-06.
- planned failing tests for downstream stories:
  - US4-01: intake payload validation, deterministic board generation layout tests.
  - US4-02: graph extraction/scoring determinism tests.
  - US4-03: citation guardrail and confidence threshold tests.
  - US4-04: replay timeline build/restore tests.
  - US4-05: follow-me event sync and opt-in/escape tests.
  - US4-06: story-frame sequence visibility filtering tests.

## Complete Phase IV Gap Analysis

### Requested Feature Gaps

| Gap ID | Requirement | Current State | Story Owner |
|---|---|---|---|
| H1 | Specialized intake dialog for litigation inputs | Not implemented | US4-01 |
| H2 | Intake guidance/examples + upload-oriented UX | Not implemented | US4-01 |
| H3 | AI-assisted intake parsing into structured board schema | Not implemented | US4-01 |
| H4 | Human-approve apply flow from intake preview to board state | Not implemented | US4-01 |
| H5 | Node role tagging (`claim`, `evidence`, `witness`, `timeline_event`) | Not implemented | US4-02 |
| H6 | Connector relation tagging (`supports`, `contradicts`, `depends_on`) | Not implemented | US4-02 |
| H7 | Deterministic claim scoring engine | Not implemented | US4-02 |
| H8 | Strength heatmap UI + explainability panel | Not implemented | US4-02 |
| H9 | AI contradiction radar from selected sources | Not implemented | US4-03 |
| H10 | Citation-required contradiction schema guardrails | Not implemented | US4-03 |
| H11 | Confidence threshold + review/accept/reject workflow | Not implemented | US4-03 |
| H12 | Contradiction object creation with source refs | Not implemented | US4-03 |
| H13 | Access/rate/size guardrails for contradiction endpoint | Not implemented | US4-03 |
| H14 | Persist replay-ready snapshots/event timeline from board actions | Partially available via logs, not persisted as replay artifact | US4-04 |
| H15 | Session Time Machine replay panel with scrub controls | Not implemented | US4-04 |
| H16 | Restore checkpoint from replay timeline | Not implemented | US4-04 |
| H17 | Replay safety/perf rules (caps, pruning, fallback) | Not implemented | US4-04 |
| H18 | Presenter viewport broadcast event protocol | Not implemented | US4-05 |
| H19 | Follow-me opt-in UX + escape handling | Not implemented | US4-05 |
| H20 | Presenter handoff and multi-user conflict behavior | Not implemented | US4-05 |
| H21 | Trial Story Mode frame sequencing | Not implemented | US4-06 |
| H22 | Presentation filtering (hide non-story elements) | Not implemented | US4-06 |
| H23 | Phase IV validation evidence matrix and docs updates | Not implemented | US4-07 |
| H24 | Final Phase IV GO/NO-GO signoff | Not implemented | US4-07 |

## Story Dependency Chain

1. US4-00 -> Phase IV contracts and ownership map.
2. US4-01 -> intake-to-board entrypoint and safe apply flow.
3. US4-02 -> graph metadata + deterministic scoring foundation.
4. US4-03 -> contradiction intelligence built on role-tagged graph primitives.
5. US4-04 -> replay/time machine built on action logging and board state snapshots.
6. US4-05 -> presenter mode viewport sync on top of stable realtime hooks.
7. US4-06 -> optional story mode built on frame organization and graph semantics.
8. US4-07 -> final matrix and signoff.

## TDD Plan

This is a docs/contracts story; TDD implementation starts in US4-01. Required test-first protocol for all downstream stories:

1. Add failing tests before code changes.
2. Implement minimum code to pass.
3. Refactor only on green.
4. Add regression tests for every discovered bug.
5. Record red->green evidence in story doc + checkpoint log.

## Acceptance Criteria

- [ ] All Phase IV gaps are explicitly listed and uniquely mapped.
- [ ] No Phase IV gap is unowned.
- [ ] Dependency chain is explicit and execution-ready.
- [ ] Preparation notes include local and official web references.
- [ ] Downstream TDD protocol is explicit and enforceable.

## Local Validation

1. Doc lint/manual structure pass against Phase III format.
2. Link/path verification for all story references.
3. Phase IV folder/index links verified from `/docs/user-stories/README.md`.

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Review H1-H24 mapping and confirm scope is correct.
2. Confirm story order and dependency chain.
3. Approve US4-01 start.

## Checkpoint Result

- Production Frontend URL: N/A (docs-only story)
- Production Socket URL: N/A (docs-only story)
- User Validation: Pending
- Notes: Pending checkpoint approval.
