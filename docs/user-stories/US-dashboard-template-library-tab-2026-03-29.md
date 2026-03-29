# User Story — Dashboard Template Library Tab (2026-03-29)

As a litigation user preparing a new case board  
I want a dedicated dashboard tab to browse and launch case templates directly  
So that I can start from a proven structure without extra setup steps

## Acceptance Criteria

1. Given I am on the dashboard  
When I click `Case templates` in the sidebar  
Then the dashboard switches to a `Case templates` view and shows available template cards.

2. Given I am in the `Case templates` view  
When I click `Create case` on a template card  
Then the app creates a board from that template and navigates to the new board after commit resolves.

3. Given template creation is already in progress from a template card  
When I click create again before the first commit finishes  
Then no duplicate create request is sent and the create button stays disabled until completion.

## Notes

- This story turns the existing `Case templates` sidebar item into a real, user-visible workflow instead of routing back to `All cases`.
- Scope is intentionally focused to dashboard UX and template launch behavior only.
