# User Story — Dashboard Refresh Context Memory (2026-03-27)

As a litigation user returning to the dashboard after a browser refresh  
I want my last active dashboard tab and tab-scoped search queries to be restored  
So that I can continue triage without reapplying filters

## Acceptance Criteria

1. Given I last used the `Shared with me` tab with a shared-case search query  
When I refresh and return to `/dashboard`  
Then the dashboard opens on `Shared with me` and restores that shared query.

2. Given I entered different search queries for `All cases` and `Shared with me`  
When I switch between tabs and refresh the page  
Then each tab restores its own prior query and does not overwrite the other tab’s value.

3. Given local storage contains malformed dashboard context data  
When I load `/dashboard`  
Then the page falls back safely to the default `All cases` view with empty search inputs.

## Notes

- Persistence is intentionally browser-local (`localStorage`) and does not introduce server-side state.
- Invalid persisted data is ignored to keep dashboard load resilient.
