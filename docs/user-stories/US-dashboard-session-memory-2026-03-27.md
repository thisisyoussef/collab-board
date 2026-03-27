# User Story — Dashboard Session Memory (2026-03-27)

## Story
As a litigation user managing multiple cases
I want the dashboard to remember my last tab and search filters after refresh
So that I can resume work without re-entering my context

## Acceptance Criteria
1. Given I am on the Shared with me tab with a shared-case search query entered
When I refresh or revisit the dashboard
Then the dashboard restores the Shared with me tab and the same shared-case search query

2. Given I have different search queries in All cases and Shared with me
When I switch between tabs and then refresh
Then each tab keeps its own query and the last active tab is restored

3. Given malformed dashboard view data exists in browser storage
When I open the dashboard
Then the app falls back safely to default state (All cases tab with an empty search)

## Implementation Notes
- Persisted dashboard view context to browser local storage under `collab-board-dashboard-view-context`.
- Added guarded storage reads/writes so blocked storage or malformed JSON does not break rendering.
- Continued to keep per-tab query state (`owned` and `shared`) while adding cross-refresh persistence.

## Test Coverage
- `src/pages/Dashboard.test.tsx`
  - restores tab/search from persisted storage
  - persists active tab and per-tab search values to storage
  - ignores malformed persisted storage and falls back safely

## Validation
- `npm test -- src/pages/Dashboard.test.tsx` ✅ passed (32 tests)
- `npm run lint` ❌ failed with pre-existing issues outside this story:
  - `api/ai/generate.ts:926` and `api/ai/generate.ts:934` (`_prompt` unused)
  - existing React Hook warnings in unrelated files
- `npm test` ❌ failed with pre-existing localStorage/test-environment issues outside this story:
  - `src/hooks/useAICommandCenter.test.ts` (`window.localStorage.clear` not a function)
  - `src/pages/Board.viewport.test.tsx` (`window.localStorage.clear` not a function)
  - `src/hooks/useSocket.test.tsx` assertions around disconnected status
  - dependent Board-page suites failing from the same environment issue
- `npm run build` ✅ passed
