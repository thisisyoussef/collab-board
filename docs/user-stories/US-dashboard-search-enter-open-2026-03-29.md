# User Story — Dashboard Search Enter-to-Open (2026-03-29)

## Story

As a litigation coordinator
I want to press Enter in dashboard search to open the top visible case
So that I can navigate to the right case faster without extra clicks

## Acceptance Criteria

1. **Owned cases quick-open**
   - Given I am on the `All cases` dashboard tab with at least one search match
   - When I type a search query and press Enter in the search field
   - Then the first visible owned case result opens

2. **Shared cases quick-open**
   - Given I am on the `Shared with me` dashboard tab with at least one search match
   - When I type a search query and press Enter in the search field
   - Then the first visible shared case result opens

3. **No-match safety**
   - Given my current dashboard tab has no search matches
   - When I press Enter in the search field
   - Then no navigation occurs

## Notes

- This behavior is scoped to the currently active dashboard tab.
- Search filtering behavior is unchanged; this adds keyboard acceleration only.
