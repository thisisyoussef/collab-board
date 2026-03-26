# User Story — Dashboard View State Persistence (2026-03-26)

As a litigation user returning to the dashboard during active case work  
I want my last selected dashboard tab and per-tab search queries restored after refresh  
So that I can continue triage without resetting my working context

## Acceptance Criteria

1. Given I last viewed `Shared with me` and refreshed the page  
When the dashboard reloads  
Then `Shared with me` is still active and the shared search query is restored.

2. Given I entered different search queries in `All cases` and `Shared with me`  
When I refresh the dashboard  
Then each tab restores its own previous query and filtering context.

3. Given local storage contains malformed dashboard view-state data  
When the dashboard loads  
Then it falls back to default state (`All cases`, empty search) without crashing.

## Notes

- Scope is intentionally client-only persistence using `localStorage`.
- No Firestore query behavior or server contract changed.
