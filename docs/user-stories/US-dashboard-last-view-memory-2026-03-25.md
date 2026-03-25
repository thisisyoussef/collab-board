# User Story — Dashboard Last View Memory (2026-03-25)

As a litigation user who frequently works in shared cases  
I want the dashboard to remember my last selected case view (`All cases` or `Shared with me`)  
So that I can return directly to my preferred workflow without reselecting the tab each visit

## Acceptance Criteria

1. Given I open the dashboard with no previously saved view  
When the page renders  
Then `All cases` is selected by default.

2. Given I previously selected `Shared with me` on the dashboard  
When I return to the dashboard  
Then `Shared with me` is preselected automatically.

3. Given local storage contains an invalid dashboard view value  
When the dashboard loads  
Then the page safely falls back to `All cases`.

4. Given I switch from `All cases` to `Shared with me` (or back)  
When I click a view tab  
Then the selected view is persisted so the same tab is restored on the next visit.

## Notes

- Scope is intentionally client-side only via `localStorage`.
- No Firestore or API behavior changes are required.
