# US: Dashboard Template Enter Submit

## User Story

As a litigation case manager  
I want pressing Enter on the dashboard case-template selector to create from the selected template  
So that I can start a templated case faster without switching to mouse clicks

## Acceptance Criteria

1. Given I selected a case template on the dashboard
When I focus the template selector and press Enter
Then the app creates a board from that template and opens it.

2. Given I selected a case template on the dashboard
When I press Enter in the template selector
Then the app does not submit the standard "Create Case" flow.

3. Given no case template is selected
When I press Enter in the template selector
Then no board is created.

## Test Plan (TDD)

- Added tests first in `src/pages/Dashboard.test.tsx` for Enter-driven template creation and no-selection no-op behavior.
- Implemented minimal keyboard handler in `src/pages/Dashboard.tsx` on the template `<select>` to route Enter to template creation only.

