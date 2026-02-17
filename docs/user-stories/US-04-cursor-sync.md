# US-04: Multiplayer Cursor Sync

## Status

- State: Not Started
- Owner: Codex
- Depends on: US-03 Approved

## Persona

**Alex, the Facilitator** — Alex is running a brainstorming session. Alex wants to see where Sam and Jordan are pointing on the board in real time. When Alex moves their mouse, teammates should see a labeled cursor following Alex's movement smoothly, like in Figma or Google Docs.

**Sam, the Participant** — Sam needs visual confirmation that others are active — seeing cursors move proves the board is live, not frozen.

## User Story

> As Alex, I want to see my teammates' cursors on the board with their names so I can follow along with what they're pointing at during our session.

> As Sam, I want to see other people's cursors moving in real time so I know the board is live and I can see what everyone is focused on.

## Goal

Broadcast cursor positions over Socket.IO and render labeled remote cursors on a dedicated Konva layer with latency measurement.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — "Volatile Events" (`socket.volatile.emit` for cursor data), "Board Room Pattern" (`cursor:move` handler)
- **Required reading:** `docs/react-konva.md` — Stage events (`onMouseMove`), Layer structure (cursors on separate top layer with `listening={false}`)
- **Required reading:** `docs/konva-api.md` — `Stage.getPointerPosition()`, coordinate transforms, Common Node Methods
- **Reference:** `CLAUDE.md` — cursor sync pattern (`useCursors` hook), throttle at 50ms, world coordinates, Layer table (cursors layer = `listening: false`), performance targets (<50ms latency)
- **Reference:** `docs/pre-search.md` §7 — latency targets, cursor broadcast architecture

**Be strategic:** Cursors must use `volatile` emit — dropped cursor messages are fine and this avoids buffering. Throttle client-side broadcasts to ~50ms (not every mousemove). Store remote cursors in React state (it's a small Map, updates are debounced). Render cursors on a dedicated Konva Layer with `listening={false}` so they don't interfere with hit detection. Include `_ts: Date.now()` in every cursor message for latency measurement. Convert pointer positions to world coordinates before broadcasting.

## Screens

### Screen: Board Page — Remote Cursors on Canvas

```
┌──────────────────────────────────────────────────────────────┐
│  Header (from US-01/02/03)                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│         ↗ Alex                                               │
│                                                              │
│                         ↗ Sam                                │
│                                                              │
│                                     ↗ Jordan                 │
│                                                              │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Cursor design:**

- **Shape:** SVG-style pointer arrow. A small triangle pointing up-left (like a standard cursor rotated slightly). Implemented as a Konva `Line` or `Path` with 3 points forming a triangular arrow.
- **Color:** Same deterministic color as the user's presence avatar (`generateColor(userId)` from US-03). The arrow fill matches the user's color.
- **Label:** User's first name (or display name truncated to 12 chars) in a small rounded rectangle (`border-radius: 4px`) positioned just below-right of the cursor tip.
  - Label background: same user color with 90% opacity.
  - Label text: `#fff`, `font-size: 11px`, `font-weight: 500`, `padding: 2px 6px`.
- **Size:** Arrow is ~16px tall. Label is positioned 4px below and 4px right of the arrow tip.
- **Smoothing:** Remote cursors lerp (linear interpolate) toward their target position over ~50ms for smooth movement rather than jumping between positions.

### Screen: Metrics Overlay — Cursor Latency

```
┌──────────────────────┐
│  FPS: 60             │
│  Cursor avg: 23ms ✅  │
│  Users: 3            │
└──────────────────────┘
```

- Position: `fixed`, `bottom: 8px`, `right: 8px`.
- Background: `rgba(0, 0, 0, 0.7)`, `color: #0f0`, `font-family: monospace`, `font-size: 12px`, `padding: 8px`, `border-radius: 4px`, `z-index: 9999`.
- Cursor latency line: "Cursor avg: {N}ms" with ✅ if <50ms, ⚠️ if >=50ms.
- Only visible when `VITE_ENABLE_METRICS=true` or in development.

## UX Script

### Happy Path: Two Users See Each Other's Cursors

1. Alex opens board `/board/abc123`. Canvas renders (placeholder or empty for now — the Konva stage is initialized).
2. Sam opens the same board in another browser.
3. Alex moves their mouse over the canvas. The `onMouseMove` handler fires:
   - Gets pointer position from the stage.
   - Converts screen coordinates to world coordinates (accounting for pan/zoom).
   - Throttles to one emit per 50ms.
   - Emits `cursor:move` with `{ x, y, userId, displayName, color, _ts: Date.now() }` via `socket.volatile.emit`.
4. Server receives `cursor:move`, broadcasts to `board:abc123` (excluding sender).
5. Sam's client receives the cursor event:
   - Calculates latency: `Date.now() - _ts`.
   - Updates the remote cursor map in React state.
   - Konva renders Alex's cursor arrow + label at the received world coordinates on the cursor layer.
6. Sam sees a smooth-moving labeled cursor for Alex. Alex sees one for Sam.

### Edge: User Leaves

1. Jordan closes their tab.
2. `user:left` event fires (from US-03).
3. Client removes Jordan's cursor from the remote cursor map. The cursor disappears immediately.

### Edge: Rapid Movement

1. Alex moves their mouse quickly across the canvas.
2. Client emits at most one `cursor:move` every 50ms (throttled).
3. Remote clients interpolate between received positions, so the cursor still appears smooth.

### Edge: Canvas Pan/Zoom

1. Alex pans the canvas. The stage position changes.
2. Cursor positions are in world coordinates, so they remain correct relative to board objects after pan/zoom.
3. The world-to-screen conversion for rendering remote cursors uses the current stage transform.

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

Note: `socket.volatile.to(...)` — the `volatile` flag means the message may be dropped if the connection is congested, which is fine for cursor data.

### Client Files

| File | Purpose |
|------|---------|
| `src/hooks/useCursors.ts` | Subscribe to `cursor:move`, maintain remote cursor Map, expose publish function (throttled + volatile). |
| `src/components/RemoteCursors.tsx` | Konva layer rendering all remote cursors (arrow + label for each). `listening={false}`. |
| `src/components/MetricsOverlay.tsx` | Fixed-position overlay showing cursor latency, FPS, user/object counts. |
| `src/pages/Board.tsx` | Wire up `useCursors`, add `RemoteCursors` layer to Konva stage, add `onMouseMove` handler. |

### Coordinate Conversion

```ts
// Screen → World (for broadcasting)
function screenToWorld(stage: Konva.Stage, screenPos: { x: number; y: number }) {
  const scale = stage.scaleX();
  return {
    x: (screenPos.x - stage.x()) / scale,
    y: (screenPos.y - stage.y()) / scale,
  };
}

// World → Screen (for rendering remote cursors)
function worldToScreen(stage: Konva.Stage, worldPos: { x: number; y: number }) {
  const scale = stage.scaleX();
  return {
    x: worldPos.x * scale + stage.x(),
    y: worldPos.y * scale + stage.y(),
  };
}
```

### Throttle Strategy

- Client-side: 50ms throttle on `cursor:move` emissions using `requestAnimationFrame` or a simple timestamp check.
- Server-side: no throttle needed (volatile emit + room broadcast is cheap).

## Acceptance Criteria

- [ ] Moving mouse on canvas broadcasts `cursor:move` to other users in the same board room.
- [ ] Remote cursors render as colored arrow + name label on a dedicated Konva layer.
- [ ] Cursor layer has `listening={false}` (doesn't interfere with click/drag on objects).
- [ ] Cursor positions use world coordinates (survive pan/zoom).
- [ ] Client throttles cursor broadcasts to ~50ms intervals.
- [ ] Socket.IO `volatile` flag is used for cursor emissions.
- [ ] Remote cursor disappears when user leaves (triggered by `user:left`).
- [ ] Latency metric (`Date.now() - _ts`) is calculated and displayed in metrics overlay.
- [ ] Average cursor latency is <50ms (measured in overlay).
- [ ] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open the same board in two browsers (A and B).
2. Move mouse in Browser A. Verify a labeled cursor appears and moves smoothly in Browser B.
3. Move mouse in Browser B. Verify a labeled cursor appears in Browser A.
4. Verify cursor colors match presence avatar colors.
5. Check the metrics overlay (bottom-right). Verify "Cursor avg" shows a number <50ms.
6. Close Browser B. Verify Browser B's cursor disappears from Browser A within 3 seconds.
7. Pan/zoom the canvas in Browser A. Move cursor in Browser B. Verify the cursor position is still correct in world space.

## Checkpoint Result

- Production Frontend URL:
- Production Socket URL:
- User Validation: Pending
- Notes:
