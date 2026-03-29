# US: Dashboard Template Library Tab (2026-03-29)

## User Story
As a litigation case manager  
I want a dedicated template-library view on the dashboard  
So that I can launch a prebuilt case board quickly without first configuring the create form.

## Acceptance Criteria
1. Given I am on the dashboard, when I click `Case templates`, then I see a `Case templates` view with template entries and no manual case-name create input.
2. Given I am on `Case templates`, when I click `Use template` for a specific template pack, then the app creates a board from that pack and navigates to `/board/:id` after the write commits.
3. Given a template creation request is already in progress, when I view template actions, then all template action buttons are disabled and only the active template shows `Creating...` until completion.

## Scope
- Add a first-class `templates` dashboard view.
- Reuse existing `createBoardFromTemplate` flow.
- Keep owned/shared board behaviors unchanged.

## Test Plan
- `src/pages/Dashboard.test.tsx`
  - `shows a dedicated template library view when Case templates is selected`
  - `creates a board from template library view and navigates after commit resolves`
  - `disables template library actions while template creation is pending`

## Validation Notes
- Attempted: `npm test -- src/pages/Dashboard.test.tsx`
- Environment constraint: dependency install is blocked in this sandbox (`ENOTFOUND registry.npmjs.org`), so automated execution could not be completed in this run.
