# US: Persist Dashboard Context Across Refresh (2026-03-27)

As a litigation user
I want my dashboard tab and search filters to stay after refresh
So that I can resume triage without re-applying context

## Acceptance Criteria

1. Given I am on the `Shared with me` tab with a search query entered
When I refresh the dashboard page
Then the dashboard restores the `Shared with me` tab and the same shared-case search query.

2. Given I have different search queries for `All cases` and `Shared with me`
When I switch tabs and refresh
Then each tab keeps its own query and restores the active tab correctly.

3. Given local dashboard view storage is missing or malformed
When I load the dashboard
Then the dashboard falls back to safe defaults (`All cases` tab with empty searches) without crashing.
