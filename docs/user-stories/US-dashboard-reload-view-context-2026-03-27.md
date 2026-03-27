# User Story — Dashboard Reload View Context (2026-03-27)

As a litigation user returning to the dashboard during a busy case workflow  
I want my last dashboard tab and tab-specific search queries to persist across reloads  
So that I can continue triage without re-selecting context after every refresh

## Acceptance Criteria

1. Given I last used the `Shared with me` dashboard tab  
When I refresh and return to `/dashboard`  
Then the dashboard restores `Shared with me` as the active tab.

2. Given I entered search queries for both `All cases` and `Shared with me` tabs  
When I refresh and return to `/dashboard`  
Then each tab restores its own previous query and applies the same filtering behavior.

3. Given local dashboard context storage is missing or invalid  
When the dashboard loads  
Then it safely falls back to default state (`All cases` active and empty search).

## Notes

- Persistence is client-side via `localStorage`.
- Scope is intentionally UI-local; no Firestore query behavior changed.
