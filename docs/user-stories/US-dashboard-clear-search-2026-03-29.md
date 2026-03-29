# User Story — Dashboard Active-Tab Clear Search (2026-03-29)

## Story

As a litigation case manager
I want a one-click way to clear my current dashboard search
So that I can quickly return to the full case list without losing filters on the other tab

## Acceptance Criteria

1. Given I am on the `All cases` tab and have typed a search query
   When I click `Clear search`
   Then the `All cases` search input resets to empty and all owned cases become visible again.

2. Given I am on the `Shared with me` tab and have typed a search query
   When I click `Clear search`
   Then the shared-tab search input resets to empty and shared results are no longer filtered.

3. Given I have different search queries in `All cases` and `Shared with me`
   When I click `Clear search` while on one tab
   Then only the active tab query is cleared and the other tab query is preserved.

4. Given the active tab search input is already empty
   When I view the dashboard
   Then no `Clear search` button is shown.

## Scope Notes

- Minimal UI change in dashboard search controls.
- No data-layer or API changes.
- No new dependencies.
