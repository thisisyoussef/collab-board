# User Story — Dashboard Enter Opens Top Search Result (2026-03-30)

As a litigation user moving quickly between case boards  
I want pressing Enter in dashboard search to open the top filtered case  
So that I can navigate to the right board without extra clicks

## Acceptance Criteria

1. Given I am on `All cases` and my search query matches multiple cases  
When I press Enter in `Search cases`  
Then the dashboard opens the first visible filtered case card.

2. Given I am on `Shared with me` and my search query matches shared cases  
When I press Enter in `Search cases`  
Then the dashboard opens the first visible filtered shared case.

3. Given my search query has no matching cases in the active tab  
When I press Enter in `Search cases`  
Then the dashboard does not navigate and remains on the same view.

## Notes

- This behavior is intentionally scoped to keyboard navigation on the existing search field.
- Prioritization in shared view follows existing list order: explicit shared boards first, then recent shared links.
