# User Story — Dashboard Enter Opens Top Search Result (2026-03-30)

As a litigation user managing many case boards
I want pressing Enter in dashboard search to open the top matching case
So that I can navigate to the right board faster with fewer clicks

## Acceptance Criteria

1. Given I am on `All cases` with multiple owned boards
When I type a query that narrows results and press `Enter` in `Search cases`
Then the first matching owned board is opened.

2. Given I am on `Shared with me` with matching shared boards
When I type a query and press `Enter` in `Search cases`
Then the first matching shared board is opened.

3. Given there are no matching boards for my current search
When I press `Enter` in `Search cases`
Then no navigation is triggered and I remain on the dashboard.
