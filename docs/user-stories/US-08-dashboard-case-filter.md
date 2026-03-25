# US-08 — Dashboard Case Filter

## User Story

As a litigation team member managing many boards  
I want to filter dashboard cases by name  
So that I can quickly find and open the right case without scanning long lists.

## Acceptance Criteria

1. Given I am on **All cases** with multiple boards, when I type part of a case title in the filter input, then only matching boards are shown and matching is case-insensitive.
2. Given I am on **All cases** with existing boards, when my filter matches none, then I see `No matching cases for "<query>".`
3. Given I am on **Shared with me** and both shared sections have boards, when I type a filter query, then both sections are filtered and non-matching sections show their filter-specific empty state.

## Implementation Notes

- Added a shared dashboard filter input (`Filter cases by name`) in the dashboard header.
- Applied the same query to:
  - owned boards list,
  - explicit shared boards list,
  - recent shared boards list.
- Added explicit no-match empty states for owned and shared views.

## Validation

- Added tests in `src/pages/Dashboard.test.tsx` that cover all acceptance criteria.
