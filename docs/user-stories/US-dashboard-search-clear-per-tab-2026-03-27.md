# User Story — Dashboard Search Clear Control (2026-03-27)

As a litigation user reviewing many case boards  
I want a clear control for the active dashboard search tab  
So that I can quickly reset the current filter without losing my other tab's query

## Acceptance Criteria

1. Given the active dashboard tab search input is empty  
When the dashboard renders  
Then no clear-search control is shown.

2. Given I have typed a search query in `All cases`  
When I click the clear-search control  
Then the `All cases` query resets to empty and the full owned-case list is shown.

3. Given I have different search queries in `All cases` and `Shared with me`  
When I click clear-search in `Shared with me`  
Then only the shared query resets and the owned query remains unchanged when I switch back.

## Notes

- Scope is UI state only; no backend or Firestore query behavior changed.
- This is intentionally minimal and extends the existing tab-scoped search model.
