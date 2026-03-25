# User Story — Dashboard One-Click Search Clear (2026-03-25)

As a litigation case manager
I want a one-click action to clear the current dashboard search query
So that I can quickly recover from no-results states without manually deleting text

## Acceptance Criteria

1. Given I am on `All cases` with a non-empty search query
When I click the `Clear` search control
Then the search query resets to empty and the full owned-case list is shown.

2. Given I am on `Shared with me` with a non-empty search query
When I click the `Clear` search control
Then the search query resets to empty and both shared sections return to unfiltered results.

3. Given I have separate queries in `All cases` and `Shared with me`
When I clear search while on one tab
Then only that tab's query is cleared and the other tab's query remains unchanged.
