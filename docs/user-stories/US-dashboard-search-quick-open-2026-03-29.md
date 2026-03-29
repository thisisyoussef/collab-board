# US — Dashboard Search Quick Open (2026-03-29)

## User story

As a litigation user managing many case boards
I want to press Enter in dashboard search to open the first matching case
So that I can navigate to the right board faster without extra clicks

## Acceptance criteria

1. Given I am in **All cases** and at least one case matches my search,
   When I press Enter in the search input,
   Then the first matching owned case opens.

2. Given I am in **Shared with me** and shared cases are filtered by my search,
   When I press Enter in the search input,
   Then the first matching shared case opens.

3. Given my search has no matching cases in the active tab,
   When I press Enter in the search input,
   Then no navigation occurs.

## Scope

- Add Enter-key quick-open behavior to dashboard case search input.
- Preserve existing tab-scoped search memory and filtering behavior.
- Keep implementation minimal and avoid unrelated dashboard refactors.

## Test mapping

- `src/pages/Dashboard.test.tsx`
  - opens first matching owned case when pressing Enter in search.
  - opens first matching shared case when pressing Enter in search.
  - does not navigate when pressing Enter in search with no matches.
