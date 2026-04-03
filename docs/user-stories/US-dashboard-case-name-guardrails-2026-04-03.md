# User Story - Dashboard Case Name Guardrails (2026-04-03)

As a litigation case manager
I want dashboard case create and rename flows to require non-empty names
So that my case list does not fill with accidental blank or whitespace-only titles

## Acceptance Criteria

1. Given I am on `All cases` and the new case input is empty or whitespace-only
When I view the create row or submit with Enter
Then `Create Case` stays disabled and no case create request is sent.

2. Given I am renaming an existing case
When the rename input is empty or whitespace-only
Then `Save` stays disabled and pressing Enter does not send a rename request.

3. Given I enter a case name with leading/trailing whitespace during create or rename
When I submit
Then the dashboard sends the trimmed case name value to the board hooks.
