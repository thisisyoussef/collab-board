# User Story — Dashboard Search Clear Control (2026-03-26)

As a litigation case manager  
I want a one-click way to clear case search filters in each dashboard tab  
So that I can quickly return to the full case list without manually deleting text.

## Acceptance Criteria

1. Given I am on `All cases` and I have typed a search query  
   When I click `Clear` beside the search field  
   Then the search query is reset and all owned cases are shown again.

2. Given I am on `Shared with me` and I have typed a shared-case search query  
   When I click `Clear` beside the search field  
   Then the shared query resets to empty and shared sections show all matching shared boards.

3. Given each tab keeps its own search memory  
   When I clear search on `Shared with me` and return to `All cases`  
   Then the `All cases` search query remains unchanged from before switching tabs.
