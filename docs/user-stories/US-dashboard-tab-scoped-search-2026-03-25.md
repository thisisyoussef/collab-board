# User Story — Dashboard Tab-Scoped Search (2026-03-25)

As a litigation user switching between my own and shared cases  
I want each dashboard tab to keep its own search query  
So that I can return to each context without losing my in-progress filtering

## Acceptance Criteria

1. Given I am on `All cases` with multiple owned boards  
When I enter a search query and then switch to `Shared with me`  
Then the shared tab search input starts with its own value and does not inherit the owned query.

2. Given I have entered an owned-case search query on `All cases`  
When I switch to `Shared with me` and back to `All cases`  
Then the original owned-case query is restored and the owned list remains filtered by it.

3. Given I have entered a shared-case search query on `Shared with me`  
When I switch to `All cases` and back to `Shared with me`  
Then the original shared-case query is restored and shared sections remain filtered by it.

## Notes

- Scope is intentionally UI-local; no Firestore query behavior changed.
- This improves dashboard navigation flow for users managing both personal and shared caseloads.
