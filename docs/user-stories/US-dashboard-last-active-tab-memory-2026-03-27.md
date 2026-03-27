# User Story — Dashboard Last Active Tab Memory (2026-03-27)

As a litigation user working across personal and shared case lists  
I want the dashboard to remember my last selected tab  
So that I can return directly to the same workflow context after reload.

## Acceptance Criteria

1. Given I last used `Shared with me` on the dashboard  
When I reload or revisit `/dashboard`  
Then `Shared with me` is opened as the active view.

2. Given no prior dashboard view preference has been saved  
When I open `/dashboard` for the first time  
Then `All cases` is shown as the default active view.

3. Given I switch from `All cases` to `Shared with me`  
When the tab selection changes  
Then the new active tab is saved and restored on the next dashboard visit.

## Scope

- Persist only the active dashboard tab (`owned` or `shared`) in browser local storage.
- No backend or data model changes.
