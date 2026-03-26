# User Story — Dashboard Reload State Memory (2026-03-26)

As a litigation user managing multiple case lists  
I want the dashboard to remember my active tab and tab-specific search filters across page reloads  
So that I can resume triage without rebuilding context after a refresh

## Acceptance Criteria

1. **Given** I am on `Shared with me`  
   **When** I reload `/dashboard`  
   **Then** the dashboard opens on `Shared with me` instead of resetting to `All cases`.

2. **Given** I entered `All cases` search text and a different `Shared with me` search text  
   **When** I reload `/dashboard` and switch tabs  
   **Then** each tab restores its own prior search value and corresponding filtered results.

3. **Given** the browser has malformed or invalid persisted dashboard state  
   **When** `/dashboard` loads  
   **Then** the UI falls back safely to `All cases` with empty search filters.

## Notes

- Persistence is local-browser only via dashboard UI state storage.
- Scope intentionally excludes Firestore query behavior and backend schema changes.
