# User Story — Dashboard Search Session Persistence (2026-03-29)

As a litigation user managing many cases across dashboard tabs  
I want my search filters to persist during my browser session  
So that I can refresh or navigate away without losing my in-progress triage

## Acceptance Criteria

1. Given I enter a search query on `All cases`  
When I refresh or remount the dashboard in the same browser session  
Then the `All cases` search query is restored and the owned case list remains filtered by that query.

2. Given I enter one search query on `All cases` and another on `Shared with me`  
When I refresh or remount the dashboard in the same browser session  
Then each tab restores its own query independently, and each list remains filtered by its tab-specific query.

3. Given dashboard search session storage is missing or malformed  
When I open the dashboard  
Then search defaults safely to empty values without crashing, and normal board lists still render.

## Notes

- Scope is intentionally UI-local (sessionStorage only); no Firestore query behavior changed.
- Persistence is per-browser-session and intentionally does not cross sessions.
