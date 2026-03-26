# User Story — Dashboard Reload State Persistence (2026-03-26)

As a litigation user managing many active and shared cases  
I want the dashboard to remember my active tab and each tab's search query after reload  
So that I can continue triage work without reapplying filters every time I reopen the app

## Acceptance Criteria

1. Given I previously used the `Shared with me` tab and searched for `deposition`  
When I reload the dashboard  
Then the dashboard reopens on `Shared with me` with `deposition` prefilled and shared lists filtered.

2. Given I search `smith` in `All cases`, then switch to `Shared with me` and search `deposition`  
When dashboard state is persisted  
Then both tab-scoped queries and the current active tab are saved and restored as last-used values.

3. Given persisted dashboard state is malformed or unreadable  
When I open the dashboard  
Then the page falls back safely to default state (`All cases` and empty search) without crashing.

## Notes

- Scope is intentionally local UI state only; no backend/storage model changes.
- Behavior is implemented via defensive `localStorage` parsing and save-on-change.
