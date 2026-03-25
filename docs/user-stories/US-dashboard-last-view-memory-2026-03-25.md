# User Story — Dashboard Last View Memory (2026-03-25)

As a returning litigation user
I want the dashboard to remember whether I was last viewing `All cases` or `Shared with me`
So that I can resume work faster without manually reselecting the same tab each session

## Acceptance Criteria

1. Given no prior dashboard view is stored
When I open `/dashboard`
Then the dashboard defaults to `All cases`.

2. Given my saved dashboard view is `Shared with me`
When I open `/dashboard`
Then the `Shared with me` tab is selected automatically.

3. Given the saved dashboard view value is invalid or stale
When I open `/dashboard`
Then the app safely falls back to `All cases`.

4. Given I switch from `All cases` to `Shared with me`
When the tab selection changes
Then the selected view is persisted for the next dashboard visit.
