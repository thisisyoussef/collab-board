# US: Dashboard Shared Access Badges (2026-04-01)

## User Story

As a collaborator
I want shared board cards to show my access level
So that I know whether I can edit before opening the board.

## Acceptance Criteria

### Case 1: Explicit editor share shows edit access
Given I open the dashboard and navigate to "Shared with me"
When a shared board was explicitly shared with me as an editor
Then that board card shows a "Can edit" badge.

### Case 2: Explicit viewer share shows read-only access
Given I open the dashboard and navigate to "Shared with me"
When a shared board was explicitly shared with me as a viewer
Then that board card shows a "View only" badge.

### Case 3: Recent link access is labeled separately
Given I open the dashboard and navigate to "Shared with me"
When a board appears in recent shared links without explicit membership
Then that board card shows an "Opened via link" badge.

## Implementation Notes

- Added `getSharedBoardAccessLabel` helper in dashboard rendering.
- Added shared-card badge UI in `SharedBoardsSection`.
- Added focused badge styling in dashboard CSS.
- Added Dashboard tests for editor, viewer, and recent-link badge states.
