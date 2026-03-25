# User Story — Dashboard Last View Memory (2026-03-25)

As a litigation case manager
I want the dashboard to remember whether I was on `All cases` or `Shared with me`
So that I can return to the same caseload context without extra clicks

## Acceptance Criteria

1. Given I have not saved a dashboard view preference
When I open the dashboard
Then `All cases` is selected by default.

2. Given I previously selected `Shared with me`
When I leave and reopen the dashboard
Then `Shared with me` is restored automatically.

3. Given dashboard view preference storage contains an invalid value
When I open the dashboard
Then the dashboard safely falls back to `All cases`.

4. Given I switch between `All cases` and `Shared with me`
When each tab is selected
Then the selected tab is persisted for my next dashboard visit.
