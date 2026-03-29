# User Story — Dashboard Template Library View (2026-03-29)

## User Story

As a litigation counsel managing case intake  
I want a dedicated dashboard view that lists all starter case templates with direct launch actions  
So that I can quickly create the right case board without switching context or using the template dropdown.

## Acceptance Criteria

1. Given I am on `/dashboard` in the default `All cases` view, when I click `Case templates`, then the dashboard switches to a `Case templates` view and shows template catalog cards instead of case lists.
2. Given I am in the `Case templates` view, when I click a template card action, then the app calls `createBoardFromTemplate` for that pack and navigates to `/board/:id` after commit succeeds.
3. Given a template creation commit is pending, when I attempt to trigger another template card action, then all template card actions stay disabled and no duplicate create request is sent.
4. Given I search while in `Case templates`, when no template labels match, then the dashboard shows `No case templates match your search.`

## Implementation Notes

- Extended dashboard view state to include `templates`.
- Added template catalog rendering in `Dashboard.tsx` using `DEMO_CASE_PACK_OPTIONS`.
- Reused existing `createBoardFromTemplate` mutation flow for both dropdown and card actions.
- Added `creatingTemplatePack` state to show per-card pending label while globally preventing duplicate requests.
- Added focused styles for template catalog cards in `Dashboard.css`.

## Test Coverage

- `shows template catalog cards when Case templates is selected`
- `creates a board from a template card and navigates after commit resolves`
- `disables all template card actions while template board creation is pending`

Implemented in: [`/Users/youss/.codex/worktrees/b45b/collab-board/src/pages/Dashboard.test.tsx`](/Users/youss/.codex/worktrees/b45b/collab-board/src/pages/Dashboard.test.tsx)
