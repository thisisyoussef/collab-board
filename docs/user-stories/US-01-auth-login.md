# US-01: Auth + Product Dashboard Flow

## Status

- State: Approved
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
  createdBy: string; // compatibility with existing Firestore docs/rules
  title: string;
  objects: Record<string, unknown>;
  createdAt: serverTimestamp();
  updatedAt: serverTimestamp();
}
```

## Setup Prerequisites

### Firebase Console

1. Firebase project exists and **Firestore Database** is created (Native mode, not Datastore mode).
2. Authentication → Sign-in method → **Google** is enabled.
3. Authentication → Settings → Authorized domains include:
   - `localhost`
   - `collab-board-iota.vercel.app` (your Vercel production domain)
4. Firestore rules deployed (via `firebase deploy --only firestore:rules` or Firebase Console).

### Client Environment Variables (Vercel + local `.env`)

```bash
VITE_FIREBASE_API_KEY=...          # Firebase Console → Project Settings → General → Web API Key
VITE_FIREBASE_AUTH_DOMAIN=...      # your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=...       # your-project-id
VITE_FIREBASE_STORAGE_BUCKET=...   # your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...   # optional, for Analytics
```

All `VITE_` prefixed vars are exposed to the browser — this is intentional for Firebase client SDK config (these are not secrets).

### Firestore Security Rules

5. Firestore rules allow authenticated CRUD on `boards`:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isBoardOwner(data) {
      return data.createdBy == request.auth.uid || data.ownerId == request.auth.uid;
    }

    match /boards/{boardId} {
      allow create: if signedIn() && isBoardOwner(request.resource.data);
      allow read: if signedIn() && isBoardOwner(resource.data);
      allow update: if signedIn()
                    && isBoardOwner(resource.data)
                    && isBoardOwner(request.resource.data);
      allow delete: if signedIn() && isBoardOwner(resource.data);
    }
  }
}
```

> **Note for US-05+:** These rules restrict read/update to board owners only. When multiplayer collaboration is added (shared board links), the read/update rules will need to be relaxed to `allow read, update: if signedIn()` so any authenticated user can collaborate on a board via its URL. Delete should remain owner-only.

## Implementation Notes

### Optimistic Board Creation (Navigate-First Pattern)

`createBoard()` in `useBoards.ts` returns `{ id, committed }` **synchronously**. The dashboard immediately navigates to `/board/:id` without waiting for Firestore to confirm the write. The Firestore `setDoc` runs in the background via the `committed` promise. If the write fails, the board is removed from the local list — but since the user is already on the board page, they'll see the board shell. This pattern eliminates perceived latency on board creation.

```ts
const handleCreateBoard = () => {
  const { id: boardId, committed } = createBoard(newBoardName);
  openBoard(boardId);                    // navigate immediately
  void committed.catch(console.error);   // fire-and-forget write
};
```

### Optimistic Rename & Delete

- **Rename:** Updates the local `boards` array immediately, then calls `updateDoc`. On failure, rolls back to the previous title.
- **Delete:** Removes the board from the local array immediately, then calls `deleteDoc`. On failure, re-inserts the board.

Both patterns use `setBoards()` for instant UI feedback and only revert on Firestore errors.

### Firestore Lite SDK

Uses `firebase/firestore/lite` (REST-based, no WebChannel) to avoid transport issues in extension-heavy browsers. All reads use `getDocs`/`getDoc` (no real-time listeners in US-01).

### Dual-Field Board Query

The dashboard queries boards by both `ownerId` and `createdBy` fields in parallel (`Promise.all`) for backward compatibility with existing Firestore documents, then deduplicates by board ID.

### Board Document Initialization

New boards are created with an empty `objects: {}` map, ready for canvas object storage in US-05+:

```ts
setDoc(boardRef, {
  ownerId: userId,
  createdBy: userId,
  title: cleanedTitle,
  objects: {},
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
```

### Board Page Layout

The board page (`Board.tsx`) uses a Figma-like layout:
- **Topbar** (`figma-board-topbar`): 3-column grid — left (menu/brand/title), middle (tool buttons), right (presence pill/avatar/actions)
- **Workspace** (`figma-board-workspace`): 3-column grid — left rail (64px tool buttons), canvas shell (flex), right properties panel (260px)
- Board title supports inline editing with Save/Cancel/Escape in the topbar
- Navigation back to dashboard via "Dashboard" button (not "Back")
- Board ID is never displayed in the UI

### Dashboard Layout

The dashboard (`Dashboard.tsx`) uses a 2-column layout:
- **Topbar** (`dashboard-topbar`): brand, user name, avatar, sign out
- **Shell** (`dashboard-shell`): sidebar (workspace/boards) + main area (board cards with Open/Rename/Delete actions)
- Board count label: "N boards" (singular "1 board")
- Board cards sorted by `updatedAtMs` descending

## Implementation Files

- `src/lib/firebase.ts` — Firebase app + Auth + Firestore initialization
- `src/lib/firestore-client.ts` — Timeout wrapper + user-friendly error messages
- `src/context/auth-context.ts` — Auth context type definition
- `src/context/AuthContext.tsx` — Auth provider with `onAuthStateChanged` listener
- `src/hooks/useAuth.ts` — Auth consumer hook (user, signIn, signOut)
- `src/hooks/useBoards.ts` — Board CRUD with optimistic updates, dual-field query, Firestore Lite
- `src/components/ProtectedRoute.tsx` — Route guard redirecting to `/` if not authenticated
- `src/pages/Landing.tsx` — Marketing hero + Google sign-in button
- `src/pages/Dashboard.tsx` — Board list with create/rename/delete, sidebar, board cards
- `src/pages/Board.tsx` — Figma-like board shell (topbar, left rail, canvas shell, right panel)
- `src/App.tsx` — Routes: `/` → Landing, `/dashboard` → Dashboard (protected), `/board/:id` → Board (protected)
- `src/index.css` — Complete CSS design system with Figma-like layout classes

## Acceptance Criteria

- [x] User can sign in with Google on `/`.
- [x] After sign-in, user lands on `/dashboard`.
- [x] Dashboard lists only user-owned boards.
- [x] User can create a board from dashboard and is immediately navigated to that new board.
- [x] User can rename a board from dashboard and persist the change.
- [x] User can rename a board while the board page is open.
- [x] User can delete a board with confirmation.
- [x] User can open a board (`/board/:id`) from dashboard.
- [x] Board ID is not visibly displayed in the board UI.
- [x] Board create/rename/delete flows never remain in infinite loading states.
- [x] If Firestore transport is blocked, UI shows a clear remediation hint.
- [x] Signed-out user cannot access `/dashboard` or `/board/:id`.
- [x] Sign out returns user to `/`.
- [x] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Visit production URL while signed out, verify login page appears.
2. Sign in with Google, verify redirect to `/dashboard`.
3. Create a board named `Sprint Plan`, verify app immediately opens `/board/:id` for that new board.
4. Rename it to `Sprint Plan V2`, verify list updates and Save button reflects active saving state.
5. Open the board, verify `/board/:id` loads and board ID is not shown in UI.
6. Rename the board from the board page title controls, then return to dashboard and verify the new title is reflected.
7. Go back to dashboard and delete the board, verify it disappears.
8. Sign out, then try to open `/dashboard` directly and verify redirect to `/`.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- User Validation: Passed on February 17, 2026
- Notes:
  Expanded US-01 scope to full dashboard-based product flow with board CRUD, responsive rename interactions, in-board title editing, and Firestore timeout/blocker resilience.
  Current implementation uses Firestore Lite REST calls for board CRUD to avoid blocked WebChannel transport in extension-heavy browsers.
  Firestore was enabled in project `collab-board-c15b8`, rules were published, and authorized domain `collab-board-iota.vercel.app` was added.
