# User Story — Dashboard Search Enter Quick-Open (2026-03-30)

## User Story

As a litigation case manager  
I want to press Enter in dashboard search to open the top matching case  
So that I can navigate to the right case without extra clicks

## Acceptance Criteria

1. Given I am on **All cases** and my search matches at least one owned case  
   When I press Enter in the search field  
   Then the app opens the first matching owned case board

2. Given I am on **Shared with me** and my search matches at least one shared case  
   When I press Enter in the search field  
   Then the app opens the first matching shared case board from the visible shared results

3. Given my search has no matches in the active dashboard tab  
   When I press Enter in the search field  
   Then the app does not navigate to any board
