# Developer Guide

This guide is for additive work while core feature development is in progress.

## Current Scope Snapshot

- Product status is tracked in `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/`.
- The active implementation has progressed through Story 05 work (`local canvas + persistence`) with Story 06+ still in motion.
- Prefer additive improvements (tests, docs, helper comments, small refactors) over behavioral rewrites.

## Repository Map

- `/Users/youss/Development/gauntlet/collab-board/src/pages/`
- `/Users/youss/Development/gauntlet/collab-board/src/hooks/`
- `/Users/youss/Development/gauntlet/collab-board/src/components/`
- `/Users/youss/Development/gauntlet/collab-board/src/lib/`
- `/Users/youss/Development/gauntlet/collab-board/server/`
- `/Users/youss/Development/gauntlet/collab-board/api/`
- `/Users/youss/Development/gauntlet/collab-board/docs/`

## Data Flow At A Glance

- Auth:
`AuthProvider` (`src/context/AuthContext.tsx`) listens to Firebase auth state.
`useAuth` exposes context in feature code.
- Board list and metadata:
`useBoards` (`src/hooks/useBoards.ts`) handles query, create, rename, delete with optimistic UI updates.
- Board canvas:
`Board` (`src/pages/Board.tsx`) owns Konva stage refs, local object state, persistence timing, and realtime hooks.
- Realtime:
`useSocket`/`usePresence`/`useCursors` on client plus Socket.IO handlers in `server/index.js`.
- AI endpoint:
Vercel function in `api/ai/generate.ts`.

## Safe Edit Zones (Low Conflict)

- New docs under `/Users/youss/Development/gauntlet/collab-board/docs/`.
- New tests adjacent to existing tested modules.
- Clarifying comments in stable helper functions (`src/lib`, isolated hook helpers).

## Higher Conflict Zones (Coordinate First)

- Large canvas behavior in `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`.
- Socket protocol and auth handshake in `/Users/youss/Development/gauntlet/collab-board/src/hooks/useSocket.ts` and `/Users/youss/Development/gauntlet/collab-board/server/index.js`.
- Realtime type contracts in `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`.

## Additive PR Checklist

- Keep behavior unchanged unless a bug fix is explicit.
- Prefer new files over broad rewrites.
- Add/update tests with every non-trivial change.
- Run targeted tests first, then full test suite before merge.
