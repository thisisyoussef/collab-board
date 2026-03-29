# User Story — Dashboard Template Enter Submit (2026-03-29)

As a litigation user creating new case boards from templates  
I want the create-case form submit action to honor the selected template  
So that I can use keyboard submit without accidentally creating an empty case board

## Acceptance Criteria

1. Given I am on `All cases` and a case template is selected  
When I submit the create form with Enter  
Then the dashboard creates a board from the selected template and opens it.

2. Given I am on `All cases` and no case template is selected  
When I submit the create form with Enter  
Then the dashboard uses standard board creation behavior.

3. Given I selected a template and submit via Enter  
When creation is triggered  
Then standard board creation is not called for that submit event.

## Notes

- Scope is intentionally narrow to dashboard form submit behavior.
- Existing explicit "Create from template" button behavior remains unchanged.
