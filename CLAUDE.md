# CLAUDE.md — CollabBoard

This file provides instructions to Claude Code when working in this repository. Follow these rules exactly as written.

---

## Project Overview

Real-time collaborative whiteboard (Miro-like) with AI agent. One-week sprint, hard gates. Project completion is required for Austin admission.

## Tech Stack

- **Real-time sync:** Socket.IO (self-hosted WebSocket, <50ms cursors, <100ms objects target)
- **Database:** Firebase Firestore (one document per board, embedded objects)
- **Auth:** Firebase Auth (Google Sign-In only)
- **Frontend:** Vite + React + react-konva (canvas rendering)
- **AI:** Anthropic Claude with function calling via Vercel serverless `/api`
- **Deployment:** Vercel (frontend static + serverless functions, $0 cost)
- **Metrics:** Custom overlay + stats.js (FPS) + timestamp-based latency

## Architecture (no traditional backend)

```
Client-side: React + Konva (canvas), Socket.IO SDK (sync), Firestore SDK (persistence), Firebase Auth
Serverless:  /api/ai/generate.ts only (protects Anthropic API key)
```

---

## Critical Performance Pattern

Separate Konva state from React state. Use refs for canvas, React for UI only.

```jsx
// BAD — React re-renders kill performance with 500 objects
const [objects, setObjects] = useState({});

// GOOD — Konva manages its own state via refs
const stageRef = useRef(null);
const updateObject = (id, newData) => {
  const shape = stageRef.current.findOne(`#${id}`);
  shape.setAttrs(newData);
  shape.getLayer().batchDraw();
};
```

**NEVER store canvas object state in React state. Use Konva refs for all canvas interactions.**

React state triggers reconciliation on the entire virtual DOM. With 500 objects, that means 500 component re-renders on every drag frame. Konva's scene graph is designed for direct manipulation — use it.

### Correct Pattern: Ref-Based Canvas Updates

```jsx
const Canvas = () => {
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const objectsRef = useRef(new Map()); // Source of truth for object data

  const updateObject = useCallback((id, attrs) => {
    const shape = stageRef.current.findOne(`#${id}`);
    if (shape) {
      shape.setAttrs(attrs);
      layerRef.current.batchDraw();
    }
    const obj = objectsRef.current.get(id);
    if (obj) objectsRef.current.set(id, { ...obj, ...attrs });
  }, []);

  const addObject = useCallback((object) => {
    objectsRef.current.set(object.id, object);
    const shape = createKonvaShape(object);
    layerRef.current.add(shape);
    layerRef.current.batchDraw();
  }, []);

  const removeObject = useCallback((id) => {
    const shape = stageRef.current.findOne(`#${id}`);
    if (shape) shape.destroy();
    objectsRef.current.delete(id);
    layerRef.current.batchDraw();
  }, []);

  return (
    <Stage ref={stageRef} width={window.innerWidth} height={window.innerHeight} draggable>
      <Layer ref={layerRef} />
      <Layer>{/* Selection overlay */}</Layer>
      <Layer>{/* Remote cursors */}</Layer>
    </Stage>
  );
};
```

### Wrong Pattern (DO NOT USE)

```jsx
const [objects, setObjects] = useState([]);
const updateObject = (id, attrs) => {
  setObjects((prev) => prev.map((obj) => (obj.id === id ? { ...obj, ...attrs } : obj)));
};
```

### When React State IS Appropriate

Use React state ONLY for:

- UI components (toolbar, panels, dialogs) — these re-render infrequently
- Remote cursor list (updated via Socket.IO, debounced)
- Presence list (who's online)
- Selection state (which objects are selected — small array)
- Board metadata (title, settings)
- Auth state

---

## Folder Structure (flat, simple)

```
collab-board/
├── src/
│   ├── components/   # Canvas.tsx, Toolbar.tsx, ShareButton.tsx, MetricsOverlay.tsx
│   ├── hooks/        # useSocketRealtime.ts, useFirestore.ts, useCanvas.ts
│   ├── lib/          # socket.ts, firebase.ts, utils.ts
│   ├── pages/        # Dashboard.tsx, Board.tsx, Landing.tsx
│   └── main.tsx
├── api/              # Vercel serverless functions
│   └── ai/
│       └── generate.ts
├── public/
├── docs/             # PRD, pre-search, AI dev log, cost analysis
└── vercel.json
```

## Naming Conventions

- **Components:** PascalCase (`Canvas.tsx`, `ShareButton.tsx`)
- **Hooks:** camelCase with `use` prefix (`useSocketRealtime.ts`, `useRealTimeSync.ts`)
- **Utilities:** camelCase (`generateBoardId.ts`, `debounce.ts`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_OBJECTS = 500`, `CURSOR_UPDATE_THROTTLE = 50`)

## Routes

```
/           → Landing/login page
/dashboard  → Board list (user's boards)
/board/:id  → Canvas editor (UUID-based, shareable link)
```

## Key Principles

- Keep it flat — no deeply nested folders for a 1-week project.
- Use Prettier defaults, don't bikeshed formatting.
- No barrel files — import directly from source.
- Managed services over custom infrastructure (Socket.IO, Firebase, Vercel).

---

## Canvas Rendering (React-Konva)

### Konva Layers (separate for performance)

1. **Background** — grid/dots pattern. `listening={false}` (no hit detection).
2. **Objects** — sticky notes, shapes, frames, text, connectors.
3. **Selection** — rubber-band rect, bounding box, transform handles.
4. **Cursors** — remote user cursors with name labels (always on top).

### Board Object Schema

```javascript
{
  id: 'uuid',                    // crypto.randomUUID()
  type: 'sticky' | 'rect' | 'circle' | 'line' | 'text' | 'frame' | 'connector',
  x: 100, y: 200,               // world coordinates
  width: 150, height: 100,
  rotation: 0,                   // degrees
  text: 'Hello',                 // for sticky/text
  color: '#FFEB3B',              // hex fill color
  fontSize: 14,
  zIndex: 1,
  createdBy: 'userId',
  updatedAt: '2026-02-17T...',   // ISO string, used for last-write-wins
}
```

### Pan & Zoom

- Pan: `Stage.draggable={true}`, drag on empty canvas area.
- Zoom: wheel event → scale toward cursor position. Clamp scale 0.1–5.
- All object positions stored in **world coordinates**.
- Viewport = Stage position + scale. Convert with `worldToScreen` / `screenToWorld`.

```jsx
const handleWheel = useCallback((e) => {
  e.evt.preventDefault();
  const stage = stageRef.current;
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();

  const direction = e.evt.deltaY > 0 ? -1 : 1;
  const factor = 1.08;
  const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
  const clampedScale = Math.max(0.1, Math.min(5, newScale));

  stage.scale({ x: clampedScale, y: clampedScale });

  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };
  const newPos = {
    x: pointer.x - mousePointTo.x * clampedScale,
    y: pointer.y - mousePointTo.y * clampedScale,
  };

  stage.position(newPos);
  stage.batchDraw();
}, []);
```

### Selection

- Single click on object → select, show `Transformer` handles (resize/rotate).
- Shift+click → toggle in multi-selection.
- Drag on empty canvas → rubber-band selection rectangle.
- `Transformer` attached to selected node(s) for resize/rotate.

```jsx
const SelectionManager = ({ stageRef, selectedIds, onSelect }) => {
  const transformerRef = useRef(null);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const nodes = selectedIds
      .map((id) => stageRef.current.findOne(`#${id}`))
      .filter(Boolean);
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer().batchDraw();
  }, [selectedIds]);

  return <Transformer ref={transformerRef} />;
};
```

### Object Components (React-Konva hybrid approach)

If using React-Konva components for initial render, memoize aggressively:

```jsx
const StickyNote = React.memo(
  ({ id, x, y, width, height, text, color, onDragEnd, onDblClick }) => (
    <Group id={id} x={x} y={y} draggable onDragEnd={onDragEnd} onDblClick={onDblClick}>
      <Rect width={width} height={height} fill={color} cornerRadius={4} shadowBlur={4} shadowOpacity={0.2} />
      <Text text={text} width={width} height={height} padding={8} fontSize={14} />
    </Group>
  ),
  (prev, next) =>
    prev.x === next.x && prev.y === next.y && prev.text === next.text &&
    prev.color === next.color && prev.width === next.width && prev.height === next.height,
);
```

### Konva Layer Best Practices

| Layer      | Content                  | `listening` | Redraws                 |
| ---------- | ------------------------ | ----------- | ----------------------- |
| Background | Grid dots                | `false`     | Rarely (on zoom)        |
| Objects    | Stickies, shapes, text   | `true`      | On object updates       |
| Selection  | Transformer, rubber band | `true`      | On selection changes    |
| Cursors    | Remote user cursors      | `false`     | On cursor updates (RAF) |

### Viewport Culling (500+ objects)

```javascript
function getVisibleObjects(objects, stagePos, scale, viewportSize) {
  const viewBounds = {
    x: -stagePos.x / scale,
    y: -stagePos.y / scale,
    width: viewportSize.width / scale,
    height: viewportSize.height / scale,
  };
  return objects.filter(
    (obj) =>
      obj.x + obj.width > viewBounds.x &&
      obj.x < viewBounds.x + viewBounds.width &&
      obj.y + obj.height > viewBounds.y &&
      obj.y < viewBounds.y + viewBounds.height,
  );
}
```

### Performance Targets

- **60 FPS** during pan, zoom, drag operations.
- **500+ objects** rendered without drops.
- Techniques:
  - `listening={false}` on background layer.
  - Virtual rendering: only render objects within viewport bounds.
  - `batchDraw()` instead of individual redraws.
  - Debounce Socket.IO messages that trigger React state (cursor list, presence).
  - `React.memo` on toolbar/panel components.

### FPS Monitoring

Use stats.js overlay in development:

```javascript
import Stats from "stats.js";
const stats = new Stats();
document.body.appendChild(stats.dom);
requestAnimationFrame(function loop() {
  stats.update();
  requestAnimationFrame(loop);
});
```

### File Organization

```
src/components/
├── Canvas.tsx          # Main Stage wrapper, pan/zoom, event handlers
├── StickyNote.tsx      # Memoized Konva sticky note
├── ShapeRect.tsx       # Memoized Konva rectangle
├── ShapeCircle.tsx     # Memoized Konva circle
├── Connector.tsx       # Konva arrow/line between objects
├── RemoteCursor.tsx    # Other user's cursor + name label
├── SelectionManager.tsx# Transformer and rubber-band
├── Toolbar.tsx         # React UI (not canvas)
├── Presence.tsx        # React UI — who's online
├── ChatPanel.tsx       # React UI — AI command input
└── MetricsOverlay.tsx  # React UI — performance display
```

---

## Real-Time Sync Patterns (Socket.IO + Firestore)

### Two-Layer Architecture

- **Socket.IO** = fast broadcast layer (cursors + object events, in-memory, <50ms).
- **Firestore** = persistence layer (board state, debounced writes every 2-5s).

Socket.IO handles real-time; Firestore handles durability. Never block UI on Firestore writes.

### Data Ownership

| Data                    | Owner                         | Persist?                      |
| ----------------------- | ----------------------------- | ----------------------------- |
| Cursor positions        | Socket.IO broadcast                | NO                            |
| Object live updates     | Socket.IO broadcast                | Debounced to Firestore (3s)   |
| Board state on load     | Firestore                     | YES (source of truth on join) |
| Presence (who's online) | Socket.IO Presence API             | NO                            |
| User metadata           | Firestore (via Firebase Auth) | YES                           |

### Socket.IO Channels

- **Board channel** (`board:{boardId}`) — object CRUD events + cursor positions.
- Socket.IO **Presence** on the same channel — who's online, join/leave.

### Cursor Sync

- Throttle cursor broadcasts to **16ms** (60fps) using `requestAnimationFrame`.
- Payload: `{ userId, x, y, color, name, sentAt: Date.now() }` in world coordinates.
- Remote cursors: interpolate/tween position for smoothness.
- Measure latency: `Date.now() - msg.data.sentAt` must be **<50ms**.

### Object Sync

- Events: `object:create`, `object:update`, `object:delete`.
- Payload: full object state (not diffs). Simplicity > bandwidth.
- Flow: local Konva update (optimistic) → Socket.IO publish → other clients receive → update their Konva stage via refs.
- Debounced Firestore write every 2-5 seconds (not per-event).

### Persistence Strategy

```
User action → Update Konva via ref → Publish to Socket.IO → Debounced write to Firestore
On join     → Load full board from Firestore doc → Render on Konva → Subscribe to Socket.IO
On reconnect→ Re-subscribe to Socket.IO → Fetch latest from Firestore → Merge
```

### Conflict Resolution

- **Last-write-wins** using `updatedAt` timestamps on each object.
- If received event has older `updatedAt` than local, discard.
- Document this approach in README.

```javascript
function resolveConflict(localObj, remoteObj) {
  if (new Date(remoteObj.updatedAt) > new Date(localObj.updatedAt)) {
    return remoteObj;
  }
  return localObj;
}
```

### Disconnect/Reconnect

- Socket.IO auto-reconnects with exponential backoff.
- Show "Reconnecting..." banner on disconnect.
- On reconnect: Socket.IO presence auto-restores; fetch full board from Firestore to reconcile.
- Socket.IO presence cleans up stale users after 15s timeout.

```javascript
getSocket.IOClient().connection.on("connected", async () => {
  const boardDoc = await getDoc(doc(db, "boards", boardId));
  if (boardDoc.exists()) {
    renderFullBoard(stageRef, boardDoc.data().objects);
  }
});

getSocket.IOClient().connection.on("disconnected", () => {
  showReconnectBanner();
});
```

### useRealtimeBoard Hook

```javascript
function useRealtimeBoard(boardId, userId, stageRef) {
  const channelRef = useRef(null);

  const debouncedSave = useRef(
    debounce((objects) => {
      updateDoc(doc(db, "boards", boardId), {
        objects,
        updatedAt: serverTimestamp(),
      });
    }, 3000),
  ).current;

  useEffect(() => {
    const channel = getSocket.IOClient().channels.get(`board:${boardId}`);
    channelRef.current = channel;

    channel.subscribe("object:create", (msg) => {
      if (msg.clientId === getSocket.IOClient().auth.clientId) return;
      addObjectToCanvas(stageRef, msg.data);
    });

    channel.subscribe("object:update", (msg) => {
      if (msg.clientId === getSocket.IOClient().auth.clientId) return;
      const shape = stageRef.current.findOne(`#${msg.data.id}`);
      if (shape) {
        shape.setAttrs(msg.data.attrs);
        shape.getLayer().batchDraw();
      }
    });

    channel.subscribe("object:delete", (msg) => {
      if (msg.clientId === getSocket.IOClient().auth.clientId) return;
      const shape = stageRef.current.findOne(`#${msg.data.id}`);
      if (shape) {
        shape.destroy();
        shape.getLayer().batchDraw();
      }
    });

    channel.presence.enter({ name: userName, color: userColor });

    return () => {
      channel.presence.leave();
      channel.unsubscribe();
    };
  }, [boardId]);

  const publishObjectUpdate = useCallback((id, attrs) => {
    channelRef.current?.publish("object:update", { id, attrs, _ts: Date.now() });
    debouncedSave(getAllObjectsFromCanvas(stageRef));
  }, []);

  const publishObjectCreate = useCallback((object) => {
    channelRef.current?.publish("object:create", object);
    debouncedSave(getAllObjectsFromCanvas(stageRef));
  }, []);

  const publishObjectDelete = useCallback((id) => {
    channelRef.current?.publish("object:delete", { id });
    debouncedSave(getAllObjectsFromCanvas(stageRef));
  }, []);

  return { publishObjectUpdate, publishObjectCreate, publishObjectDelete };
}
```

### useCursors Hook

```javascript
function useCursors(boardId) {
  const channelRef = useRef(null);
  const [remoteCursors, setRemoteCursors] = useState(new Map());

  const throttledPublish = useRef(
    throttle((position) => {
      channelRef.current?.publish("cursor:move", {
        x: position.x,
        y: position.y,
        _ts: Date.now(),
      });
    }, 50),
  ).current;

  useEffect(() => {
    const channel = getSocket.IOClient().channels.get(`board:${boardId}`);
    channelRef.current = channel;

    channel.subscribe("cursor:move", (msg) => {
      if (msg.clientId === getSocket.IOClient().auth.clientId) return;
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(msg.clientId, { x: msg.data.x, y: msg.data.y, _ts: msg.data._ts });
        return next;
      });
    });

    channel.presence.subscribe("leave", (member) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.delete(member.clientId);
        return next;
      });
    });

    return () => channel.unsubscribe();
  }, [boardId]);

  return { remoteCursors, publishCursor: throttledPublish };
}
```

### usePresence Hook

```javascript
function usePresence(boardId) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const channel = getSocket.IOClient().channels.get(`board:${boardId}`);

    const updateMembers = async () => {
      const present = await channel.presence.get();
      setMembers(present.map((m) => ({ clientId: m.clientId, ...m.data })));
    };

    channel.presence.subscribe("enter", updateMembers);
    channel.presence.subscribe("leave", updateMembers);
    channel.presence.subscribe("update", updateMembers);
    updateMembers();

    return () => channel.presence.unsubscribe();
  }, [boardId]);

  return members;
}
```

### Cost Optimization

| Without debouncing         | With debouncing (3s) |
| -------------------------- | -------------------- |
| 6,000 Firestore writes/min | ~20 writes/min       |
| Hits free tier limits fast | Stays in free tier   |

### Socket.IO Free Tier Budget

- 6M messages/month
- 5 concurrent connections (sufficient for showcase testing)
- 200 peak connections/sec

### Anti-Patterns

- Do NOT write every object change directly to Firestore — always debounce.
- Do NOT use React state for canvas objects — use Konva refs (`stageRef.current.findOne`).
- Do NOT block UI on Firestore acknowledgment — optimistic updates only.
- Do NOT send diffs/patches — send full object state for simplicity.

---

## AI Board Agent (Anthropic Claude)

### Architecture

```
User chat input → POST /api/ai/generate → Claude function calling → JSON tool calls
→ Client parses tool calls → Executes on Konva stage → Broadcasts via Socket.IO
```

AI calls go through **Vercel serverless function** (`/api/ai/generate.ts`) to protect the Anthropic API key. Never expose `ANTHROPIC_API_KEY` to the client.

### Tool Schema (9 tools minimum)

```
createStickyNote(text, x, y, color)
createShape(type, x, y, width, height, color)
createFrame(title, x, y, width, height)
createConnector(fromId, toId, style)
moveObject(objectId, x, y)
resizeObject(objectId, width, height)
updateText(objectId, newText)
changeColor(objectId, color)
getBoardState()
```

### Command Categories (6+ required)

1. **Creation** — "Add a yellow sticky note that says 'User Research'"
2. **Manipulation** — "Change the sticky note color to green"
3. **Layout** — "Arrange these sticky notes in a grid"
4. **Complex/Template** — "Create a SWOT analysis template with four quadrants"

### Serverless Function Pattern

```javascript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, boardState } = req.body;
  if (!prompt || prompt.length > 500) return res.status(400).json({ error: "Invalid prompt" });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    tools: toolDefinitions,
    messages: [{ role: "user", content: prompt }],
    system: `You are a whiteboard AI assistant. Current board state: ${JSON.stringify(boardState)}`,
  });

  res.json({ toolCalls: message.content.filter((c) => c.type === "tool_use") });
}
```

### Multi-Step Commands

- Complex commands (SWOT, retro board) may return multiple tool calls.
- Execute sequentially, accumulating created IDs for positioning.
- Pass intermediate state back to Claude if needed.

### Performance & Safety

- Target: **<2 seconds** for single-step commands.
- Rate limit: 5 requests/min per user.
- Input sanitization: strip HTML, limit to 500 chars.
- DOMPurify on any AI-generated SVG content before rendering.

### Shared AI State

- AI-generated objects are regular board objects — they sync via Socket.IO to all users.
- Multiple users can issue AI commands simultaneously (independent operations).
- Tag AI objects with `createdBy: 'ai-agent'` in metadata.

---

## Deployment & Performance

### Performance Targets (from PRD)

| Metric              | Target                                |
| ------------------- | ------------------------------------- |
| Frame rate          | 60 FPS during pan, zoom, manipulation |
| Object sync latency | <100ms (Socket.IO broadcast)               |
| Cursor sync latency | <50ms (Socket.IO broadcast)                |
| Object capacity     | 500+ objects without drops            |
| Concurrent users    | 5+ without degradation                |
| AI response latency | <2 seconds for single-step commands   |

### Environment Variables (Vercel Dashboard)

```bash
# Client-side (VITE_ prefix = exposed to browser)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_SOCKET_SERVER_URL=xxx

# Server-side only (Vercel serverless functions)
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional
VITE_ENABLE_METRICS=true
```

Never expose `ANTHROPIC_API_KEY` to the client. AI calls route through `/api/ai/generate.ts`.

### Deployment (Vercel)

- Auto-deploy on `git push origin main`.
- Frontend: static React build served via Vercel edge CDN.
- Serverless: `/api` folder auto-deployed as Vercel functions.
- No custom backend server to manage.

### Cost Targets

- Total project cost: $0-5
- Socket.IO: free tier (6M messages/month)
- Firebase: free tier
- Vercel: free tier (100GB bandwidth)
- Anthropic Claude: ~$5 for dev + demos

---

## Testing Strategy: Metrics Validation Over Unit Tests

For a 1-week sprint, **performance benchmarks that prove requirements** are more valuable than Jest mocks.

### Priority

1. Latency validation (proves <100ms objects, <50ms cursors)
2. FPS monitoring (proves 60 FPS)
3. Concurrent user load tests (proves 5+ users)
4. Object capacity stress tests (proves 500+ objects)

### Performance Gates (hard requirements)

| Metric              | Target | Gate |
| ------------------- | ------ | ---- |
| Object sync latency | <100ms | HARD |
| Cursor sync latency | <50ms  | HARD |
| Canvas FPS          | 60 FPS | HARD |
| Object capacity     | 500+   | HARD |
| Concurrent users    | 5+     | HARD |

**If any gate fails, STOP feature work and debug before continuing.**

### Latency Validation (run early — hours 1-4)

```javascript
async function validateSocketLatency(channel) {
  const results = { cursor: [], object: [] };

  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => {
      const start = Date.now();
      const testId = `test-${i}`;

      channel.subscribe(testId, () => {
        results.cursor.push(Date.now() - start);
        channel.unsubscribe(testId);
        resolve();
      });

      channel.publish(testId, { sentAt: start });
    });
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const max = (arr) => Math.max(...arr);

  console.log(`Cursor latency — avg: ${avg(results.cursor).toFixed(1)}ms, max: ${max(results.cursor)}ms`);
  console.assert(avg(results.cursor) < 50, "FAIL: Cursor latency exceeds 50ms target");
  return results;
}
```

### Latency Measurement

```javascript
const measureLatency = (channel, eventName, data) => {
  const sent = Date.now();
  channel.publish(eventName, { _ts: sent, ...data });
};

channel.subscribe(eventName, (msg) => {
  const latency = Date.now() - msg.data._ts;
  if (latency > 100) console.warn(`[PERF] High latency: ${eventName} ${latency}ms`);
});
```

### FPS Monitoring (Custom Hook)

```javascript
function useFPS() {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId;

    const countFrame = () => {
      frameCount++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(countFrame);
    };

    rafId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps;
}
```

### MetricsOverlay Component

```jsx
function MetricsOverlay({ cursorLatency, objectLatency, fps, userCount, objectCount }) {
  return (
    <div style={{
      position: "fixed", bottom: 8, right: 8, background: "#000a",
      color: "#0f0", padding: 8, fontFamily: "monospace", fontSize: 12,
      zIndex: 9999, borderRadius: 4,
    }}>
      <div>FPS: {fps}</div>
      <div>Cursor avg: {cursorLatency.toFixed(0)}ms {cursorLatency > 50 ? "⚠️" : "✅"}</div>
      <div>Object avg: {objectLatency.toFixed(0)}ms {objectLatency > 100 ? "⚠️" : "✅"}</div>
      <div>Users: {userCount} | Objects: {objectCount}</div>
    </div>
  );
}
```

### Object Capacity Stress Test

```javascript
function stressTest(stage, layer, count = 500) {
  console.time("stress-test-create");
  for (let i = 0; i < count; i++) {
    const rect = new Konva.Rect({
      id: `stress-${i}`,
      x: Math.random() * 5000, y: Math.random() * 5000,
      width: 100, height: 80,
      fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
    });
    layer.add(rect);
  }
  layer.batchDraw();
  console.timeEnd("stress-test-create");
  console.log(`Rendered ${count} objects. Check FPS counter.`);
}
```

### PRD Testing Scenarios (will be graded)

1. **Two-user simultaneous editing** in different browsers → both see all changes.
2. **One user refreshing mid-edit** → all objects reload from Firestore.
3. **Rapid creation/movement** → sync performance stays under targets.
4. **Network throttling** → graceful disconnect, reconnect, convergence.
5. **5+ concurrent users** → no degradation.

### When to Add Unit Tests

Add targeted tests only for complex pure functions:

- Coordinate transforms (worldToScreen, screenToWorld)
- Conflict resolution logic (timestamp comparison)
- AI tool call parsing

---

## Build Priority (strict order)

1. **Validate Socket.IO latency** (hours 1-4) — echo test, measure <50ms cursors, <100ms objects
2. **Cursor sync** — two cursors moving across browsers
3. **Object sync** — sticky notes appear for all users
4. **Canvas pan/zoom** — infinite board, smooth navigation
5. **Object manipulation** — create, move, edit, shapes
6. **Conflict handling** — last-write-wins with timestamps
7. **State persistence** — Firestore, survive refresh/reconnect
8. **Auth + deploy** — Firebase Auth, Vercel, publicly accessible
9. **Board features** — shapes, frames, connectors, transforms, selection
10. **AI commands basic** — single-step creation/manipulation via Claude
11. **AI commands complex** — SWOT template, retro board, multi-step

**Finish one layer before starting the next.**

## Deadlines

| Checkpoint       | Deadline           | Focus                        |
| ---------------- | ------------------ | ---------------------------- |
| Pre-Search       | Monday (hour 1)    | Architecture decisions       |
| MVP              | Tuesday (24 hours) | Collaborative infrastructure |
| Early Submission | Friday (4 days)    | Full feature set             |
| Final            | Sunday (7 days)    | Polish, docs, deployment     |

## MVP Checklist (24-hour hard gate)

- [ ] Infinite board with pan/zoom
- [ ] Sticky notes with editable text
- [ ] At least one shape type
- [ ] Create, move, and edit objects
- [ ] Real-time sync between 2+ users
- [ ] Multiplayer cursors with name labels
- [ ] Presence awareness
- [ ] User authentication (Google Sign-In)
- [ ] Deployed and publicly accessible

## Final Submission Checklist

- [ ] All MVP requirements
- [ ] AI agent with 6+ command types
- [ ] Metrics overlay proving <100ms objects, <50ms cursors
- [ ] 5+ concurrent users verified
- [ ] 500+ objects capacity verified
- [ ] Share links working (UUID-based board URLs)
- [ ] README: setup guide, architecture, deployed link
- [ ] Demo video (3-5 min)
- [ ] Pre-Search document
- [ ] AI Development Log (1 page)
- [ ] AI Cost Analysis (dev spend + projections 100/1K/10K/100K users)
- [ ] Social post on X or LinkedIn, tag @GauntletAI

---

## Auto-Deploy Workflow

### Commit Frequency

**After completing ANY meaningful work unit, immediately commit and push:**

- After implementing a feature (even if partially working)
- After fixing a bug or error
- After adding a new component, hook, or utility
- After updating configuration or documentation
- Before switching context or taking a break

**DO NOT wait for:** perfect polish, complete features, or multiple changes to batch.

### Commit Message Format

```
<type>: <short summary>

<optional body with details>
```

**Types:** `feat:`, `fix:`, `perf:`, `refactor:`, `test:`, `docs:`, `chore:`

### Why This Matters

- **Vercel auto-deploys** on every push → see changes live immediately
- **Continuous integration** — catch deployment issues early
- **Progress visibility** — GitHub shows commit history for AI Development Log
- **Safe checkpoints** — easy to revert if something breaks

### When NOT to Commit

- Code doesn't compile (fix TypeScript errors first)
- Contains sensitive data (check .gitignore covers .env)

---

## Commands

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + Vite build
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm test             # Run tests once (vitest)
npm run test:watch   # Watch mode tests
```
