# User Story — Dashboard Search Clear Control (2026-03-25)

As a litigation user filtering case lists in the dashboard  
I want a one-click clear control for the active search query  
So that I can quickly return to the full case list without retyping

## Acceptance Criteria

1. Given I am in `All cases` with a non-empty search query  
When I click `Clear` next to `Search cases`  
Then the owned-case query is reset to empty and all owned cases are shown again.

2. Given I am in `Shared with me` with a non-empty search query  
When I click `Clear` next to `Search cases`  
Then the shared-case query is reset to empty and shared sections return to unfiltered results.

3. Given each tab keeps its own search state  
When I clear search in one tab  
Then only that tab’s query is cleared and the other tab’s query remains unchanged.

## Notes

- Scope is intentionally UI-local; no Firestore query changes were introduced.
- Clear control is only visible when the active tab has a non-empty query.
