# User Story — Dashboard Shared Access Badges (2026-04-01)

As a litigation collaborator  
I want to see my access level on shared case cards  
So that I know whether I can edit or only review before opening a board

## Acceptance Criteria

1. Given I am on `Shared with me` and an explicit shared board grants me `editor` access  
When the shared case cards are rendered  
Then that board card shows `Can edit`.

2. Given I am on `Shared with me` and an explicit shared board grants me `viewer` access  
When the shared case cards are rendered  
Then that board card shows `View only`.

3. Given I am on `Shared with me` and a board appears only from the `Recent case links` section  
When the shared case cards are rendered  
Then that board card shows `Opened via link`.

## Notes

- Scope is UI-local; no Firestore schema or query behavior changed.
- The badge is informational only and does not alter existing sharing permissions.
