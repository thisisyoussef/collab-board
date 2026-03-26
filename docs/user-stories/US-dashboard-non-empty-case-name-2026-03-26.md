# US-dashboard-non-empty-case-name-2026-03-26

## User story

As a litigation case manager
I want the dashboard to block blank case names
So that every new case starts with a meaningful title I can find later.

## Acceptance criteria

1. Given I am on the dashboard create-case form
When the case name input is empty
Then the `Create Case` button is disabled.

2. Given I entered only whitespace in the case name input
When I submit the form
Then no case is created and I see `Case name cannot be empty.`.

3. Given I entered a valid case name with leading/trailing spaces
When I submit the form
Then the created case uses the trimmed title.

## Implementation summary

- Added create-case validation in the dashboard form to require a non-whitespace title.
- Disabled `Create Case` until the input includes non-whitespace characters.
- Trimmed the submitted title before calling `createBoard`.
- Added dashboard tests for disabled state, whitespace rejection, and trimmed submission.

## Validation

- Attempted: `npm test -- src/pages/Dashboard.test.tsx`
- Result: blocked in sandbox due dependency/runtime installation issue (`vitest: command not found` after incomplete `npm ci`).
