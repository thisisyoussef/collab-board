# US-05: Local Canvas CRUD + Firestore Persistence

## Status

- State: Not Started
- Owner: Codex
- Depends on: US-04 Approved

## Persona

**Alex, the Facilitator** — Alex opens a board and wants to start building content immediately: dropping sticky notes, drawing rectangles, moving things around, typing text. Alex expects the board to feel like Miro — click a tool, click the canvas, and the object appears. Alex also expects that if they refresh the page, everything they created is still there.

**Sam, the Participant** — Sam joins the board later and expects to see everything Alex already created. Sam wants to add their own stickies and shapes alongside Alex's work.

## User Story

> As Alex, I want to create, move, resize, edit, and delete sticky notes and shapes on the canvas so I can build out my board content visually.

> As Alex, I want my board to persist when I close and reopen it so I don't lose any work.

## Goal

Build the full local canvas CRUD experience (sticky notes, rectangles) with pan/zoom, selection/transform, and debounced Firestore persistence. This story is single-user — cross-user sync comes in US-06.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/react-konva.md` — Shapes (Rect, Text, Group), Drag and Drop, Transformer (select & resize), Free Drawing, zIndex ordering
- **Required reading:** `docs/konva-api.md` — Rect, Text, Group, Transformer config/methods, Common Node Methods (positioning, events, style)
- **Required reading:** `docs/konva-select-transform.md` — Selection rectangle, multi-select, transform end scale reset pattern (CRITICAL)
- **Required reading:** `docs/firebase-firestore.md` — `setDoc`, `getDoc`, `updateDoc` with dot notation for nested fields, `serverTimestamp()`, "Debounced Board Save" pattern, "Board Document Structure"
- **Reference:** `CLAUDE.md` — CRITICAL performance pattern (Konva refs, NOT React state for canvas objects), `objectsRef.current`, `addObject`/`updateObject`/`removeObject` via refs, Board Object Schema, pan/zoom implementation, Konva Layer table

**Be strategic:** This is the most complex story. The canvas MUST use Konva refs for object state, not React state — re-read `CLAUDE.md`'s "Critical Performance Pattern" section. The Transformer modifies `scaleX`/`scaleY`, not `width`/`height` — you MUST reset scale in `onTransformEnd` (see `docs/konva-select-transform.md`). Debounce Firestore writes to 3s. Store objects as a flat map `{ [id]: objectData }` in the Firestore document. Load once on mount with `getDoc`, not `onSnapshot` (real-time sync comes in US-06).

## Screens

### Screen: Board Page — Full Canvas Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐│
│  │ CollabBoard   [Presence avatars]    🟢 Connected         ││
│  │ Board: abc123                       [ Back ] [ Sign out] ││
│  └──────────────────────────────────────────────────────────┘│
│  ┌────────┐ ┌──────────────────────────────────────────────┐ │
│  │Toolbar │ │                                              │ │
│  │        │ │     (infinite canvas — Konva Stage)          │ │
│  │ 🖱 Select│ │                                              │ │
│  │ 📝 Sticky│ │    ┌────────────┐                            │ │
│  │ ▢ Rect  │ │    │ Hello!     │  ← sticky note            │ │
│  │ 🗑 Delete│ │    └────────────┘                            │ │
│  │        │ │                ┌──────────────┐              │ │
│  │        │ │                │              │ ← rectangle  │ │
│  │        │ │                └──────────────┘              │ │
│  │        │ │                                              │ │
│  └────────┘ └──────────────────────────────────────────────┘ │
│             ┌──────────────────┐                             │
│             │ FPS: 60          │                             │
│             │ Cursor: 23ms ✅  │                             │
│             │ Objects: 5       │                             │
│             └──────────────────┘                             │
└──────────────────────────────────────────────────────────────┘
```

### Toolbar (Left Rail)

- Position: fixed left side, `width: 56px`, `height: calc(100vh - header height)`.
- Background: `#fff`, `border-right: 1px solid #e5e7eb`.
- Tools arranged vertically, each is a `40px × 40px` button with icon:
  - **Select** (pointer icon) — default tool. Click to select/move objects.
  - **Sticky Note** (note icon) — click canvas to place a new sticky.
  - **Rectangle** (square icon) — click-drag on canvas to draw a rectangle.
  - **Delete** (trash icon) — click to delete selected object(s). Only enabled when something is selected.
- Active tool has `background: #eff6ff`, `border: 1px solid #2563eb`, `border-radius: 8px`.
- Inactive tools: `background: transparent`, hover: `background: #f3f4f6`.
- Keyboard shortcuts: `V` = select, `S` = sticky, `R` = rectangle, `Delete`/`Backspace` = delete selected.

### Canvas Area

- **Stage:** fills remaining viewport (`width: 100vw - toolbar width`, `height: 100vh - header height`).
- **Background:** light dot grid pattern (`#e5e7eb` dots, `20px` spacing) on a `#fafafa` background. `listening={false}`.
- **Pan:** stage is `draggable` (drag on empty canvas area to pan). Cursor changes to grabbing hand while panning.
- **Zoom:** mouse wheel zooms toward cursor position. Scale clamped `0.1–5`. Smooth zoom.

### Sticky Note Object

```
┌──────────────────┐
│ User Research     │  ← text, editable on double-click
│                   │
│                   │
└──────────────────┘
```

- **Default size:** `150 × 100px`.
- **Default color:** `#FFEB3B` (yellow). Other available colors: `#FF7043` (orange), `#66BB6A` (green), `#42A5F5` (blue), `#AB47BC` (purple), `#EC407A` (pink).
- **Corner radius:** `4px`.
- **Shadow:** `shadowBlur: 4`, `shadowOpacity: 0.15`, `shadowOffset: { x: 0, y: 2 }`.
- **Text:** `fontSize: 14`, `fontFamily: 'Segoe UI', sans-serif`, `padding: 8px`, `wrap: 'word'`, `verticalAlign: 'top'`.
- **Double-click:** Opens an inline text editing overlay (HTML input via `react-konva-utils` `<Html>` or a positioned `<textarea>` over the canvas). Press Enter or click away to commit.
- **Draggable:** yes, on select tool.

### Rectangle Object

- **Default size:** drawn by click-drag (minimum `20 × 20px`).
- **Default color:** `#E3F2FD` (light blue fill), `#1565C0` (blue stroke), `strokeWidth: 2`.
- **Corner radius:** `0px` (sharp corners).
- **Draggable:** yes, on select tool.

### Selection & Transform

- **Single click** on an object → selects it. Konva `Transformer` appears with 8 resize handles + rotation handle.
- **Click empty canvas** → deselects all. Transformer hides.
- **Shift+click** → toggle in multi-selection.
- **Drag on empty canvas** (select tool) → rubber-band selection rectangle (`fill: rgba(37, 99, 235, 0.1)`, `stroke: #2563eb`, `strokeWidth: 1`). On mouse-up, selects all objects intersecting the rectangle.
- **Transformer handles:** resize (8 corners/edges), rotate (top handle). On transform end: reset scale to 1, compute new width/height.
- **Delete:** press `Delete` or `Backspace` key, or click toolbar trash icon → removes selected objects from canvas and `objectsRef`.

### Text Editing Overlay

- On double-click of a sticky note: a `<textarea>` appears positioned exactly over the sticky note's text area.
- `background: transparent`, `border: none`, `font-size: 14px`, `font-family: 'Segoe UI'`, `padding: 8px`, matching the sticky note dimensions.
- `Escape` or click outside → cancel edit, revert.
- `Enter` (without Shift) or blur → commit text change.
- While editing, the sticky note's Konva text is hidden (textarea replaces it visually).

## UX Script

### Happy Path: Create, Move, Edit, Delete

1. Alex opens the board. Empty canvas with dot grid background.
2. Alex clicks the "Sticky Note" tool in the toolbar. The tool highlights blue.
3. Alex clicks on the canvas at position (200, 300). A yellow sticky note appears at that position with placeholder text "New note". Tool auto-switches back to Select.
4. Alex double-clicks the sticky. A textarea appears over it. Alex types "User Research". Presses Enter. Text commits. Textarea disappears.
5. Alex drags the sticky to a new position. The note follows the mouse smoothly.
6. Alex clicks the "Rectangle" tool. Clicks and drags on the canvas from (400, 200) to (600, 350). A light blue rectangle appears.
7. Alex clicks the sticky note. Transformer handles appear (8 resize + rotation).
8. Alex drags a corner handle to resize. On release, the sticky note's width/height update (scale resets to 1).
9. Alex presses `Delete`. The sticky note is removed from the canvas.
10. Alex refreshes the page. All remaining objects reload from Firestore.

### Happy Path: Pan & Zoom

1. Alex holds the mouse on empty canvas and drags → canvas pans. All objects move together.
2. Alex scrolls the mouse wheel → canvas zooms toward cursor position. Objects scale smoothly.
3. Objects added at zoomed/panned positions are stored in world coordinates — they appear in the correct position regardless of current viewport.

### Happy Path: Persistence

1. Alex creates 5 objects. The debounced save fires after 3 seconds of inactivity.
2. Alex closes the tab. Reopens the board URL. All 5 objects load from Firestore.
3. Firestore document contains `objects: { [id]: { type, x, y, width, height, text, color, ... } }`.

### Edge: Rapid Edits

1. Alex moves a sticky note 20 times in 5 seconds. Each move updates `objectsRef` locally.
2. Only 1-2 Firestore writes happen during this period (3-second debounce).

## Implementation Details

### Files

| File | Purpose |
|------|---------|
| `src/components/Canvas.tsx` | Konva Stage + Layers (background, objects, selection, cursors). Pan/zoom handlers. Object creation click handlers. |
| `src/components/Toolbar.tsx` | Tool selection buttons (select, sticky, rect, delete). Keyboard shortcut listener. |
| `src/components/StickyNote.tsx` | Memoized Konva Group (Rect + Text) for a single sticky note. |
| `src/components/ShapeRect.tsx` | Memoized Konva Rect for rectangle shapes. |
| `src/components/SelectionManager.tsx` | Konva Transformer + rubber-band selection rect. |
| `src/components/TextEditor.tsx` | HTML textarea overlay for inline text editing. |
| `src/hooks/useBoard.ts` | Board object CRUD operations on `objectsRef`. Debounced Firestore save. Load on mount. |
| `src/pages/Board.tsx` | Orchestrates all components: Canvas, Toolbar, header, presence, cursors, metrics. |

### Board Object Schema (stored in Firestore)

```ts
interface BoardObject {
  id: string;                    // crypto.randomUUID()
  type: "sticky" | "rect";
  x: number;                    // world coordinates
  y: number;
  width: number;
  height: number;
  rotation: number;             // degrees
  text?: string;                // for sticky notes
  color: string;                // hex fill color
  stroke?: string;              // hex stroke color
  strokeWidth?: number;
  fontSize?: number;
  zIndex: number;               // render order
  createdBy: string;            // userId
  updatedAt: string;            // ISO string
}
```

### Firestore Document Structure

```
boards/{boardId}
  title: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  objects: {
    "uuid-1": { id, type, x, y, ... },
    "uuid-2": { id, type, x, y, ... },
  }
```

### Critical: Ref-Based State (NOT React State)

```ts
const objectsRef = useRef<Map<string, BoardObject>>(new Map());
const layerRef = useRef<Konva.Layer>(null);
const stageRef = useRef<Konva.Stage>(null);

// Add an object (IMPERATIVE — no setState)
function addObject(obj: BoardObject) {
  objectsRef.current.set(obj.id, obj);
  const shape = createKonvaNode(obj);
  layerRef.current.add(shape);
  layerRef.current.batchDraw();
  scheduleSave();
}

// Update an object (IMPERATIVE)
function updateObject(id: string, attrs: Partial<BoardObject>) {
  const obj = objectsRef.current.get(id);
  if (!obj) return;
  objectsRef.current.set(id, { ...obj, ...attrs });
  const node = stageRef.current.findOne(`#${id}`);
  if (node) {
    node.setAttrs(attrs);
    layerRef.current.batchDraw();
  }
  scheduleSave();
}
```

### Konva Layer Structure

| Layer | Content | `listening` |
|-------|---------|-------------|
| Background | Dot grid | `false` |
| Objects | Sticky notes, rectangles | `true` |
| Selection | Transformer, rubber-band rect | `true` |
| Cursors | Remote cursors (from US-04) | `false` |

## Acceptance Criteria

- [ ] Sticky notes can be created by clicking canvas with sticky tool active.
- [ ] Rectangles can be created by click-dragging with rect tool active.
- [ ] Objects can be dragged to new positions (select tool).
- [ ] Objects can be resized/rotated with Transformer handles. Scale resets to 1 on transform end.
- [ ] Sticky note text can be edited by double-clicking (inline textarea overlay).
- [ ] Objects can be deleted with Delete/Backspace key or toolbar button.
- [ ] Canvas supports pan (drag on empty area) and zoom (scroll wheel toward cursor).
- [ ] Object positions are in world coordinates (correct after pan/zoom).
- [ ] Board state persists to Firestore via debounced writes (3-second debounce).
- [ ] Board loads objects from Firestore on mount.
- [ ] Canvas objects use Konva refs (NOT React state) — verify no `useState` for object arrays.
- [ ] Rubber-band selection selects objects within the drawn rectangle.
- [ ] Shift+click toggles objects in multi-selection.
- [ ] Keyboard shortcuts work: `V` (select), `S` (sticky), `R` (rect), `Delete` (remove).
- [ ] `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open a board. Verify empty canvas with dot grid background.
2. Click "Sticky Note" tool → click canvas. Verify yellow sticky appears. Double-click it, type text, press Enter. Verify text is saved.
3. Click "Rectangle" tool → click-drag on canvas. Verify rectangle appears.
4. Click an object. Verify Transformer handles appear. Drag a handle to resize. Verify object resizes.
5. Drag an object to a new position. Verify smooth movement.
6. Select an object, press Delete. Verify it's removed.
7. Pan the canvas (drag empty area). Zoom with scroll wheel. Verify smooth behavior.
8. Create 5 objects. Wait 5 seconds. Refresh the page. Verify all 5 objects reload.
9. Check metrics overlay — "Objects: 5" should appear.

## Checkpoint Result

- Production Frontend URL:
- User Validation: Pending
- Notes:
