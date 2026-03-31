# User Story — Dashboard Requires Non-Empty Case Name (2026-03-31)

As a litigation user creating new cases  
I want the dashboard to require a non-empty case name for manual creation  
So that my case list stays clear and avoids accidental unnamed entries

## Acceptance Criteria

1. Given I am on `All cases` and the new case field is empty or whitespace  
When I view the `Create Case` action  
Then `Create Case` is disabled.

2. Given I enter only whitespace and submit the create form  
When the submit event is handled  
Then the dashboard shows `Case name cannot be empty.` and no board is created.

3. Given I enter a valid case title with surrounding whitespace  
When I submit create  
Then the case is created using the trimmed title and navigation opens the new board.

## Notes

- This story applies to manual create from dashboard input only.
- Template-based create remains unchanged.
