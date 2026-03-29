# User Story — Dashboard Active-Tab Search Clear (2026-03-29)

As a litigation user navigating many case boards  
I want a one-click way to clear the current dashboard search  
So that I can quickly return to the full case list in my current context

## Acceptance Criteria

1. Given I am on `All cases` with a non-empty `Search cases` query  
When I click `Clear search`  
Then the query is reset to empty and the full owned case list is shown again.

2. Given I am on `Shared with me` with a non-empty `Search cases` query  
When I click `Clear search`  
Then the query is reset to empty and all matching shared sections are shown again.

3. Given each dashboard tab keeps its own search query  
When I clear search while on one tab  
Then only the active tab query is cleared and the other tab query remains unchanged.

## Notes

- Scope is UI-local only; no Firestore query behavior changed.
- Clear action only appears when the active tab has a non-empty query.
