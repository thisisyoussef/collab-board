# User Story Authoring Guide

This guide defines how to write implementation-ready user stories for CollabBoard phases.

## Purpose

A good story should be executable by another engineer without extra decision-making. It should also enforce preparation and TDD, not just feature intent.

## Required Inputs Before Writing

1. Product intent from PRD or phase plan.
2. Current system behavior from local docs and code.
3. Known constraints (auth model, realtime model, deployment model).

## Authoring Rules

1. Use the template at `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-TEMPLATE.md`.
2. Write in concrete, testable language.
3. Include at least two persona narratives.
4. Include explicit in-scope and out-of-scope lists.
5. Include both local doc audit and web research requirements.
6. Include TDD failing-test plan before implementation steps.
7. Include explicit user checkpoint steps.
8. Include explicit deployment handoff steps (commit, push, Vercel deploy, and recorded URLs/SHA).

## Preparation Phase Standard

Every story must require:

1. Local Audit
- Read relevant code and internal docs first.

2. Web Research
- Check official docs for unstable/external dependencies.
- Prefer official sources over blog posts.

3. Preparation Notes
- Document assumptions, risks, and planned failing tests before coding.

## TDD Standard

Every story must include:

1. Story-specific test files.
2. Failing test cases listed before implementation.
3. Red -> Green -> Refactor protocol.
4. Regression test expectation for bug fixes.

## Definition of Story Completeness

A story document is complete only if it contains all required sections:

1. Status
2. Persona
3. User Story
4. Goal
5. Scope
6. Pre-Implementation Audit
7. Preparation Phase
8. UX Script
9. Implementation Details
10. TDD Plan
11. Acceptance Criteria
12. Local Validation
13. Deployment Handoff (Mandatory)
14. User Checkpoint Test
15. Checkpoint Result

## Quality Checklist (Author)

1. Can a new engineer implement this without asking architecture questions?
2. Are access/security constraints explicit?
3. Are failure modes and edge cases covered in UX Script?
4. Do acceptance criteria map directly to tests/checkpoints?
5. Does TDD plan include concrete failing tests?

## Quality Checklist (Reviewer)

1. Story has no ambiguous contract language.
2. Preparation phase includes local + web verification.
3. TDD section is executable and non-generic.
4. Checkpoint test can be performed by product owner without code context.

## Suggested Maintenance Process

1. Keep one template for all future phases.
2. Update this guide when phase process changes.
3. Link template + guide from each phase README.
