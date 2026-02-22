# US-04: Multiplayer Cursor Sync

## Status

- State: In Progress (Deployed, Awaiting User Validation)
- Owner: Codex
- Depends on: US-03 Approved

## Persona

**Alex, the Facilitator** — Alex is leading a product brainstorming session. Three teammates are on the board. Alex wants to say "look at this sticky note" and physically point at it with their mouse — and have everyone see where Alex is pointing, just like in Figma. Cursors make remote collaboration feel present; without them, Alex can't tell if teammates are following along or AFK.

**Sam, the Participant** — Sam needs visual proof that the board is live. Seeing three colored cursors darting around the canvas is the ultimate "this is working" signal. If cursors are laggy (visible jumps or >50ms latency), the experience breaks — it feels like video call lag, not live collaboration.

## User Story

> As Alex, I want to see my teammates' cursors on the board with their names so I can point at things and know everyone is following along.

> As Sam, I want to see other people's cursors moving smoothly in real time so the board feels truly live and collaborative.

## Goal

Broadcast cursor positions over Socket.IO and render labeled remote cursors on a dedicated Konva layer. Cursors must feel instantaneous (<50ms latency) and smooth (lerp interpolation). Latency is measured and displayed in a development metrics overlay.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — "Volatile Events" (`socket.volatile.emit` for cursor data), "Board Room Pattern" (`cursor:move` handler)
- **Required reading:** `docs/react-konva.md` — Stage events (`onMouseMove`), Layer structure (cursors on separate top layer with `listening={false}`)
- **Required reading:** `docs/konva-api.md` — `Stage.getPointerPosition()`, coordinate transforms, Common Node Methods
- **Reference:** `CLAUDE.md` — cursor sync pattern (`useCursors` hook), throttle at 50ms, world coordinates, Layer table (cursors layer = `listening: false`), performance targets (<50ms latency)

**Be strategic:** Cursors must use `volatile` emit — dropped cursor messages are fine and this avoids buffering. Throttle client-side broadcasts to ~50ms (not every mousemove). Store remote cursors in React state (it's a small Map, updates are debounced). Render cursors on a dedicated Konva Layer with `listening={false}` so they don't interfere with hit detection. Include `_ts: Date.now()` in every cursor message for latency measurement. Convert pointer positions to world coordinates before broadcasting.

## Setup Prerequisites

**No new infrastructure.** Extends the Socket.IO server (US-02) and the Konva canvas (will be fully built in US-05, but this story adds a cursor layer on top of the existing canvas shell).

- **Server:** Add `cursor:move` handler to `server/index.js`. Uses `socket.volatile.to(room)` — volatile because dropped cursor messages are acceptable. Redeploy to Render.
- **Client:** No new npm dependencies. Uses `react-konva` (already installed) for cursor rendering.
- **Metrics overlay:** This story introduces the `MetricsOverlay` component. It is visible when `VITE_ENABLE_METRICS=true` or `import.meta.env.DEV` is true. Set `VITE_ENABLE_METRICS=true` in your local `.env` to see it during development. In production, leave it unset or set to `false` unless you need to demo performance metrics.

```bash
# Local .env — enable metrics overlay
VITE_ENABLE_METRICS=true
```

- **Konva Stage:** This story requires a Konva `Stage` to be mounted inside the canvas shell area (even a minimal one) so `onMouseMove` can capture pointer positions. If implementing before US-05 completes, a minimal Stage with an empty Layer is sufficient.

## Screens

### Screen: Board Canvas — Remote Cursors

Remote cursors render on top of everything — above objects, above the selection layer. Each cursor is a colored arrow with a name tag.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ≡  ● CollabBoard  Sprint Plan V2  [Rename]  Move Frame Text Shape   │
│                            🟢 Live  (AJ)(SD)(JW) 3 people [Dashboard]│
├──────┬──────────────────────────────────────────────┬───────────────┤
│  ↖   │                                              │ Properties    │
│  □   │     ↗ Alex                                    │               │
│  ○   │                                              │               │
│  T   │              ┌────────────┐                  │               │
│  ↔   │              │ User       │                  │               │
│      │              │ Research   │     ↗ Sam         │               │
│      │              └────────────┘                  │               │
│      │                                              │               │
│      │                       ↗ Jordan                │               │
│      │                                              │               │
└──────┴──────────────────────────────────────────────┴───────────────┘
```

**Cursor design:**
- **Arrow:** Small triangular pointer (~16px tall), implemented as a Konva `Line` or `Path`. Fill matches the user's deterministic color (from `generateColor(userId)`, same as their presence avatar).
- **Name tag:** User's first name (or display name truncated to 12 chars) in a small rounded pill. Background: same user color at 90% opacity. Text: `#fff`, `font-size: 11px`, `font-weight: 500`, `padding: 2px 6px`, `border-radius: 4px`. Positioned 4px below and 4px right of the arrow tip.
- **Smoothing:** Remote cursors lerp (linear interpolate) toward their target position over ~50ms. No snapping, no teleporting — smooth movement even when network delivers updates at 50ms intervals.
- **Layer:** Dedicated Konva Layer at the top of the layer stack. `listening={false}` — cursors don't intercept clicks or drags meant for objects below them.

### Screen: Metrics Overlay — Cursor Latency

A development-only overlay in the bottom-right corner shows real-time performance metrics.

```
┌──────────────────────┐
│  FPS: 60             │
│  Cursor avg: 23ms ✅  │
│  Users: 3            │
└──────────────────────┘
```

- Position: `fixed`, `bottom: 8px`, `right: 8px`.
- Background: `rgba(0, 0, 0, 0.75)`, `color: #0f0`, `font-family: monospace`, `font-size: 12px`, `padding: 8px 12px`, `border-radius: 6px`, `z-index: 9999`.
- Cursor latency: rolling average of `Date.now() - msg.data._ts` over the last 20 messages. Shows ✅ if <50ms, ⚠️ if >=50ms.
- Only visible when `VITE_ENABLE_METRICS=true` or in development mode.

## UX Script

### Happy Path: Two Users See Each Other's Cursors

1. Alex and Sam both have the board open. Both see 🟢 "Live" and 2 avatars in the topbar.
2. Alex moves their mouse over the canvas. The `onMouseMove` handler fires:
   - Gets pointer position from `stage.getPointerPosition()`.
   - Converts screen coordinates to world coordinates (accounting for current pan/zoom).
   - Checks the 50ms throttle — if enough time has passed, emits `cursor:move` with `{ x, y, userId, displayName, color, _ts: Date.now() }` via `socket.volatile.emit`.
3. Server receives `cursor:move`, broadcasts to all other sockets in the board room (excluding sender).
4. Sam's client receives the cursor event:
   - Calculates latency: `Date.now() - _ts`.
   - Updates the remote cursor map in React state.
   - The cursor Konva layer renders Alex's arrow + name tag at the target world coordinates. If the cursor already exists, it lerps toward the new position over ~50ms.
5. Sam sees Alex's cursor moving smoothly across the canvas. Alex sees Sam's cursor similarly.

### Happy Path: Cursor Tracks Through Pan/Zoom

1. Alex pans the canvas by dragging an empty area. The stage position changes.
2. Alex's cursor broadcasts still use world coordinates — they're computed after accounting for stage transform.
3. Sam's renderer converts world coordinates back to screen coordinates using the current stage transform.
4. Result: cursors appear at the correct canvas position regardless of each user's independent pan/zoom state.

### Edge: User Leaves

1. Jordan closes their tab.
2. `user:left` event fires (from US-03).
3. All other clients remove Jordan's cursor from the remote cursor map. Jordan's cursor arrow + name tag disappears immediately from the canvas.

### Edge: Rapid Movement

1. Alex moves their mouse quickly in circles across the canvas.
2. Client emits at most one `cursor:move` every 50ms (throttled). Raw mousemove events fire much more frequently but are dropped between throttle windows.
3. Remote clients receive updates every ~50ms and interpolate between positions. The cursor appears smooth despite the throttling.

### Edge: Mouse Leaves Canvas

1. Alex moves their mouse off the canvas area (into the topbar or properties panel).
2. No cursor events emit when the mouse is outside the Konva stage. Alex's remote cursor on other screens stays at its last position — it doesn't chase the mouse into the UI.
3. If Alex's mouse doesn't return for 5+ seconds, other clients could optionally dim Alex's cursor (future enhancement — not required for Phase I).

## Implementation Details

### Server Changes (extend `server/index.js`)

```js
socket.on("cursor:move", (data) => {
  const { boardId } = socket.data;
  if (boardId) {
    socket.volatile.to(`board:${boardId}`).emit("cursor:move", {
      ...data,
      socketId: socket.id,
    });
  }
});
```

`socket.volatile.to(...)` — the `volatile` flag means the message may be dropped under congestion. This is correct for cursor data — a dropped position is immediately superseded by the next one.

### Client Files

| File | Purpose |
|------|---------|
| `src/hooks/useCursors.ts` | Subscribe to `cursor:move`, maintain remote cursor Map in React state, expose throttled publish function. Remove cursor on `user:left`. |
| `src/components/RemoteCursors.tsx` | Konva layer rendering all remote cursors (arrow + name tag for each). `listening={false}`. Lerp animation. |
| `src/components/MetricsOverlay.tsx` | Fixed-position HTML overlay showing FPS, cursor latency, user count. Visible only in dev/metrics mode. |
| `src/pages/Board.tsx` | Wire up `useCursors`, add `RemoteCursors` layer to Konva stage, add `onMouseMove` handler to Stage. |

### Coordinate Conversion

```ts
// Screen → World (for broadcasting local cursor position)
function screenToWorld(stage: Konva.Stage, screenPos: { x: number; y: number }) {
  const scale = stage.scaleX();
  return {
    x: (screenPos.x - stage.x()) / scale,
    y: (screenPos.y - stage.y()) / scale,
  };
}

// World → Screen (for rendering remote cursors on the canvas)
function worldToScreen(stage: Konva.Stage, worldPos: { x: number; y: number }) {
  const scale = stage.scaleX();
  return {
    x: worldPos.x * scale + stage.x(),
    y: worldPos.y * scale + stage.y(),
  };
}
```

### Throttle Strategy

- Client-side: 50ms throttle using a simple timestamp check (`Date.now() - lastEmit >= 50`).
- Server-side: no throttle needed — volatile emit + room broadcast is cheap.

## Acceptance Criteria

- [x] Moving mouse on canvas broadcasts `cursor:move` to other users in the same board room.
- [x] Remote cursors render as colored arrow + name tag on a dedicated Konva layer.
- [x] Cursor layer has `listening={false}` (doesn't interfere with click/drag on objects below).
- [x] Cursor positions use world coordinates (correct regardless of each user's pan/zoom state).
- [x] Client throttles cursor broadcasts to ~50ms intervals.
- [x] Socket.IO `volatile` flag is used for cursor emissions.
- [x] Remote cursor disappears when a user leaves (triggered by `user:left` from US-03).
- [x] Latency metric (`Date.now() - _ts`) is calculated and displayed in the metrics overlay.
- [x] Average cursor latency is <50ms (verified in the overlay).
- [x] Cursors render within the canvas area only — not in the topbar, left rail, or properties panel.
- [x] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open the same board in two browsers (A and B).
2. Move mouse in Browser A's canvas. Verify a labeled cursor appears and moves smoothly in Browser B.
3. Move mouse in Browser B. Verify a labeled cursor appears in Browser A.
4. Verify cursor colors match presence avatar colors in the topbar.
5. Enable the metrics overlay. Verify "Cursor avg" shows a number <50ms with ✅.
6. Close Browser B. Verify Browser B's cursor disappears from Browser A within 3 seconds.
7. Pan/zoom the canvas in Browser A. Move cursor in Browser B. Verify the cursor position is still correct relative to canvas objects (world space).

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Passed with Follow-Up Notes
- Notes:
  Implemented `cursor:move` on the Socket.IO server with `socket.volatile.to(room)` broadcasting, plus client-side throttle and latency instrumentation.  
  Added Konva stage wiring in board canvas, dedicated remote cursor layer (`listening={false}`), and a metrics overlay for FPS + cursor latency.  
  Added/updated tests for cursor hook, metrics overlay, board integration, realtime payload helpers, and coordinate utilities.  
  Local validation on February 18, 2026: `npm run lint`, `npm run test`, and `npm run build` all passing.  
  Vercel production deploy completed and aliased to `https://collab-board-iota.vercel.app` on February 18, 2026.  
  Follow-ups in `docs/user-stories/post-story-followups.md` have been addressed on February 18, 2026: cursor hide on blur/tab leave + stale-timeout cleanup, and cursor cadence tuned from 50ms to 40ms to mitigate latency spikes.
