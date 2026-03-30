# User Story — Shared Case Access Badges (2026-03-30)

As a collaborator reviewing shared litigation cases  
I want each shared dashboard card to show my access context  
So that I know whether I can edit before opening a case.

## Acceptance Criteria

1. Given I am on `Shared with me` and a case is explicitly shared with role `viewer`  
When the shared case card renders  
Then the card shows a `Viewer access` badge.

2. Given I am on `Shared with me` and a case is explicitly shared with role `editor`  
When the shared case card renders  
Then the card shows an `Editor access` badge.

3. Given a shared case appears only via recent-link history (no explicit membership role)  
When the recent card renders  
Then the card shows a `Recent link` badge and does not show any role badge.

## Scope

- Dashboard shared-card metadata presentation only.
- No Firestore schema changes.
- No shared-permission rule changes.

## Implementation Notes

- Added shared-card access badge rendering in dashboard shared sections.
- Added styles for role/source badges to keep card metadata readable.
- Added acceptance tests for explicit role badges and recent-link-only cards.

## Validation

- `npm test -- src/pages/Dashboard.test.tsx`  
  Result: blocked in this sandbox (`vitest: command not found`).

