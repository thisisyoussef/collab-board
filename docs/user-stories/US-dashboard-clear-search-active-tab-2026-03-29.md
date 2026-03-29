# User Story — Dashboard Active-Tab Search Clear (2026-03-29)

As a litigation user managing many cases  
I want a one-click way to clear my current dashboard search  
So that I can quickly return to the full list in the tab I am working in

## Acceptance Criteria

1. Given I am on `All cases` with an active query filtering owned cases  
When I click `Clear search`  
Then the owned search input becomes empty and all owned cases are shown again.

2. Given I am on `Shared with me` with an active query filtering shared cases  
When I click `Clear search`  
Then the shared search input becomes empty and all shared sections are shown again.

3. Given I have different queries in `All cases` and `Shared with me`  
When I clear search while viewing one tab  
Then only that active tab query resets and the other tab query remains unchanged.

## Notes

- Scope is UI-only and does not change Firestore loading behavior.
- The clear action is disabled when the active tab query is already empty.
