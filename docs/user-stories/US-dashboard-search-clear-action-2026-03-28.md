# User Story — Dashboard Search Clear Action (2026-03-28)

As a litigation user managing many cases  
I want a one-click way to clear my current dashboard search query  
So that I can quickly return to the full case list without manually deleting text

## Acceptance Criteria

1. Given I am on `All cases` and the search input is empty  
When the dashboard renders  
Then no `Clear search` action is shown.

2. Given I am on `All cases` and I have typed a search query  
When I click `Clear search`  
Then the search input becomes empty and the full owned-case list is shown again.

3. Given I have one query on `All cases` and a different query on `Shared with me`  
When I clear search on one tab  
Then only that active tab query is cleared and the other tab query remains unchanged.

## Notes

- Scope is UI-local only; no Firestore query or persistence behavior changed.
- The clear action is intentionally tab-scoped to preserve existing query-memory behavior.
