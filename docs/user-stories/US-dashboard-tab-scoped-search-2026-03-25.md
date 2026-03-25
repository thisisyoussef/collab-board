# User Story — Dashboard Tab-Scoped Search (2026-03-25)

As a litigation user switching between owned and shared case lists  
I want search text to be scoped to each dashboard tab  
So that filtering in one tab does not hide results in the other tab

## Acceptance Criteria

1. Given I am on `All cases` and have entered a search query  
When I switch to `Shared with me`  
Then shared cases are not filtered by the owned-tab query unless I enter a shared-tab query.

2. Given I entered a search query on `All cases`  
When I switch to `Shared with me` and then return to `All cases`  
Then the original `All cases` query is restored and still applied.

3. Given I entered a search query on `Shared with me`  
When I switch to `All cases` and then return to `Shared with me`  
Then the original shared-tab query is restored and still applied.

## Notes

- Scope is dashboard UI state only; no API, Firestore, or sharing model changes.
- Search matching remains case-insensitive title matching.
