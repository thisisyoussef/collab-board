# User Story — Dashboard Search Clear Per Active Tab (2026-03-27)

As a litigation user navigating many cases  
I want a quick way to clear the current dashboard search query  
So that I can reset filtered results without losing the other tab’s search context

## Acceptance Criteria

1. Given I am on `All cases` with a non-empty search query  
When I click `Clear` next to `Search cases`  
Then the owned-case search input resets to empty and all owned cases are shown again.

2. Given I am on `Shared with me` with a non-empty shared-case query and an existing owned-case query  
When I click `Clear` in shared view  
Then only the shared-case query is reset, and the owned-case query is preserved when returning to `All cases`.

3. Given the active tab search query is empty  
When the dashboard renders  
Then no clear-search action is shown for that tab.

## Notes

- Scope is intentionally UI-local and reuses existing tab-scoped search state.
- No backend or Firestore behavior changes were introduced.
