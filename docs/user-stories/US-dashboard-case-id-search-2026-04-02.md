# User Story: Dashboard Case ID Search

As a litigation team member
I want to search dashboard cases by case ID
So that I can find a case quickly when I only have an ID fragment from chat, email, or links

## Acceptance Criteria

1. Given I am on the `All cases` dashboard tab and I have multiple owned cases with different IDs
   When I type a case ID fragment into `Search cases`
   Then only owned cases whose title or ID contains that fragment are shown

2. Given I am on the `Shared with me` dashboard tab with both explicitly shared and recent-link cases
   When I type a shared case ID fragment into `Search cases`
   Then only matching shared/recent cases are shown across both shared sections

3. Given a case ID contains uppercase letters and numbers
   When I search with a lowercase fragment of that ID
   Then matching is case-insensitive and the matching case remains visible

## Scope

- Extend existing dashboard search matching from title-only to title-or-ID.
- Keep current tab-scoped query memory behavior unchanged.
- No API/schema changes.

## Implementation Notes

- Updated dashboard filtering logic to match `board.title` OR `board.id`.
- Added test coverage for owned ID match, shared ID match, and case-insensitive ID match.
