# User Story — Dashboard Search Restore On Return (2026-03-27)

As a litigation user moving between dashboard and board pages  
I want my active dashboard tab and tab-specific search query to be restored when I return  
So that I can resume case triage without re-entering filters

## Acceptance Criteria

1. Given I am on `Shared with me` and entered a shared-case search query  
When I leave the dashboard and later return in the same browser session  
Then the dashboard opens on `Shared with me` and reuses the previous shared query.

2. Given I entered different search queries in `All cases` and `Shared with me`  
When I return to the dashboard and switch between tabs  
Then each tab restores its own previous query and filtered list.

3. Given dashboard session storage contains invalid JSON  
When I load the dashboard  
Then the page falls back to `All cases` with empty search values and does not crash.

## Notes

- Scope is dashboard UI state only (`sessionStorage`); no API or Firestore changes.
- Persistence is intentionally session-scoped, not cross-device or long-term.
