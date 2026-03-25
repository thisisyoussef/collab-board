# User Story — Dashboard View-Scoped Search (2026-03-25)

As a litigation user switching between my caseload and shared cases  
I want search filters to stay scoped to the current dashboard view  
So that I do not accidentally hide results in another view and lose context

## Acceptance Criteria

1. Given I entered a search query in `All cases`  
When I switch to `Shared with me` for the first time  
Then the shared view search input is empty and shared results are not filtered by the owned-case query.

2. Given I entered a search query in `All cases` and a different query in `Shared with me`  
When I switch between the two views  
Then each view restores its own most recent query and applies filtering for that view only.

3. Given I entered a query in `Shared with me` that narrows the shared list  
When I return to `All cases`  
Then the owned-case list uses only the owned-case query and does not inherit shared filtering.
