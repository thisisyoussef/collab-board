# US-03: Presence Awareness

## Status

- State: In Progress (Implemented, Awaiting Deployment + User Validation)
- Owner: Codex
- Depends on: US-02 Approved

## Persona

**Alex, the Facilitator** — Alex just shared a board link in the team Slack channel. Before starting the brainstorming session, Alex wants to glance at the topbar and see who's already on the board. When Sam joins, Alex expects their avatar to appear immediately — not after a refresh, not after a delay. This is how Alex knows the session can begin.

**Sam, the Participant** — Sam clicks the board link from Slack. The board loads and Sam immediately sees Alex's avatar in the topbar — confirmation that Sam is in the right place and that the board is live. Sam doesn't need to send a "I'm here" message; their presence is visible automatically.

**Jordan, the Late Joiner** — Jordan joins 10 minutes into the session. Jordan sees 4 avatars in the topbar and knows the discussion is active. When one teammate leaves, their avatar disappears — Jordan knows who's still around without asking.

## User Story

> As Alex, I want to see who's currently on my board in real time so I know when teammates have joined and I can start the session.

> As Sam, I want to see other people on the board when I join so I know I'm in the right place and connected.

> As Jordan, I want presence to update automatically — people appear when they arrive and disappear when they leave — so I always know who's actively on the board.

## Goal

Show a live presence indicator in the board topbar showing all users currently on the same board, updated in real time as people join and leave. The indicator integrates into the existing Figma-like topbar layout.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — "Rooms" section (joining, leaving, disconnecting), "Presence Pattern" (fetchSockets + data), "Disconnection" (use `disconnecting` event, not `disconnect`, to access rooms)
- **Required reading:** `docs/pre-search.md` §9 — "What the Socket.io server handles" (`join-board`, presence tracking)
- **Reference:** `CLAUDE.md` — "When React State IS Appropriate" (presence list is a correct use of React state), `usePresence` hook pattern
- **Check:** Existing server code from US-02 — extend it, don't rewrite. Verify `socket.data` is populated during auth middleware.

**Be strategic:** Presence is server-side in-memory state, not Firestore. Use `io.in(room).fetchSockets()` to get current members and broadcast a snapshot. The `disconnecting` event (not `disconnect`) is critical — it fires while the socket is still in its rooms, so you can broadcast departure to the right room. Keep the UI simple — avatar circles in the topbar. Don't over-engineer; a `Map<socketId, user>` on the server is sufficient.

## Setup Prerequisites

**No new infrastructure.** This story extends the existing Socket.IO server from US-02 and the existing Board page from US-01.

- **Server:** Extend `server/index.js` with `join-board`, `presence:snapshot`, `user:joined`, `user:left` handlers. Redeploy to Render after changes (`git push` triggers auto-deploy if configured, or manual deploy from Render dashboard).
- **Client:** No new dependencies. Uses the `socket` ref from `useSocket` (US-02).
- **Firestore:** Not used for presence. Presence is purely in-memory on the Socket.IO server — ephemeral by design.
- **Color generation:** The `generateColor(userId)` utility produces deterministic HSL colors from user IDs. This is a pure function — no external setup.

## Screens

### Screen: Board Topbar — Presence Avatars

Presence avatars live in the topbar's right cluster, between the connection indicator and the action buttons.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ≡  ● CollabBoard  Sprint Plan V2 [Rename]  Move Frame Text Shape    │
│                                  🟢 Live  (AJ) (SD) (JW)  [Dashboard]│
└─────────────────────────────────────────────────────────────────────┘
```

**Avatar design (extends existing `avatar-badge` class):**
- Size: `30px` diameter, `border-radius: 50%`.
- Background: deterministic color derived from user ID (hash → HSL: hue from hash, saturation 65%, lightness 55%).
- Initials: first letter of first name + first letter of last name (or first 2 letters of email), `color: #fff`, `font-size: 0.78rem`, `font-weight: 700`, centered.
- Stacking: avatars overlap slightly (`margin-left: -6px` after the first). Max 6 visible; if >6, show 5 + a gray circle "+N".
- Animation: new avatar scales in (`transform: scale(0) → scale(1)`, 200ms ease-out). Departing avatar fades out (`opacity: 1 → 0`, 150ms).

**Current user's avatar:** has a `2px solid #2563eb` ring (the brand color) around their circle. This is already partially styled as `avatar-badge` in the CSS.

### Screen: Topbar — Solo User

```
│                                        🟢 Live  (AJ)  [Dashboard]   │
```

When only Alex is on the board, only their avatar appears. No count label — the presence is self-evident.

### Screen: Topbar — Multiple Users

```
│                           🟢 Live  (AJ)(SD)(JW) 3 people [Dashboard]│
```

- When 2+ users are present, a subtle count label appears: "N people" in `color: var(--muted)`, `font-size: 0.78rem`.
- When exactly 1 user: no count label (implied: "just you").

### Screen: Topbar — User Joins (Animation)

1. Sam opens the board URL.
2. Alex's topbar updates: Sam's avatar circle slides/scales in from the right. Count changes to "2 people".
3. Transition is smooth (200ms) — not jarring.

### Screen: Topbar — User Leaves (Animation)

1. Jordan closes their browser tab.
2. Within 2-3 seconds, Jordan's avatar fades out. Count decreases.
3. If only Alex remains, the count label disappears.

## UX Script

### Happy Path: Two Users Join the Same Board

1. Alex opens a board from the dashboard. Socket connects (US-02). Client emits `join-board` with `{ boardId, user: { id, displayName, color } }`.
2. Server receives `join-board`:
   - `socket.join("board:{boardId}")`
   - Sets `socket.data.boardId = boardId`.
   - Fetches all sockets in the room via `io.in("board:{boardId}").fetchSockets()`.
   - Builds presence list: `[{ socketId, userId, displayName, color }]` for each socket.
   - Emits `presence:snapshot` to the joining socket (full list).
   - Emits `user:joined` to all other sockets in the room (just the new user).
3. Alex sees their own avatar in the topbar. No count label — just them.
4. Sam opens the same board URL. Same flow repeats.
5. Alex receives `user:joined` → Sam's avatar appears in Alex's topbar. Count shows "2 people".
6. Sam receives `presence:snapshot` → sees both Alex and Sam in the topbar.

### Happy Path: User Returns to Dashboard

1. Sam clicks "Dashboard" to return to board management.
2. Board component unmounts → socket disconnects.
3. Server fires `disconnecting` → emits `user:left` to the room.
4. Alex's topbar updates: Sam's avatar fades out. Count disappears (back to solo).

### Edge: User Closes Tab (Abrupt Disconnect)

1. Jordan closes the browser tab without clicking "Dashboard".
2. Socket.IO detects the disconnect. Server fires `disconnecting` (socket still in rooms).
3. Server emits `user:left` to the room with Jordan's user data.
4. Alex and Sam receive `user:left` → Jordan's avatar fades out within 2-3 seconds.

### Edge: Rapid Join/Leave

1. 5 users join within 2 seconds. Each triggers `user:joined`.
2. React batches state updates naturally — avatars appear smoothly, no flicker.

### Edge: Same User, Multiple Tabs

1. Alex opens the board in two tabs. Both sockets join the room.
2. Presence shows Alex's avatar twice (each socket has a unique `socket.id`). This is acceptable — deduplication by `userId` is a future enhancement.

### Edge: Board with Many Users

1. 10 users are on the same board.
2. Topbar shows 5 avatars + a "+5" overflow circle. Hovering the overflow shows a tooltip with all names (future enhancement — for now, just the count).

## Implementation Details

### Server Changes (extend `server/index.js`)

```js
io.on("connection", (socket) => {
  socket.on("join-board", async ({ boardId }) => {
    socket.join(`board:${boardId}`);
    socket.data.boardId = boardId;

    // Full presence snapshot for the joining user
    const sockets = await io.in(`board:${boardId}`).fetchSockets();
    const users = sockets.map((s) => ({
      socketId: s.id,
      userId: s.data.userId,
      displayName: s.data.displayName,
      color: s.data.color || generateColor(s.data.userId),
    }));
    socket.emit("presence:snapshot", users);

    // Notify everyone else
    socket.to(`board:${boardId}`).emit("user:joined", {
      socketId: socket.id,
      userId: socket.data.userId,
      displayName: socket.data.displayName,
      color: socket.data.color || generateColor(socket.data.userId),
    });
  });

  socket.on("disconnecting", () => {
    const { boardId } = socket.data || {};
    if (boardId) {
      socket.to(`board:${boardId}`).emit("user:left", {
        socketId: socket.id,
        userId: socket.data.userId,
      });
    }
  });
});
```

### Client Files

| File | Purpose |
|------|---------|
| `src/hooks/usePresence.ts` | Listens for `presence:snapshot`, `user:joined`, `user:left`. Returns `members` array (React state — appropriate here since it's a small list). |
| `src/components/PresenceAvatars.tsx` | Renders avatar circles in the topbar from the members array. Handles animation, overflow, self-indicator ring. |
| `src/lib/utils.ts` | `generateColor(userId)` — deterministic HSL from user ID hash. |
| `src/pages/Board.tsx` | Mounts `usePresence`, renders `PresenceAvatars` in the topbar right cluster. |

### Color Generation

```ts
function generateColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}
```

### Topbar Integration

Replace the static `avatar-badge` in the topbar right cluster with the dynamic `PresenceAvatars` component:

```tsx
{/* Before (static) */}
<span className="avatar-badge">{userInitial}</span>

{/* After (dynamic presence) */}
<PresenceAvatars members={members} currentUserId={user.uid} />
```

## Acceptance Criteria

- [x] Client emits `join-board` on board mount with board ID and user info.
- [x] Server joins socket to `board:{boardId}` room.
- [x] Joining user receives `presence:snapshot` with all currently present users.
- [x] Other users receive `user:joined` with the new user's info.
- [x] Closing a tab triggers `user:left` for all remaining users within 3 seconds.
- [x] Presence avatars render in the topbar right cluster with deterministic colors and initials.
- [x] Current user's avatar has a blue ring indicator (`2px solid #2563eb`).
- [x] Multiple users shows "N people" count. Single user shows no count.
- [x] Avatars animate in (scale-up) and out (fade-out) smoothly.
- [x] No visible board ID in the UI anywhere.
- [x] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open a board from the dashboard. Verify your avatar appears in the topbar right cluster next to the connection indicator.
2. Open the same board URL in an incognito/different browser. Verify both browsers show 2 avatars and "2 people".
3. Close the incognito browser. Within 3 seconds, verify the first browser drops back to 1 avatar, count disappears.
4. Open the same board in 3 browsers. Verify all 3 show 3 avatars and "3 people".

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending
- Notes:
  US-03 presence awareness implemented with Socket.IO room join flow (`join-board`, `presence:snapshot`, `user:joined`, `user:left`) and a new topbar presence UI (deterministic avatar colors, initials, self ring, overflow, and people count).  
  Added client/server helper and hook tests plus UI tests.  
  Local validation on February 18, 2026: `npm run lint`, `npm run test`, `npm run build` all passing.
