# User Story — Dashboard Case ID Search (2026-04-03)

As a legal collaborator managing many case boards  
I want dashboard search to match case ID fragments as well as title keywords  
So that I can quickly find the right case from copied links and IDs.

## Acceptance Criteria

1. Given I am on `All cases` and have two boards with different IDs  
When I enter a case ID fragment that matches one board ID but not its title  
Then the dashboard shows that matching board and hides non-matching boards.

2. Given I am on `Shared with me` with boards in both "Shared by co-counsel" and "Recent case links"  
When I enter a case ID fragment that matches one shared board ID  
Then the dashboard shows only the matching shared board across both shared sections.

3. Given I am on either dashboard tab with existing title-based search behavior  
When I enter a title keyword instead of an ID fragment  
Then search still returns the same title matches as before.

## Notes

- Search remains case-insensitive.
- Matching is substring-based for both title and case ID.
