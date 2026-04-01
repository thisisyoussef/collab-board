# User Story — Dashboard Clear Search (2026-04-01)

As a litigation case manager  
I want a one-click way to clear dashboard search  
So that I can quickly restore the full case list without manual text deletion

## Acceptance Criteria

### AC1 — Clear owned-case search
Given I am on `All cases` and have entered a search term  
When I click `Clear` beside the search field  
Then the search field is reset to empty and all owned cases are shown again

### AC2 — Clear shared-case search
Given I am on `Shared with me` and have entered a search term  
When I click `Clear` beside the search field  
Then the search field is reset to empty and both shared sections repopulate with matching boards

### AC3 — Preserve per-tab search state
Given I have separate search terms in `All cases` and `Shared with me`  
When I click `Clear` while viewing one tab  
Then only that active tab's search query is cleared and the other tab's query is unchanged

## Test Coverage

- `src/pages/Dashboard.test.tsx`
  - `clears owned-case search and restores the full owned list`
  - `clears shared-case search and restores shared sections`
  - `clears only the active tab search query`
