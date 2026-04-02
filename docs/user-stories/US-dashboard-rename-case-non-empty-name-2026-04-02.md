# User Story — Dashboard Rename Requires Non-Empty Name

As a litigation case manager  
I want renaming a case to require a real case name  
So that I do not accidentally erase case labels with blank or whitespace-only titles

## Acceptance Criteria

1. Given I am renaming a case and the name input is empty or whitespace-only, when I view the rename controls, then the Save action is disabled.
2. Given I am renaming a case and the name input is whitespace-only, when I press Enter, then the rename request is not submitted.
3. Given I am renaming a case and the input contains leading/trailing whitespace around a valid name, when I save, then the submitted name is trimmed.

## Implementation Notes

- Scope kept to dashboard rename UX/validation only.
- No API/schema/dependency changes.
- Added focused dashboard tests mapped directly to the acceptance criteria.
