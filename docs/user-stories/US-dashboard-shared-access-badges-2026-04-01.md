# User Story: Shared Board Access Badges (2026-04-01)

## Story
As a collaborating attorney
I want each shared case card to show my access level
So that I can immediately tell whether I can edit, view only, or I opened it from a link.

## Acceptance Criteria (Given/When/Then)

1. Given I open the `Shared with me` view and a case is explicitly shared with `editor` access
When the case card renders
Then the card shows the badge `Can edit`.

2. Given I open the `Shared with me` view and a case is explicitly shared with `viewer` access
When the case card renders
Then the card shows the badge `View only`.

3. Given I open the `Shared with me` view and a case appears in recent links (not explicit membership)
When the case card renders
Then the card shows the badge `Opened via link`.

## Scope
- Add access label mapping for shared board cards in the dashboard.
- Render a compact access badge on each shared card.
- Cover all acceptance criteria with dashboard tests.

## Validation Notes
- Dashboard test target currently fails to execute in this environment because `vitest` is unavailable until dependencies are installed.
