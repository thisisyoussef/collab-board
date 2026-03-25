# User Story — Dashboard Shared Access Badges (2026-03-25)

As a litigation collaborator opening shared case boards  
I want to see my access level on each shared board card  
So that I know whether I can edit or only review before opening the board

## Acceptance Criteria

1. Given I open `Shared with me` and a board is explicitly shared with `editor` access  
When shared board cards are rendered  
Then that board shows a `Can edit` badge next to the case title.

2. Given I open `Shared with me` and a board is explicitly shared with `viewer` access  
When shared board cards are rendered  
Then that board shows a `Can view` badge next to the case title.

3. Given I open `Shared with me` and a board appears only from recent-link history (no explicit role)  
When shared board cards are rendered  
Then no access badge is shown for that board.
