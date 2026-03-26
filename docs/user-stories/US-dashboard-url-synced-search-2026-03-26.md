# User Story: Dashboard URL-Synced Tab and Search State

## User Story

As a litigator managing multiple case boards  
I want my dashboard tab and search filters to persist in the URL  
So that refreshes and shared links preserve my working context

## Acceptance Criteria (Given/When/Then)

1. Given I open `/dashboard?view=shared&qOwned=smith&qShared=deposition`  
When the dashboard loads  
Then the "Shared with me" tab is active and the shared search input is prefilled with `deposition`

2. Given I am on the "All cases" dashboard tab  
When I type `smith` into search  
Then the URL query includes `view=owned` and `qOwned=smith`

3. Given I typed `alpha` on "All cases" and `beta` on "Shared with me"  
When I switch between tabs  
Then each tab restores its own search query and the URL keeps both `qOwned` and `qShared`

## Notes

- Scope is intentionally limited to dashboard URL state synchronization only.
- No backend or data model changes are required.
