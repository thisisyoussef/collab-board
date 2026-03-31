# User Story — Dashboard Template Library View (2026-03-31)

## User Story

As a litigation case manager  
I want a dedicated template library view on the dashboard  
So that I can quickly browse and launch the right starter case pack without leaving my workflow

## Acceptance Criteria

1. **Given** I am on `/dashboard`  
   **When** I click `Case templates` in the sidebar  
   **Then** the dashboard switches to a `Case templates` view and shows available template packs.

2. **Given** I am in `Case templates` view with multiple packs listed  
   **When** I type a keyword into `Search cases`  
   **Then** only template packs whose labels match the keyword (case-insensitive) remain visible.

3. **Given** I am in `Case templates` view  
   **When** I click `Use template` for a specific pack  
   **Then** the app creates a board from that pack and navigates directly to the new board.

## Notes

- Reused existing `createBoardFromTemplate` behavior to avoid widening backend scope.
- Kept changes focused to dashboard view state, template rendering, and UI tests only.
