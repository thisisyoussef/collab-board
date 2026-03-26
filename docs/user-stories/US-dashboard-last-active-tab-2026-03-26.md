# US: Dashboard last active tab memory (2026-03-26)

## User Story
As a returning case manager
I want the dashboard to reopen on my last selected tab
So that I can resume owned or shared case work without extra clicks

## Acceptance Criteria
1. Given no saved dashboard tab preference
When I open `/dashboard`
Then the dashboard defaults to `All cases`.

2. Given a saved dashboard tab preference of `Shared with me`
When I open `/dashboard`
Then the `Shared with me` view loads immediately.

3. Given an invalid saved dashboard tab preference value
When I open `/dashboard`
Then the dashboard safely falls back to `All cases`.

4. Given I switch between `All cases` and `Shared with me`
When the active tab changes
Then the dashboard stores the new active tab for the next visit.

## Scope Notes
- Minimal implementation in `Dashboard.tsx` only.
- No backend/API changes.
- No dependency changes.
