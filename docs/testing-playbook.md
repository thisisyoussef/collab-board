# Testing Playbook

This playbook documents current test patterns used in this repository.

## Commands

```bash
# Full suite
npm run test

# Watch mode
npm run test:watch

# Single file
npx vitest run src/hooks/useBoards.test.tsx

# Filter by test name
npx vitest run -t "useBoards"
```

## Test Layout

- Frontend tests live next to source files as `*.test.ts` or `*.test.tsx`.
- Server helper tests live under `/Users/youss/Development/gauntlet/collab-board/server/`.
- Shared test setup is `/Users/youss/Development/gauntlet/collab-board/src/test/setup.ts`.

## Mocking Patterns In Use

- Router:
Mock `useNavigate` for navigation assertions in page/component tests.
- Firebase/Firestore:
Mock `firebase/firestore/lite` and `src/lib/firebase` imports at module boundary.
- Socket:
Use socket-like test doubles (`on`, `off`, `emit`, `trigger`) for hook tests.
- Konva:
Prefer lightweight `react-konva` mocks for DOM-oriented tests.

## Suggested Coverage Priorities

- Hooks with side effects (`useBoards`, realtime hooks, auth hooks).
- Error and rollback behavior for optimistic updates.
- Route guards and auth transitions.
- Server payload shaping/normalization helpers.

## Fast Sanity Checklist Before Push

- New logic has at least one success-path test.
- Error path is tested for any catch branch.
- Optimistic update code has rollback coverage.
- Test names describe behavior, not implementation details.
