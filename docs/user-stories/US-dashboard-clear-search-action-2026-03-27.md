# User Story — Dashboard Clear Search Action (2026-03-27)

As a litigation user managing many cases
I want a one-click way to clear the active dashboard search query
So that I can quickly return to the full case list without manually deleting text

## Acceptance Criteria

1. Given I am on `All cases` with a non-empty search query
When I click `Clear search`
Then the search input resets to empty and all owned cases are shown again.

2. Given I am on `Shared with me` with a non-empty shared search query
When I click `Clear search`
Then the shared query resets to empty and both shared sections repopulate with all matching shared cases.

3. Given each dashboard tab stores its own search query
When I clear search while on `Shared with me`
Then only the shared query is cleared and the `All cases` query remains unchanged.

## Notes

- Scope is dashboard UI state only; no Firestore query or backend behavior changed.
- This story extends existing tab-scoped search memory with faster recovery from no-result filters.
