# US-01: Auth + Product Dashboard Flow

## Status

- State: Awaiting User Validation
- Owner: Codex
- Depends on: US-00 Approved

## Goal

Ship a real product-level entry flow:

- Public login page for Google auth
- Authenticated dashboard listing all user boards
- Board management actions: create, rename, delete, open
- Protected board route shell for a selected board

## User Story

As a signed-in user, I want a dashboard where I can manage boards (create, rename, delete, open) so the app feels like a real product workspace, not a prototype.

## Scope

### In

- Firebase Google sign-in and sign-out
- Protected routes (`/dashboard`, `/board/:id`)
- Firestore-backed board CRUD for the authenticated user
- Redirect authenticated users from landing to dashboard
- Product-style dashboard UI

### Out

- Realtime socket events (US-02+)
- Multiplayer presence/cursors/object sync (US-03+)

## Route Flow

- `/` (public login)
  - Signed out: show login experience
  - Signed in: redirect to `/dashboard`
- `/dashboard` (protected)
  - Show board list for current user
  - Create / rename / delete / open boards
- `/board/:id` (protected)
  - Board shell with dashboard navigation

## Data Contract (US-01)

Collection: `boards`

```ts
{
  ownerId: string;
  title: string;
  objects: Record<string, unknown>;
  createdAt: serverTimestamp();
  updatedAt: serverTimestamp();
}
```

## Implementation Files

- `src/lib/firebase.ts`
- `src/context/auth-context.ts`
- `src/context/AuthContext.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/useBoards.ts`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Landing.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Board.tsx`
- `src/App.tsx`
- `src/index.css`

## Acceptance Criteria

- [ ] User can sign in with Google on `/`.
- [ ] After sign-in, user lands on `/dashboard`.
- [ ] Dashboard lists only user-owned boards.
- [ ] User can create a board from dashboard and is immediately navigated to that new board.
- [ ] User can rename a board and persist the change.
- [ ] User can delete a board with confirmation.
- [ ] User can open a board (`/board/:id`) from dashboard.
- [ ] Signed-out user cannot access `/dashboard` or `/board/:id`.
- [ ] Sign out returns user to `/`.
- [ ] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Visit production URL while signed out, verify login page appears.
2. Sign in with Google, verify redirect to `/dashboard`.
3. Create a board named `Sprint Plan`, verify app immediately opens `/board/:id` for that new board.
4. Rename it to `Sprint Plan V2`, verify list updates.
5. Open the board, verify `/board/:id` loads.
6. Go back to dashboard and delete the board, verify it disappears.
7. Sign out, then try to open `/dashboard` directly and verify redirect to `/`.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- User Validation: Pending
- Notes: Expanded US-01 scope to full dashboard-based product flow with board CRUD.
