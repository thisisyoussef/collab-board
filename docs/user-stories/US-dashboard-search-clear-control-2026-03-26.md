# User Story — Dashboard Search Clear Control (2026-03-26)

As a litigation user filtering case lists on the dashboard  
I want a one-click way to clear the active search query  
So that I can quickly return to the full case list without manual backspacing

## Acceptance Criteria

1. Given I am on `All cases` and the search input has text  
When I click `Clear search`  
Then the owned-case query is reset to empty and the full owned list is shown again.

2. Given I am on `Shared with me` and the search input has text  
When I click `Clear search`  
Then only the shared-tab query is reset, and all shared matching sections are shown.

3. Given the active tab search input is empty  
When the dashboard renders the search row  
Then the `Clear search` button is not shown.

## Notes

- Scope remains UI-local; no Firestore query behavior changed.
- The clear action is view-scoped to preserve existing tab-scoped search memory.
