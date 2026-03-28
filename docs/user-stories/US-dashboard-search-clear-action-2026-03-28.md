# User Story — Dashboard Search Clear Action (2026-03-28)

As a litigation user  
I want a one-click way to clear the current dashboard search query  
So that I can quickly return to the full case list in the active tab.

## Acceptance Criteria

1. Given I am on `All cases` with a non-empty `Search cases` query  
When I click `Clear search`  
Then the search input resets to empty and the full owned-case list is shown.

2. Given I am on `Shared with me` with a non-empty `Search cases` query  
When I click `Clear search`  
Then the search input resets to empty and both shared sections show all shared results.

3. Given the active tab search input is empty  
When the dashboard renders  
Then `Clear search` is not visible.

4. Given each dashboard tab keeps a separate search query  
When I clear search in one tab  
Then only that tab query is cleared and the other tab query remains unchanged.
