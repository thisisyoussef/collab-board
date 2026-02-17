---
name: vite-react-konva
description: Vite + React + Konva architecture patterns for CollabBoard. Covers the critical ref-based canvas update pattern, pan/zoom, selection, object memoization, and component organization. Use when building canvas components, implementing pan/zoom, adding board objects, or debugging render performance.
---

# Vite + React + Konva Architecture

## Golden Rule

**NEVER store canvas object state in React state. Use Konva refs for all canvas interactions.**

React state triggers reconciliation on the entire virtual DOM. With 500 objects, that means 500 component re-renders on every drag frame. Konva's scene graph is designed for direct manipulation — use it.

## Correct Pattern: Ref-Based Canvas Updates

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
    // Update ref map for persistence
    const obj = objectsRef.current.get(id);
    if (obj) objectsRef.current.set(id, { ...obj, ...attrs });
  }, []);

  const addObject = useCallback((object) => {
    objectsRef.current.set(object.id, object);
    // Imperative: add shape to Konva layer directly
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
    <Stage
      ref={stageRef}
      width={window.innerWidth}
      height={window.innerHeight}
      draggable
    >
      <Layer ref={layerRef} />
      <Layer>{/* Selection overlay */}</Layer>
      <Layer>{/* Remote cursors */}</Layer>
    </Stage>
  );
};
```

## Wrong Pattern (DO NOT USE)

```jsx
// This causes full re-render of all objects on every update
const [objects, setObjects] = useState([]);

const updateObject = (id, attrs) => {
  setObjects((prev) =>
    prev.map((obj) => (obj.id === id ? { ...obj, ...attrs } : obj)),
  );
};
```

## When React State IS Appropriate

Use React state ONLY for:

- UI components (toolbar, panels, dialogs) — these re-render infrequently
- Remote cursor list (updated via Ably, debounced)
- Presence list (who's online)
- Selection state (which objects are selected — small array)
- Board metadata (title, settings)
- Auth state

## Pan & Zoom

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

  // Zoom toward cursor position
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

## Object Components (React-Konva hybrid approach)

If using React-Konva components for initial render, memoize aggressively:

```jsx
const StickyNote = React.memo(
  ({ id, x, y, width, height, text, color, onDragEnd, onDblClick }) => (
    <Group
      id={id}
      x={x}
      y={y}
      draggable
      onDragEnd={onDragEnd}
      onDblClick={onDblClick}
    >
      <Rect
        width={width}
        height={height}
        fill={color}
        cornerRadius={4}
        shadowBlur={4}
        shadowOpacity={0.2}
      />
      <Text
        text={text}
        width={width}
        height={height}
        padding={8}
        fontSize={14}
      />
    </Group>
  ),
  (prev, next) =>
    prev.x === next.x &&
    prev.y === next.y &&
    prev.text === next.text &&
    prev.color === next.color &&
    prev.width === next.width &&
    prev.height === next.height,
);
```

## Selection & Transform

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

## Konva Layer Best Practices

| Layer      | Content                  | `listening` | Redraws                 |
| ---------- | ------------------------ | ----------- | ----------------------- |
| Background | Grid dots                | `false`     | Rarely (on zoom)        |
| Objects    | Stickies, shapes, text   | `true`      | On object updates       |
| Selection  | Transformer, rubber band | `true`      | On selection changes    |
| Cursors    | Remote user cursors      | `false`     | On cursor updates (RAF) |

## Viewport Culling (500+ objects)

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

## File Organization

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
