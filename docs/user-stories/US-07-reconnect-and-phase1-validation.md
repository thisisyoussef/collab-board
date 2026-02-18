# US-07: Reconnect Resilience + Phase I Validation

## Status

- State: Not Started
- Owner: Codex
- Depends on: US-06 Approved

## Persona

**Alex, the Facilitator** — Alex is in the middle of a brainstorming session when their Wi-Fi drops for 10 seconds. Alex expects the board to recover automatically — reconnect, resync any changes they missed, and pick up right where they left off. Alex does NOT want to manually refresh or re-enter the board. After the session, Alex's manager asks "does this actually work at scale?" — Alex needs proof that the board handles 5+ users and 500+ objects without degradation.

**Sam, the Participant** — Sam is on a train with spotty internet. The connection drops and reconnects several times during the session. Sam expects the board to handle this gracefully — no lost stickies, no phantom cursors, no frozen screen. When connectivity returns, Sam should see the current board state, not a stale snapshot.

## User Story

> As Alex, I want the board to automatically reconnect and resync when my connection drops so I don't lose work or need to manually refresh.

> As Sam, I want the board to handle intermittent connectivity gracefully so I can participate even with unreliable internet.

> As the development team, we want to validate all Phase I performance targets (latency, FPS, capacity, concurrency) with documented proof so we can confidently submit for review.

## Goal

Implement robust disconnect/reconnect handling with automatic state reconciliation. Then execute the full Phase I validation matrix — 5 scenarios that prove the board meets all performance gates. Document results in the checkpoint log.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — "Reconnection Handling" pattern (client `connect` event, `socket.recovered`, Manager reconnect events), client reconnection options (`reconnectionDelay`, `reconnectionAttempts`)
- **Required reading:** `docs/firebase-firestore.md` — `getDoc` for full board reload on reconnect
- **Required reading:** `docs/react-konva.md` — Stage `destroyChildren` or layer clear for full re-render after resync
- **Reference:** `CLAUDE.md` — disconnect/reconnect pattern, performance gates table (<100ms objects, <50ms cursors, 60 FPS, 500+ objects, 5+ users), MetricsOverlay component, stress test function, PRD testing scenarios
- **Reference:** `docs/pre-search.md` — performance targets, risk assessment
- **Check:** Socket.IO client default reconnection behavior — exponential backoff is built in, but you need to handle `connect` to rejoin the board room and resync.

**Be strategic:** On reconnect: (1) re-emit `join-board` to rejoin the room, (2) fetch fresh board state from Firestore with `getDoc`, (3) reconcile with local state (clear and re-render is simplest for Phase I). Show a "Reconnecting..." banner during disconnect. Use Socket.IO's built-in reconnection (exponential backoff). For Phase I validation, test all 5 PRD scenarios: two-user editing, refresh mid-edit, rapid creation, network throttle, 5+ concurrent users. Record latency metrics and FPS in the checkpoint log. This is the gate — if any metric fails, stop and debug before declaring Phase I complete.

## Screens

### Screen: Board Page — Reconnecting Banner

The reconnecting banner appears as a full-width bar at the very top of the viewport, pushing the board topbar down. The board remains visible and locally interactive underneath.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  Connection lost. Reconnecting...                                │
├─────────────────────────────────────────────────────────────────────┤
│ ≡  ● CollabBoard  Sprint Plan V2 [Rename]  Move Frame Text Shape    │
│                               🔴 Offline  (AJ)(SD) 2 people [Dash…]│
├──────┬──────────────────────────────────────────────────────────┬───┤
│  ↖   │                                                          │ P │
│  □   │     ┌────────────┐                                       │ r │
│  ○   │     │ User       │  ← objects still visible              │ o │
│  T   │     │ Research   │    (local state preserved)            │ p │
│  ↔   │     └────────────┘                                       │ . │
│      │                                                          │   │
│      │     Canvas remains interactive for local edits           │   │
│      │     (changes queue and sync after reconnect)             │   │
└──────┴──────────────────────────────────────────────────────────┴───┘
```

**Reconnecting banner design:**
- Position: full-width bar at the very top of the viewport, above the topbar. `position: fixed`, `top: 0`, `left: 0`, `width: 100%`, `z-index: 10000`.
- Background: `#FEF3C7` (warm yellow). Border-bottom: `1px solid #F59E0B`.
- Text: "Connection lost. Reconnecting..." — `color: #92400E`, `font-size: 14px`, `font-weight: 500`, `text-align: center`, `padding: 8px 16px`.
- Animation: subtle left-right shimmer on the background (CSS `@keyframes`), indicating activity.
- The topbar presence pill switches to 🔴 Offline simultaneously.
- Dismissal: banner disappears automatically when connection is restored.

### Screen: Board Page — Reconnected Flash

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✅  Reconnected                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ≡  ● CollabBoard  Sprint Plan V2 [Rename]  Move Frame Text Shape    │
│                               🟢 Live  (AJ)(SD) 2 people [Dash…]   │
├──────┬──────────────────────────────────────────────────────────┬───┤
│  ...                                                                │
```

**Reconnected flash design:**
- Same position as reconnecting banner.
- Background: `#D1FAE5` (light green). Border-bottom: `1px solid #10B981`.
- Text: "Reconnected" — `color: #065F46`, `font-size: 14px`, `font-weight: 500`.
- Duration: visible for 1.5 seconds, then fades out (`opacity: 1 → 0` over 500ms).
- The topbar presence pill returns to 🟢 Live.

### Screen: Board Page — Offline Edits Indicator

If disconnected for >5 seconds, the banner text changes to reassure the user:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  Offline — edits will sync when reconnected                     │
├─────────────────────────────────────────────────────────────────────┤
│ ...                                                                  │
```

### Screen: Metrics Overlay — Full Phase I Metrics

```
┌──────────────────────────────┐
│  FPS: 60                     │
│  Cursor avg: 23ms ✅          │
│  Object avg: 45ms ✅          │
│  Users: 5 | Objects: 500     │
│  Reconnects: 2               │
│  Status: Connected (14m 23s) │
└──────────────────────────────┘
```

- **Reconnects** line: counts how many times the socket has reconnected in this session.
- **Status** line: shows connection state and uptime since last connect.

## UX Script

### Happy Path: Clean Reconnect After Brief Disconnect

1. Alex and Sam are collaborating. Both see 🟢 Live in the topbar presence pill.
2. Alex's Wi-Fi drops for 5 seconds.
3. Immediately:
   - Alex's presence pill switches to 🔴 Offline.
   - The yellow "Connection lost. Reconnecting..." banner slides down from the top of the viewport.
   - Alex's cursor disappears from Sam's screen (cursor cleanup from US-04 `user:left`).
   - Sam's presence avatars drop to show only Sam's avatar after ~3 seconds.
4. Socket.IO's built-in reconnection attempts to reconnect with exponential backoff (1s, 2s, 4s...).
5. Alex's Wi-Fi returns. Socket reconnects:
   - Client receives `connect` event.
   - Client immediately re-emits `join-board` with board ID and user info.
   - Client fetches fresh board state from Firestore via `getDoc`.
   - Client reconciles: clears the objects layer, re-renders all objects from Firestore data.
   - Updates `objectsRef` with the fresh state.
6. The banner changes to green "Reconnected" for 1.5 seconds, then fades out.
7. Presence pill switches to 🟢 Live.
8. Sam's topbar shows 2 avatars again. Sam sees Alex's cursor reappear.
9. Both boards are now in sync.

### Happy Path: Edits During Disconnect

1. Alex is disconnected for 10 seconds.
2. During that time, Alex creates 2 sticky notes locally (using the left rail tools). They appear on Alex's canvas (local Konva updates still work).
3. Sam also creates a sticky note during the disconnect.
4. Alex reconnects:
   - Fetches Firestore state (includes Sam's new sticky, but NOT Alex's 2 local stickies — they weren't saved yet).
   - The reconciliation clears and re-renders from Firestore, so Alex's 2 local stickies are lost.
   - **Phase I behavior:** This is acceptable. The reconnect banner warns "edits will sync when reconnected" — but during Phase I, local-only edits during disconnect may be lost on resync.
   - **Future enhancement (Phase II):** Queue local edits and replay them after resync.

### Edge: Server Restart (Render Deploy)

1. The Render server restarts (new deploy or free-tier spin-down).
2. All connected clients disconnect simultaneously.
3. Each client shows the reconnecting banner and the presence pill switches to 🔴 Offline.
4. Socket.IO clients auto-retry with backoff.
5. Render server comes back up (15-30 seconds for free tier cold start).
6. Clients reconnect, rejoin rooms, resync from Firestore.
7. All clients converge to the correct state. Banners flash green "Reconnected" then dismiss.

### Edge: Rapid Reconnect Cycle

1. Sam's internet flickers — 3 disconnects in 1 minute.
2. Each disconnect shows the banner and 🔴 Offline, each reconnect fetches from Firestore and flashes green.
3. The metrics overlay "Reconnects" counter increments to 3.
4. Board state remains correct after each cycle.

### Edge: User Navigates Away During Disconnect

1. Alex is disconnected. The banner is showing.
2. Alex clicks "Dashboard" to return to the dashboard.
3. The socket cleanup runs (no error). The banner does not persist on the dashboard page.
4. If Alex returns to the board, a fresh connection is established.

### Edge: Presence Cleanup After Disconnect

1. Jordan closes their browser tab abruptly (no clean disconnect).
2. Server fires `disconnecting` → emits `user:left` to the room.
3. Alex and Sam see Jordan's cursor disappear and avatar removed from the topbar within 3 seconds.
4. If Jordan reopens the board, they get a fresh `presence:snapshot` and their cursor/avatar reappear.

## Implementation Details

### Files

| File | Purpose |
|------|---------|
| `src/hooks/useSocket.ts` | Extended: handle `connect` event for reconnection (re-emit `join-board`, trigger resync). Track reconnect count. |
| `src/components/ReconnectBanner.tsx` | Yellow/green banner component. Shows based on connection status. Auto-dismisses on reconnect. |
| `src/hooks/useBoard.ts` | Extended: `resyncFromFirestore()` function — fetch full board via `getDoc`, clear layer, re-render all objects. |
| `src/components/MetricsOverlay.tsx` | Extended: reconnect count, connection uptime, full Phase I metrics. |
| `src/pages/Board.tsx` | Wire up ReconnectBanner above the topbar, trigger resync on reconnect. |

### Reconnection Flow

```ts
// In useSocket.ts — extend the connect handler
socket.on("connect", async () => {
  setStatus("connected");

  // If this is a RE-connect (not first connect), resync
  if (hasConnectedBefore.current) {
    reconnectCount.current++;

    // Rejoin the board room
    socket.emit("join-board", {
      boardId,
      user: { id: userId, displayName, color },
    });

    // Resync board state from Firestore
    await resyncFromFirestore();
  }

  hasConnectedBefore.current = true;
});

socket.on("disconnect", () => {
  setStatus("disconnected");
});
```

### Resync Function

```ts
async function resyncFromFirestore() {
  const boardDoc = await getDoc(doc(db, "boards", boardId));
  if (!boardDoc.exists()) return;

  const data = boardDoc.data();
  const objects = data.objects || {};

  // Clear current layer
  layerRef.current.destroyChildren();
  objectsRef.current.clear();

  // Re-render all objects
  Object.values(objects).forEach((obj: BoardObject) => {
    objectsRef.current.set(obj.id, obj);
    const shape = createKonvaNode(obj);
    layerRef.current.add(shape);
  });

  layerRef.current.batchDraw();
}
```

### ReconnectBanner Component

```tsx
function ReconnectBanner({ status }: { status: "connecting" | "connected" | "disconnected" }) {
  const [showReconnected, setShowReconnected] = useState(false);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    if (status === "disconnected") {
      wasDisconnected.current = true;
    }
    if (status === "connected" && wasDisconnected.current) {
      wasDisconnected.current = false;
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 2000);
    }
  }, [status]);

  if (status === "disconnected") {
    return (
      <div className="reconnect-banner warning">
        Connection lost. Reconnecting...
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="reconnect-banner success">
        Reconnected
      </div>
    );
  }

  return null;
}
```

### Socket.IO Client Reconnection Config

```ts
const socket = io(SOCKET_SERVER_URL, {
  auth: { token },
  transports: ["websocket", "polling"],
  reconnection: true,            // enabled by default
  reconnectionDelay: 1000,       // start at 1s
  reconnectionDelayMax: 10000,   // cap at 10s
  reconnectionAttempts: Infinity, // never give up
});
```

### Phase I Validation Matrix

Execute these 5 scenarios and record results in the checkpoint log:

#### Scenario 1: Two-User Simultaneous Editing

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open board in Browser A and B | Both show 🟢 Live, 2 avatars in topbar |
| 2 | A creates 3 stickies via left rail `□` tool | B sees all 3 appear |
| 3 | B moves sticky #1 | A sees it move |
| 4 | A edits sticky #2 text | B sees new text |
| 5 | B deletes sticky #3 | A sees it disappear |
| 6 | Both create stickies simultaneously | Both boards show all objects |

**Pass criteria:** All operations sync within <100ms. No duplicates. No crashes.

#### Scenario 2: Refresh Mid-Edit

| Step | Action | Expected |
|------|--------|----------|
| 1 | A creates 5 objects | Wait 5s for Firestore save |
| 2 | A refreshes the page | All 5 objects reload from Firestore |
| 3 | B creates 2 more objects while A is refreshing | A sees them after reconnect |

**Pass criteria:** No data loss after refresh. Objects load from Firestore correctly.

#### Scenario 3: Rapid Creation/Movement

| Step | Action | Expected |
|------|--------|----------|
| 1 | A creates 10 stickies in 5 seconds | All appear on B |
| 2 | A drags an object rapidly for 5 seconds | B sees movement |
| 3 | Check FPS in metrics overlay | Should be >=55 FPS |
| 4 | Check object latency in metrics | Should be <100ms avg |

**Pass criteria:** FPS stays above 55. Latency stays under 100ms.

#### Scenario 4: Network Throttle (Simulated Disconnect)

| Step | Action | Expected |
|------|--------|----------|
| 1 | A and B connected with objects on board | Both synced, 🟢 Live |
| 2 | Throttle A's network (Chrome DevTools → Offline) | A shows 🔴 Offline + reconnecting banner |
| 3 | B creates 2 objects while A is offline | B sees them locally |
| 4 | Restore A's network | A reconnects, banner turns green, presence pill → 🟢 Live |
| 5 | Verify A sees B's 2 new objects | State converges |

**Pass criteria:** Reconnect within 15s of network restore. All objects present after resync.

#### Scenario 5: 5+ Concurrent Users

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open board in 5 browsers/tabs | All show 5 avatars in topbar |
| 2 | Each user creates 2 objects | All 5 browsers show 10 objects |
| 3 | Move cursors in all browsers | Each shows 4 remote cursors on canvas |
| 4 | Check metrics across all browsers | Cursor <50ms, Object <100ms, FPS >=55 |

**Pass criteria:** All 5 users see all objects and cursors. Performance targets met.

### Object Capacity Stress Test (500+ Objects)

```js
// Run in browser console or as a dev tool
function stressTest(stage, layer, count = 500) {
  console.time("stress-test-create");
  for (let i = 0; i < count; i++) {
    const rect = new Konva.Rect({
      id: `stress-${i}`,
      x: Math.random() * 5000,
      y: Math.random() * 5000,
      width: 100 + Math.random() * 50,
      height: 80 + Math.random() * 30,
      fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
      cornerRadius: 4,
    });
    layer.add(rect);
  }
  layer.batchDraw();
  console.timeEnd("stress-test-create");

  // Verify FPS after creation
  console.log(`Created ${count} objects. Monitor FPS overlay — should be >=55.`);
  console.log("Try panning and zooming. FPS should stay stable.");
}
```

**Pass criteria:** 500 objects render. FPS >=55 during pan/zoom. No visible lag.

## Acceptance Criteria

- [ ] Disconnection shows yellow "Connection lost. Reconnecting..." banner immediately above the topbar.
- [ ] Presence pill in topbar switches to 🔴 Offline on disconnect.
- [ ] Reconnection shows green "Reconnected" flash for 1.5 seconds.
- [ ] After >5s disconnect, banner text changes to "Offline — edits will sync when reconnected".
- [ ] On reconnect: client re-emits `join-board` to rejoin the room.
- [ ] On reconnect: client fetches fresh board state from Firestore and re-renders all objects.
- [ ] On reconnect: presence list updates (user reappears in other clients' topbar avatars).
- [ ] On reconnect: cursor broadcasting resumes on the canvas.
- [ ] Socket.IO reconnection uses exponential backoff (1s → 2s → 4s... up to 10s cap).
- [ ] No infinite reconnection loops or memory leaks during rapid disconnect/reconnect.
- [ ] Metrics overlay shows reconnect count and connection uptime.
- [ ] **Validation: Scenario 1** — Two-user editing: all CRUD syncs within <100ms.
- [ ] **Validation: Scenario 2** — Refresh mid-edit: all objects reload from Firestore.
- [ ] **Validation: Scenario 3** — Rapid creation: FPS >=55, latency <100ms.
- [ ] **Validation: Scenario 4** — Network throttle: reconnects and converges within 15s.
- [ ] **Validation: Scenario 5** — 5+ users: all see all objects and cursors, performance targets met.
- [ ] **Validation: Stress test** — 500+ objects: FPS >=55 during pan/zoom.
- [ ] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open a board with 5+ objects. Verify everything is synced between 2 browsers.
2. In Browser A, open Chrome DevTools → Network tab → check "Offline". Verify:
   - 🔴 Offline appears in the topbar presence pill.
   - Yellow "Connection lost. Reconnecting..." banner appears above the topbar.
3. Wait 10 seconds. Verify banner changes to "Offline — edits will sync when reconnected".
4. In Browser B, create 2 new stickies while A is offline.
5. In Browser A, uncheck "Offline". Verify:
   - Banner turns green "Reconnected" briefly.
   - 🟢 Live returns in the topbar presence pill.
   - Browser A now shows the 2 stickies that B created.
   - Presence avatars and cursors resume.
6. Open the board in 5 browser windows. Verify all 5 show 5 presence avatars in the topbar and can see each other's cursors on the canvas.
7. Run the 500-object stress test. Verify FPS stays >=55 during pan/zoom.
8. Check the metrics overlay. Verify all metrics are within targets: Cursor <50ms, Object <100ms, FPS >=55.
9. Document all results in the Checkpoint Result below.

## Checkpoint Result

- Production Frontend URL:
- Production Socket URL:
- User Validation: Pending
- Phase I Validation Results:
  - Scenario 1 (Two-user editing): ___ / PASS
  - Scenario 2 (Refresh mid-edit): ___ / PASS
  - Scenario 3 (Rapid creation): ___ / PASS — FPS: ___  Latency: ___ms
  - Scenario 4 (Network throttle): ___ / PASS — Reconnect time: ___s
  - Scenario 5 (5+ concurrent users): ___ / PASS — Users: ___ Cursor: ___ms Object: ___ms
  - Stress test (500+ objects): ___ / PASS — Objects: ___ FPS: ___
- Notes:
