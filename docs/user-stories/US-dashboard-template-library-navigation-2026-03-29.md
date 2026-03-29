# User Story: Template Library View on Dashboard

As a litigation team member
I want a dedicated template library view in the dashboard
So that I can quickly browse and launch the right case starter board

## Acceptance Criteria

1. Given I am on the dashboard, when I click `Case templates` in the sidebar, then the main content switches to a `Case templates` view and shows available template cards.
2. Given I am in the `Case templates` view, when I search for a template keyword, then only matching templates are shown and non-matching templates are hidden.
3. Given I am in the `Case templates` view, when I click `Use template` on a template card, then a board is created from that template and I am navigated to the new board once commit completes.
4. Given a template launch is already in progress, when I try to launch another template, then additional template actions stay disabled until the in-flight launch resolves.

## Notes

- This story fixes the previously non-functional `Case templates` sidebar action that routed back to the owned-cases list instead of a dedicated templates view.
- Implementation reuses existing `createBoardFromTemplate` commit flow to keep behavior consistent between dropdown and template cards.
