# US-03: Presence Awareness

## Status

- State: Not Started
- Owner: Codex
- Depends on: US-02 Approved

## Persona

**Alex, the Facilitator** — Alex just shared a board link with two teammates (Sam and Jordan). Alex wants to see who's currently on the board before starting the session. When Sam joins, Alex expects to see their name pop up immediately. When Jordan leaves, Alex expects them to disappear within a couple seconds.

**Sam, the Participant** — Sam clicks Alex's board link. Sam wants immediate confirmation that they're in the right place — seeing Alex's name already on the board reassures them.

## User Story

> As Alex, I want to see who's currently on my board in real time so I know when my teammates have joined and I can start the session.

> As Sam, I want to see other people on the board when I join so I know I'm in the right place and connected.

## Goal

Show a live presence bar of all users currently on the same board, updated in real time as people join and leave.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — "Rooms" section (joining, leaving, disconnecting), "Presence Pattern" (fetchSockets + data), "Disconnection" (use `disconnecting` event, not `disconnect`, to access rooms)
- **Required reading:** `docs/pre-search.md` §9 — "What the Socket.io server handles" (`join-board`, presence tracking)
- **Reference:** `CLAUDE.md` — "When React State IS Appropriate" (presence list is a correct use of React state), `usePresence` hook pattern
- **Check:** Existing server code from US-02 — extend it, don't rewrite. Verify `socket.data` is populated during auth middleware.

**Be strategic:** Presence is server-side in-memory state, not Firestore. Use `io.in(room).fetchSockets()` to get current members and broadcast a snapshot. The `disconnecting` event (not `disconnect`) is critical — it fires while the socket is still in its rooms, so you can broadcast departure to the right room. Keep the UI simple — avatar dots or name chips. Don't over-engineer; a `Map<socketId, user>` on the server is sufficient.

## Screens

### Screen: Board Page — Presence Bar

The board header gains a presence bar showing colored avatar circles for each online user.

```
┌──────────────────────────────────────────────────────────────┐
│  Board Shell                                 🟢 Connected    │
│  Board ID: abc-123...                   [ Back ] [ Sign out] │
│                                                              │
│  Online: (AJ) (SD) (JW)    3 people                         │
└──────────────────────────────────────────────────────────────┘
```

**Presence bar design:**

- Position: below the board title/ID, inside the header card. Full width.
- Label: "Online:" in `color: #6b7280`, `font-size: 0.85rem`.
- Avatar circles: `28px` diameter, `border-radius: 50%`, each with a unique background color derived from the user's ID (deterministic hash → HSL hue, saturation 65%, lightness 55%).
- Initials: first letter of first name + first letter of last name (or first two letters of email), `color: #fff`, `font-size: 0.7rem`, `font-weight: 600`, centered.
- Count: "{N} people" — `color: #6b7280`, `font-size: 0.85rem`, next to the avatar row.
- Avatars stack horizontally with slight overlap (`margin-left: -4px` after the first), max 8 shown. If >8 users: show 7 avatars + a gray circle "+{N}".
- New avatar animates in with a subtle scale-up (`transform: scale(0) → scale(1)`, 200ms ease-out).
- Departing avatar fades out (`opacity: 1 → 0`, 200ms).

**User's own avatar:** slightly different — `2px solid #2563eb` ring around their circle to indicate "this is you."

### Screen: Board Page — Empty (just you)

```
  Online: (AJ)    Just you
```

- When only one user is present, show "Just you" instead of "1 people".

### Screen: Board Page — User Joins

1. Sam opens the board URL.
2. Alex's presence bar updates: Sam's avatar circle slides in from the right. Count changes from "Just you" to "2 people".

### Screen: Board Page — User Leaves

1. Jordan closes their browser tab.
2. Within 2-3 seconds, Jordan's avatar fades out. Count decreases.

## UX Script

### Happy Path: Two Users Join the Same Board

1. Alex opens `/board/abc123`. Socket connects (US-02). Client emits `join-board` with `{ boardId: "abc123", user: { id, displayName, color } }`.
2. Server receives `join-board`:
   - `socket.join("board:abc123")`
   - Sets `socket.data = { boardId, user }`.
   - Fetches all sockets in `board:abc123` via `io.in("board:abc123").fetchSockets()`.
   - Builds a presence list: `[{ id, displayName, color }]` for each socket.
   - Emits `presence:snapshot` to the joining socket (full list).
   - Emits `user:joined` to all other sockets in the room (just the new user).
3. Alex sees their own avatar. Presence bar shows "Just you".
4. Sam opens the same URL in another browser. Steps repeat.
5. Alex receives `user:joined` → adds Sam's avatar. Bar shows "2 people".
6. Sam receives `presence:snapshot` → sees both Alex and Sam listed.

### Edge: User Closes Tab

1. Jordan closes the browser tab.
2. Socket.IO fires `disconnecting` on the server (socket is still in rooms).
3. Server emits `user:left` to `board:abc123` with Jordan's user data.
4. Server's `disconnect` event fires. Socket auto-leaves all rooms.
5. Alex and Sam receive `user:left` → remove Jordan's avatar. Count decreases.

### Edge: Rapid Join/Leave

1. Multiple users join within 1 second. Each triggers `user:joined`.
2. Client batches UI updates — React state update is async, so rapid `setState` calls merge naturally.

### Edge: Same User, Multiple Tabs

1. Alex opens the board in two tabs. Both sockets join the room.
2. Presence list shows Alex twice (each socket has a unique `socket.id`). This is acceptable for Phase I — deduplication by `userId` is a Phase II enhancement.

## Implementation Details

### Server Changes (extend `server/index.js`)

```js
io.on("connection", (socket) => {
  socket.on("join-board", async ({ boardId }) => {
    socket.join(`board:${boardId}`);
    socket.data.boardId = boardId;

    // Send full presence list to the joining user
    const sockets = await io.in(`board:${boardId}`).fetchSockets();
    const users = sockets.map((s) => ({
      socketId: s.id,
      userId: s.data.userId,
      displayName: s.data.displayName,
      color: s.data.color || generateColor(s.data.userId),
    }));
    socket.emit("presence:snapshot", users);

    // Notify others
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
| `src/hooks/usePresence.ts` | Listens for `presence:snapshot`, `user:joined`, `user:left`. Returns `members` array. |
| `src/components/PresenceBar.tsx` | Renders avatar circles from the members array. |
| `src/lib/utils.ts` | `generateColor(userId)` — deterministic HSL from user ID hash. |
| `src/pages/Board.tsx` | Mounts `usePresence`, renders `PresenceBar` in the header. |

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

## Acceptance Criteria

- [ ] Client emits `join-board` on board mount with board ID and user info.
- [ ] Server joins socket to `board:{boardId}` room.
- [ ] Joining user receives `presence:snapshot` with all currently present users.
- [ ] Other users receive `user:joined` with the new user's info.
- [ ] Closing a tab triggers `user:left` for all remaining users within 3 seconds.
- [ ] Presence bar renders avatar circles with deterministic colors and initials.
- [ ] Current user's avatar has a blue ring indicator.
- [ ] Single user shows "Just you", multiple shows "{N} people".
- [ ] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open a board in Browser A. Verify presence bar shows your avatar and "Just you".
2. Open the same board URL in Browser B (different profile or incognito). Verify Browser A shows 2 avatars and "2 people". Verify Browser B also shows 2 avatars.
3. Close Browser B. Within 3 seconds, verify Browser A drops back to 1 avatar and "Just you".
4. Open the same board in 3 browsers. Verify all 3 show 3 avatars.

## Checkpoint Result

- Production Frontend URL:
- Production Socket URL:
- User Validation: Pending
- Notes:
