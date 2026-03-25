# User Story — Dashboard Case Search (2026-03-25)

As a litigation user managing many case boards  
I want to search case lists by title in the dashboard  
So that I can find the right case quickly without scanning long lists

## Acceptance Criteria

1. Given I am on `All cases` and have multiple case boards  
When I type a keyword into `Search cases`  
Then only boards with titles containing that keyword (case-insensitive) are shown.

2. Given I am on `All cases` and none of my board titles match the query  
When I type a non-matching keyword  
Then the dashboard shows `No cases match your search.`.

3. Given I am on `Shared with me` with explicit and recent shared boards  
When I type a keyword into `Search cases`  
Then shared sections show only matching board titles, and non-matching boards are hidden.

## Notes

- Scope is intentionally UI-local (client-side filtering only); no Firestore query changes were added.
- Search applies to both owned and shared views using the same input control.
