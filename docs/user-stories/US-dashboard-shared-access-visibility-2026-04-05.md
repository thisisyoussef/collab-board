# User Story — Dashboard Shared Access Visibility (2026-04-05)

As a collaborator opening shared case boards  
I want to see my access level on each shared case card  
So that I know whether I can edit before opening the board

## Acceptance Criteria

1. **Given** I am on `Shared with me` and an explicitly shared board grants me editor role  
   **When** the shared card is shown  
   **Then** the card displays `Editor access`.

2. **Given** I am on `Shared with me` and an explicitly shared board grants me viewer role  
   **When** the shared card is shown  
   **Then** the card displays `Viewer access`.

3. **Given** I am on `Shared with me` and a board appears from recent shared links  
   **When** the recent shared-link card is shown  
   **Then** the card displays `Link access`.

## Notes

- Scope is dashboard UI metadata only; sharing permissions are unchanged.
- Labels are derived from existing `source` + `role` fields returned by shared-board hooks.
