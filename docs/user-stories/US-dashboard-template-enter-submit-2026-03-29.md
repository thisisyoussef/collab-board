# User Story — Dashboard Template Enter Submit (2026-03-29)

As a litigation user creating cases from dashboard templates  
I want pressing `Enter` on the template selector to create the selected template board  
So that I can complete template creation without switching to the mouse.

## Acceptance Criteria (Given/When/Then)

1. **Given** I am on `All cases` and a case template is selected  
   **When** I press `Enter` while focused on the `Case template` selector  
   **Then** the dashboard triggers template creation and navigates to the new board after commit.

2. **Given** I have not selected a case template  
   **When** I press `Enter` while focused on the `Case template` selector  
   **Then** no template board is created and no standard `Create Case` submit is triggered.

3. **Given** I press `Enter` to create a template board and the commit is still pending  
   **When** I press `Enter` again on the selector  
   **Then** no duplicate template create request is dispatched.

## Implementation Notes

- Added keyboard handler on dashboard template `<select>` to route `Enter` to `handleCreateFromTemplate` and prevent default form submit.
- Added focused tests in `src/pages/Dashboard.test.tsx` for:
  - Enter-triggered template create + navigation,
  - no-op behavior with no template selected,
  - duplicate-submit guard while template creation is pending.
