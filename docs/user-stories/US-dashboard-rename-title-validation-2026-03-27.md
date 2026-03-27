# User Story — Dashboard Rename Title Validation (2026-03-27)

As a litigation user maintaining an accurate caseload  
I want dashboard rename to require a meaningful case title  
So that blank or whitespace-only names never replace valid case titles

## Acceptance Criteria

1. Given I open rename mode for an existing case  
When the rename input is empty or whitespace-only  
Then the `Save` action is disabled.

2. Given I am editing a case name in rename mode  
When I press `Enter` with a whitespace-only value  
Then rename is not submitted.

3. Given I enter a case name with leading/trailing whitespace in rename mode  
When I save  
Then dashboard submits the trimmed title value.

## Notes

- Scope is intentionally dashboard UI guardrails only.
- Firestore rename behavior remains unchanged and continues to validate non-empty titles.
