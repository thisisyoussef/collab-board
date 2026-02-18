# US-XX: <Story Title>

## Status

- State: Pending
- Owner: <Owner>
- Depends on: <Dependency Story or none>

## Persona

**<Persona 1, Role>** — <Narrative context of why this person needs the feature and what success looks like>

**<Persona 2, Role>** — <Narrative context + pain point + expected behavior>

(Optional) **<Persona 3, Role>** — <Narrative context>

## User Story

> As <Persona 1>, I want <capability> so that <outcome>.

> As <Persona 2>, I want <capability> so that <outcome>.

## Goal

<One paragraph defining delivery outcome in concrete terms.>

## Scope

In scope:

1. <Deliverable 1>
2. <Deliverable 2>
3. <Deliverable 3>

Out of scope:

1. <Non-goal 1>
2. <Non-goal 2>

## Pre-Implementation Audit

Local docs/code to review first:

1. <absolute path>
2. <absolute path>
3. <absolute path>

## Preparation Phase (Mandatory)

1. Local audit
- Read all relevant local docs and current implementation.
- Identify constraints, edge cases, and existing anti-patterns.

2. Web research (official docs first)
- Search official docs for anything likely to have changed.
- Prioritize primary sources and record what was checked.
- Include exact links + date checked in Preparation Notes.

3. Preparation Notes (required before coding)
- assumptions:
- risks:
- open questions:
- planned failing tests:

## UX Script

Happy path:

1. <Step 1>
2. <Step 2>
3. <Step 3>

Edge cases:

1. <Edge case 1>
2. <Edge case 2>

## Implementation Details

Planned files:

1. <absolute path>
2. <absolute path>
3. <absolute path>

Contracts/interfaces:

```ts
// Add relevant interfaces, payloads, types, or API contracts here
```

Data flow:

1. <Input>
2. <Transform>
3. <Output>

## TDD Plan

Write tests first:

1. <test file path>
- <failing test case A>
- <failing test case B>

2. <test file path>
- <failing test case C>

Red -> Green -> Refactor:

1. Write failing tests that express required behavior.
2. Implement minimum code to pass.
3. Refactor only after green.
4. Add regression test for each bug found.

## Acceptance Criteria

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Local Validation

1. `npm run lint`
2. `npm run test -- <story-specific test files>`
3. `npm run test`
4. `npm run build`

## User Checkpoint Test

1. <manual step 1>
2. <manual step 2>
3. <manual step 3>

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
