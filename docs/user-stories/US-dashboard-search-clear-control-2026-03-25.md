# User Story — Dashboard Search Clear Control (2026-03-25)

As a litigation user filtering case lists in the dashboard  
I want a one-click way to clear my current search query  
So that I can quickly recover the full list without manual text deletion

## Acceptance Criteria

1. Given I am on either dashboard tab with an empty search field  
When the dashboard renders  
Then the `Clear` control is not shown.

2. Given I enter a non-empty query in `Search cases` on `All cases`  
When I click `Clear`  
Then the owned search input resets to empty and all owned boards are shown again.

3. Given I have different search queries in `All cases` and `Shared with me`  
When I click `Clear` while on `Shared with me`  
Then only the shared-tab query is cleared and the owned-tab query remains unchanged.

## Notes

- Scope is intentionally UI-local; no backend/API/query contract changes were made.
- This follows existing tab-scoped search memory behavior and adds a fast reset path.
