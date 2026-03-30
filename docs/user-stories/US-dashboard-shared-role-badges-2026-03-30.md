# User Story — Shared Role Visibility (2026-03-30)

As a collaborating attorney  
I want to see my access role on each shared case card  
So that I can quickly know whether I can edit or only review before opening a case

## Acceptance Criteria

1. Given I open the dashboard and switch to "Shared with me", when a board was explicitly shared with me as an editor, then the board card shows an `Editor access` badge.
2. Given I open the dashboard and switch to "Shared with me", when a board was explicitly shared with me as a viewer, then the board card shows a `Viewer access` badge.
3. Given I open the dashboard and switch to "Shared with me", when a board appears only in recent links (no explicit membership role), then no role-access badge is shown for that card.

## Implementation Notes

- Added shared role label rendering in the shared board card metadata.
- Added role chip styling in the dashboard CSS.
- Added dashboard tests for explicit role badge visibility and recent-link badge omission.
