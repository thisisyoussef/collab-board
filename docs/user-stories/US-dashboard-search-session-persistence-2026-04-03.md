# User Story — Dashboard Search Session Persistence (2026-04-03)

As a litigation user managing many active and shared cases  
I want my dashboard search filters to persist across browser reloads  
So that I can resume triage quickly without retyping queries

## Acceptance Criteria

1. Given I am signed in on `All cases` and type a search query  
When I reload the dashboard page  
Then the `All cases` search input restores my previous query and the list remains filtered.

2. Given I am signed in and I previously used both `All cases` and `Shared with me` search filters  
When I reload and switch between tabs  
Then each tab restores its own last query instead of sharing one global value.

3. Given stored dashboard search data is malformed (invalid JSON)  
When the dashboard loads  
Then the page falls back to empty search values and remains usable without crashing.

## Scope Notes

- Persistence is client-side only via user-scoped `localStorage`.
- No Firestore schema/query behavior changed.
