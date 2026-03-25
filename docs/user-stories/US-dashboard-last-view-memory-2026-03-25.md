# User Story — Dashboard Last View Memory (2026-03-25)

As a litigation user switching between personal and shared case queues  
I want the dashboard to remember my last selected view  
So that I can resume work without reselecting tabs each visit

## Acceptance Criteria

1. Given I open the dashboard with no saved dashboard-view preference  
When the page loads  
Then `All cases` is selected by default.

2. Given I previously selected `Shared with me` and return to the dashboard later  
When the page loads  
Then the dashboard restores `Shared with me` as the active view.

3. Given the saved dashboard-view value is invalid or corrupted  
When the page loads  
Then the dashboard safely falls back to `All cases`.

4. Given I switch between `All cases` and `Shared with me`  
When the active tab changes  
Then the dashboard persists the selected view so the same view is restored on the next visit.
