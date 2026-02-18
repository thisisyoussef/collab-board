# US-06: Realtime Object Sync + Conflict Handling

## Status

- State: In Progress (Implemented + Deployed, Awaiting User Validation)
- Owner: Codex
- Depends on: US-05 Approved

## Persona

**Alex, the Facilitator** — Alex is running a live brainstorming session with Sam. Alex drops a sticky note on the board and expects Sam to see it appear instantly — no refresh, no delay. When both Alex and Sam drag the same sticky note at the same time, Alex expects the board to resolve the conflict cleanly without crashing or losing data.

**Sam, the Participant** — Sam is adding ideas alongside Alex. When Sam creates a new rectangle, it should appear on Alex's screen within a fraction of a second. If Sam deletes a sticky that Alex just moved, the deletion should win (it's the more recent action). Sam expects the board to "just work" like Google Docs — no manual sync buttons, no stale views.

## User Story

> As Alex, I want to see Sam's changes on the board in real time so our brainstorming session feels live and collaborative.

> As Sam, I want my edits to sync to all other users instantly, and I want conflicts (like two people editing the same object) to resolve automatically without data loss.

## Goal

Wire up Socket.IO broadcast for object CRUD (create, update, delete) between all users on a board. Implement last-write-wins conflict resolution using `updatedAt` timestamps. Maintain the debounced Firestore persistence from US-05 — now triggered by both local and remote changes.

## Implementation Protocol (Same Rigor as US-04)

1. Implement only US-06 scope on top of approved US-05.
2. Validate locally before deployment: `npm run lint`, `npm run test`, `npm run build`.
3. Deploy frontend and socket backend to production.
4. Update this story's checkpoint section and `docs/user-stories/phase1-checkpoint-log.md` with commit SHA, URLs, latency metrics, and exact validation notes.
5. Pause for user checkpoint approval before starting US-07.
6. If checkpoint fails, fix-forward on US-06 only and re-validate.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — "Board Room Pattern" (object:create/update/delete handlers), emit patterns, acknowledgements
- **Required reading:** `docs/firebase-firestore.md` — "Debounced Board Save" pattern, `updateDoc` with dot notation for individual object fields
- **Required reading:** `docs/konva-api.md` — `findOne` by ID, `setAttrs`, `destroy`, `batchDraw`
- **Reference:** `CLAUDE.md` — `useRealtimeBoard` hook pattern (publish functions, debounced Firestore save, skip own echoed events via `clientId`), conflict resolution (`resolveConflict` using `updatedAt`), "Anti-Patterns" section (never write every change to Firestore, never use React state for canvas objects)
- **Reference:** `docs/pre-search.md` §8 — Firestore cost optimization (debouncing), data ownership table
- **Check:** Existing canvas code from US-05 — extend the ref-based update functions to also publish via Socket.IO

**Be strategic:** The flow is: local Konva update (optimistic) → Socket.IO publish → other clients receive → update their Konva stage via refs. Skip own echoed events by checking `socket.id` against the sender. Use `updatedAt` ISO timestamps on every object for last-write-wins — discard remote updates that are older than local. Debounce Firestore writes (currently tuned to `300ms` for UX). Send full object state, not diffs — simplicity over bandwidth for this scale.

## Setup Prerequisites

**No new infrastructure.** This story wires together the existing pieces:

- **Server:** Add `object:create`, `object:update`, `object:delete` handlers to `server/index.js`. These use `socket.to(room)` (NOT `socket.volatile.to`) — object events must be delivered reliably. Redeploy to Render.
- **Client:** No new npm dependencies. Uses the existing socket ref (US-02), Konva refs (US-05), and Firestore (US-05).
- **Firestore:** Uses the same debounced `updateDoc` pattern from US-05. No schema changes — the `objects` map in the board document is already set up.
- **Firestore write budget:** With debouncing (`300ms` current tuning), active editing stays bounded versus unthrottled writes. If cost pressure increases, increase debounce toward 1-3s.
- **Testing setup:** To test multiplayer sync, open the same board URL in two different browsers (or one regular + one incognito window). Both must be signed in (can be the same or different Google accounts depending on your Firestore rules).

## Screens

### Screen: Board Page — Two Users Collaborating

Both users see the same board through the Figma-like layout. Objects created by either user appear on both canvases in real time.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ≡  ● CollabBoard  Sprint Plan V2 [Rename]  Move Frame Text Shape    │
│                                  🟢 Live  (AJ)(SD) 2 people [Dash…]│
├──────┬──────────────────────────────────────────────────────────┬───┤
│  ↖   │                                                          │ P │
│  □   │     ┌────────────┐                                       │ r │
│  ○   │     │ User       │  ← Alex's sticky (created locally)   │ o │
│  T   │     │ Research   │                                       │ p │
│  ↔   │     └────────────┘                                       │ e │
│      │            ┌────────────┐                                │ r │
│      │            │ Sam's Idea │  ← Sam's sticky (synced via    │ t │
│      │            │            │    Socket.IO — appeared         │ i │
│      │            └────────────┘    instantly)                   │ e │
│      │                   ┌──────────────┐                       │ s │
│      │                   │              │  ← rectangle (synced) │   │
│      │                   └──────────────┘                       │   │
└──────┴──────────────────────────────────────────────────────────┴───┘
```

Key visual behaviors:
- When a remote user creates an object, it appears on the canvas smoothly — no flash, no page reload.
- When a remote user drags an object, it moves on your screen in near-real-time.
- When a remote user deletes an object, it disappears from your canvas immediately.

### Screen: Metrics Overlay — Object Sync Latency

```
┌──────────────────────┐
│  FPS: 60             │
│  Cursor avg: 23ms ✅  │
│  Object avg: 45ms ✅  │
│  Users: 2 | Obj: 8   │
└──────────────────────┘
```

- **Object avg** line added: shows average latency for `object:create`/`object:update`/`object:delete` events.
- Format: "Object avg: {N}ms" with ✅ if <100ms, ⚠️ if >=100ms.

### Screen: Conflict Resolution (Invisible to User)

When two users edit the same object simultaneously:

```
Alex drags sticky to (300, 400) at t=1000
Sam drags sticky to (500, 200) at t=1020

Alex receives Sam's update:
  remote.updatedAt (1020) > local.updatedAt (1000) → accept Sam's position
  Sticky snaps to (500, 200) on Alex's screen

Sam receives Alex's update:
  remote.updatedAt (1000) < local.updatedAt (1020) → discard Alex's update
  Sticky stays at (500, 200) on Sam's screen

Result: Both screens converge to (500, 200). Last write wins.
```

This is invisible to the user — no dialog, no error. The board just converges.

## UX Script

### Happy Path: Alex Creates, Sam Sees

1. Alex and Sam both have the board open. Both see 🟢 Live and 2 presence avatars in the topbar.
2. Alex clicks the `□` (Sticky Note) tool in the left rail, clicks the canvas at (200, 300). A yellow sticky appears on Alex's canvas immediately (optimistic local update).
3. Behind the scenes:
   - Alex's `addObject()` updates `objectsRef`, adds Konva node to the layer, calls `batchDraw()`.
   - Alex's client emits `object:create` via Socket.IO with the full object data including `updatedAt: new Date().toISOString()`.
   - Server receives `object:create`, broadcasts to all other sockets in the board room.
4. Sam's client receives `object:create`:
   - Checks `socketId !== socket.id` (it's not Sam's own echo) → processes it.
   - Creates a new Konva node on Sam's objects layer with the received attributes.
   - Updates Sam's `objectsRef` with the new object.
   - Calls `batchDraw()`.
5. The sticky appears on Sam's canvas within <100ms of Alex creating it.
6. The debounced Firestore save fires 3 seconds after the last change, persisting the full objects map.

### Happy Path: Sam Moves, Alex Sees

1. Sam clicks Alex's sticky note (select tool ↖). Transformer handles appear. Right properties panel shows the sticky's details.
2. Sam drags the sticky to a new position (400, 500). On each drag frame:
   - Sam's local Konva node updates position (standard Konva drag behavior).
3. On `dragend`:
   - Sam's client calls `updateObject(id, { x: 400, y: 500, updatedAt: now })`.
   - Updates `objectsRef`, emits `object:update` with `{ id, attrs: { x: 400, y: 500, updatedAt } }`.
4. Alex's client receives `object:update`:
   - Finds the Konva node by `#id`.
   - Calls `node.setAttrs({ x: 400, y: 500 })` and `batchDraw()`.
   - Updates Alex's `objectsRef`.
5. The sticky jumps to its new position on Alex's canvas.

### Happy Path: Alex Deletes, Sam Sees It Disappear

1. Alex selects a rectangle and presses `Delete`.
2. Alex's client calls `removeObject(id)`:
   - Finds Konva node by `#id`, calls `node.destroy()`, `batchDraw()`.
   - Removes from `objectsRef`.
   - Emits `object:delete` with `{ id }`.
3. Sam's client receives `object:delete`:
   - Finds Konva node by `#id`, calls `node.destroy()`, `batchDraw()`.
   - Removes from `objectsRef`.
4. The rectangle disappears from Sam's canvas. If Sam had it selected, the selection clears and the right properties panel reverts to "Selection: None".

### Edge: Conflicting Edits (Last Write Wins)

1. Alex and Sam both select the same sticky note.
2. Alex drags it to (300, 400) at time T. Sam drags it to (500, 200) at time T+20ms.
3. Both emit `object:update` with their respective `updatedAt` timestamps.
4. Alex receives Sam's update: `remote.updatedAt > local.updatedAt` → **accept**. Alex's sticky moves to (500, 200).
5. Sam receives Alex's update: `remote.updatedAt < local.updatedAt` → **discard**. Sam's sticky stays at (500, 200).
6. Both screens show (500, 200). Convergence achieved.

### Edge: Rapid Edits (Debounced Persistence)

1. Alex moves a sticky 15 times in 3 seconds. Each move emits `object:update` to Socket.IO immediately (real-time sync).
2. The debounced Firestore save only fires once, 3 seconds after the last move — writing the final state.
3. If Alex refreshes during the moves (before debounce fires), the last persisted state loads. Some recent moves may be lost — acceptable for Phase I.

### Edge: Delete During Edit

1. Sam is typing in a sticky note (text editor open).
2. Alex deletes that sticky note.
3. Sam receives `object:delete` → the Konva node is destroyed. If the text editor is open for that object, it closes automatically.
4. Sam sees the sticky disappear and the text editor close. No crash.

### Edge: Create Arrives Before Board Load

1. Sam opens the board. Firestore load begins.
2. Before load completes, Alex creates a new sticky. The `object:create` event arrives.
3. Sam's client queues the event until the initial load is complete, then applies it.
4. Alternatively: Sam's client can ignore events until `isLoaded` flag is true, since the Firestore load will include the latest state.

## Implementation Details

### Server Changes (extend `server/index.js`)

```js
// Inside io.on("connection", (socket) => { ... })

socket.on("object:create", (data) => {
  const { boardId } = socket.data;
  if (boardId) {
    socket.to(`board:${boardId}`).emit("object:create", {
      ...data,
      socketId: socket.id,
    });
  }
});

socket.on("object:update", (data) => {
  const { boardId } = socket.data;
  if (boardId) {
    socket.to(`board:${boardId}`).emit("object:update", {
      ...data,
      socketId: socket.id,
    });
  }
});

socket.on("object:delete", (data) => {
  const { boardId } = socket.data;
  if (boardId) {
    socket.to(`board:${boardId}`).emit("object:delete", {
      ...data,
      socketId: socket.id,
    });
  }
});
```

Note: Using `socket.to(room)` (not `socket.volatile.to(room)`) — object events are NOT volatile. Every create/update/delete must be delivered reliably.

### Client Files

| File | Purpose |
|------|---------|
| `src/hooks/useRealtimeBoard.ts` | Subscribe to `object:create`, `object:update`, `object:delete`. Expose `publishCreate`, `publishUpdate`, `publishDelete` functions. Debounced Firestore save. Conflict resolution. |
| `src/hooks/useBoard.ts` | Extended from US-05: `addObject`, `updateObject`, `removeObject` now also call `useRealtimeBoard` publish functions. |
| `src/components/Canvas.tsx` | Wire up realtime hook. Handle remote object creation (add Konva nodes), updates (setAttrs), deletes (destroy). |
| `src/components/MetricsOverlay.tsx` | Add object sync latency measurement. |

### useRealtimeBoard Hook

```ts
function useRealtimeBoard(
  boardId: string,
  socketRef: React.RefObject<Socket>,
  stageRef: React.RefObject<Konva.Stage>,
  layerRef: React.RefObject<Konva.Layer>,
  objectsRef: React.RefObject<Map<string, BoardObject>>
) {
  const debouncedSave = useRef(
    debounce(() => {
      const objects: Record<string, BoardObject> = {};
      objectsRef.current.forEach((obj, id) => {
        objects[id] = obj;
      });
      updateDoc(doc(db, "boards", boardId), {
        objects,
        updatedAt: serverTimestamp(),
      });
    }, 3000)
  ).current;

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on("object:create", (data) => {
      if (data.socketId === socket.id) return; // skip own echo
      // Add to objectsRef and Konva layer
      objectsRef.current.set(data.id, data);
      const shape = createKonvaNode(data);
      layerRef.current.add(shape);
      layerRef.current.batchDraw();
      debouncedSave();
    });

    socket.on("object:update", (data) => {
      if (data.socketId === socket.id) return;
      const local = objectsRef.current.get(data.id);
      if (local && new Date(data.attrs.updatedAt) <= new Date(local.updatedAt)) {
        return; // discard stale update
      }
      // Apply to Konva
      const node = stageRef.current.findOne(`#${data.id}`);
      if (node) {
        node.setAttrs(data.attrs);
        layerRef.current.batchDraw();
      }
      // Apply to objectsRef
      if (local) {
        objectsRef.current.set(data.id, { ...local, ...data.attrs });
      }
      debouncedSave();
    });

    socket.on("object:delete", (data) => {
      if (data.socketId === socket.id) return;
      const node = stageRef.current.findOne(`#${data.id}`);
      if (node) {
        node.destroy();
        layerRef.current.batchDraw();
      }
      objectsRef.current.delete(data.id);
      debouncedSave();
    });

    return () => {
      socket.off("object:create");
      socket.off("object:update");
      socket.off("object:delete");
    };
  }, [boardId]);

  const publishCreate = useCallback((object: BoardObject) => {
    socketRef.current?.emit("object:create", object);
    debouncedSave();
  }, []);

  const publishUpdate = useCallback((id: string, attrs: Partial<BoardObject>) => {
    socketRef.current?.emit("object:update", { id, attrs });
    debouncedSave();
  }, []);

  const publishDelete = useCallback((id: string) => {
    socketRef.current?.emit("object:delete", { id });
    debouncedSave();
  }, []);

  return { publishCreate, publishUpdate, publishDelete };
}
```

### Conflict Resolution Logic

```ts
function resolveConflict(localObj: BoardObject, remoteAttrs: Partial<BoardObject>): boolean {
  // Returns true if remote update should be applied
  if (!remoteAttrs.updatedAt) return true;
  if (!localObj.updatedAt) return true;
  return new Date(remoteAttrs.updatedAt) > new Date(localObj.updatedAt);
}
```

### Object Event Payloads

```ts
// object:create — full object
{
  id: "uuid-123",
  type: "sticky",
  x: 200, y: 300,
  width: 150, height: 100,
  text: "New note",
  color: "#FFEB3B",
  rotation: 0,
  zIndex: 1,
  createdBy: "userId",
  updatedAt: "2026-02-17T10:30:00.000Z",
  socketId: "server-injected"  // added by server
}

// object:update — id + changed attrs
{
  id: "uuid-123",
  attrs: {
    x: 400, y: 500,
    updatedAt: "2026-02-17T10:30:05.000Z"
  },
  socketId: "server-injected"
}

// object:delete — just the id
{
  id: "uuid-123",
  socketId: "server-injected"
}
```

### Latency Measurement

Every `object:create` and `object:update` event includes `_ts: Date.now()` from the sender. The receiver calculates latency as `Date.now() - data._ts`. This feeds into the MetricsOverlay's "Object avg" display.

```ts
// Sender side
socketRef.current?.emit("object:create", { ...object, _ts: Date.now() });

// Receiver side
socket.on("object:create", (data) => {
  const latency = Date.now() - data._ts;
  recordObjectLatency(latency); // rolling average for MetricsOverlay
  // ... rest of handler
});
```

### Firestore Write Pattern

```
Action flow:
  User creates sticky → addObject() → Konva update → emit("object:create") → debouncedSave()
                                                                                    |
                                                                            ~300ms wait...
                                                                                    |
                                                                            updateDoc(boards/boardId, {
                                                                              objects: { ...allObjects },
                                                                              updatedAt: serverTimestamp()
                                                                            })
```

Without debouncing: very high write volume during active editing.
With debounce: write volume is bounded and predictable.

## Acceptance Criteria

- [x] Creating an object on one client appears on all other clients in real time.
- [x] Moving/resizing an object on one client updates on all other clients.
- [x] Deleting an object on one client removes it from all other clients.
- [x] Own echoed events are ignored (server broadcasts to room peers only).
- [x] Conflicting edits resolve via last-write-wins (`updatedAt` comparison).
- [x] Clients converge to the same state after conflicting edits.
- [x] Firestore writes are debounced (current tuning: `300ms`).
- [x] Object sync latency is measured and displayed in the metrics overlay.
- [x] Socket.IO object events use reliable delivery (no volatile object transport).
- [x] Text editor closes gracefully if the underlying object is deleted remotely.
- [x] Right properties panel clears selection if the selected object is deleted remotely.
- [x] Board state converges across connected clients with realtime events plus board snapshot fallback.
- [x] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open the same board in two browsers (A and B). Verify both show 🟢 Live and 2 presence avatars.
2. In Browser A, create a sticky note using the left rail `□` tool. Verify it appears in Browser B within 1 second.
3. In Browser A, drag the sticky to a new position. Verify it moves in Browser B.
4. In Browser B, double-click the sticky, change text to "Updated by Sam". Verify Browser A shows the new text.
5. In Browser B, create a rectangle using the left rail `○` tool. Verify it appears in Browser A.
6. In Browser A, select the rectangle and press Delete. Verify it disappears from both browsers.
7. Simultaneously drag the same object in both browsers. Release. Verify both screens converge to the same position.
8. Create 5 objects from each browser (10 total). Wait 5 seconds. Refresh Browser A. Verify all 10 objects reload from Firestore.
9. Check metrics overlay — "Object avg" should show <100ms with ✅.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending
- Notes:
  Implemented `object:create`, `object:update`, and `object:delete` realtime sync path with reliable socket emits and room broadcasts.
  Added conflict resolution for remote upserts/deletes via timestamp comparison (`updatedAt` and event `_ts`).
  Added remote-event queueing during initial board load to avoid race conditions before Firestore snapshot hydration.
  Added `Object avg` latency metric to the overlay and wired measurement from incoming object events.
  Local validation on February 18, 2026: `npm run lint`, `npm run test -- --run`, and `npm run build` all pass.
