As a litigation user managing many case boards
I want to press Enter in dashboard search to open the top matching case
So that I can move from search to case review faster without extra clicks

Acceptance Criteria

1. Given I am on `All cases` and at least one board matches my search text
When I type a query in `Search cases` and press `Enter`
Then the app opens the first matching owned case board.

2. Given I am on `Shared with me` and at least one shared board matches my search text
When I type a query in `Search cases` and press `Enter`
Then the app opens the first matching shared board.

3. Given my search has no matching boards in the active tab
When I press `Enter` in `Search cases`
Then the app does not navigate away from the dashboard.

4. Given the search field is empty
When I press `Enter` in `Search cases`
Then the app does not auto-open a board.
