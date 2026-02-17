# Konva Select & Transform Guide

> Source: https://konvajs.org/docs/select_and_transform/Basic_demo.html

## Overview

The `Transformer` is a specialized `Konva.Group` that enables resizing and rotating nodes via handles. It modifies `scaleX`/`scaleY` (not `width`/`height` directly).

## Setup

1. Create a `Konva.Transformer` instance
2. Add it to a layer
3. Attach target nodes: `transformer.nodes([shape1, shape2])`

## User Interactions

- **Resize/rotate** via transformer handles
- **Click empty area** → deselect all
- **Click shape** → select only that shape
- **SHIFT/CTRL + click selected** → remove from selection
- **SHIFT/CTRL + click unselected** → add to selection
- **Click-drag on empty area** → rubber-band selection rectangle

## Selection Rectangle Implementation

```js
// Create selection rectangle (initially invisible)
const selectionRect = new Konva.Rect({
  fill: 'rgba(0,0,255,0.5)',
  visible: false,
});
layer.add(selectionRect);

let x1, y1, x2, y2;

stage.on('mousedown touchstart', (e) => {
  if (e.target !== stage) return; // only on empty area
  x1 = stage.getPointerPosition().x;
  y1 = stage.getPointerPosition().y;
  x2 = x1;
  y2 = y1;
  selectionRect.visible(true);
  selectionRect.width(0);
  selectionRect.height(0);
});

stage.on('mousemove touchmove', () => {
  if (!selectionRect.visible()) return;
  x2 = stage.getPointerPosition().x;
  y2 = stage.getPointerPosition().y;
  selectionRect.setAttrs({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  });
});

stage.on('mouseup touchend', () => {
  if (!selectionRect.visible()) return;
  selectionRect.visible(false);

  const box = selectionRect.getClientRect();
  const selected = shapes.filter((shape) =>
    Konva.Util.haveIntersection(box, shape.getClientRect())
  );
  transformer.nodes(selected);
});
```

## Transform End — Reset Scale Pattern

**Critical:** Transformer modifies scale, not dimensions. You must reset scale and compute new width/height.

```js
shape.on('transformend', () => {
  const scaleX = shape.scaleX();
  const scaleY = shape.scaleY();

  // Reset scale
  shape.scaleX(1);
  shape.scaleY(1);

  // Apply scaled dimensions
  shape.width(Math.max(5, shape.width() * scaleX));
  shape.height(Math.max(5, shape.height() * scaleY));
});
```

## Deselection

```js
stage.on('click tap', (e) => {
  // Click on empty area
  if (e.target === stage) {
    transformer.nodes([]);
    return;
  }
});
```

## Multi-Selection with Shift/Ctrl

```js
stage.on('click tap', (e) => {
  if (e.target === stage) {
    transformer.nodes([]);
    return;
  }

  const clickedShape = e.target;
  const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;

  if (!metaPressed) {
    // Single select
    transformer.nodes([clickedShape]);
  } else {
    // Toggle in multi-selection
    const nodes = transformer.nodes().slice();
    if (nodes.includes(clickedShape)) {
      nodes.splice(nodes.indexOf(clickedShape), 1);
    } else {
      nodes.push(clickedShape);
    }
    transformer.nodes(nodes);
  }
});
```

## Bounding Box Constraints

```js
const tr = new Konva.Transformer({
  boundBoxFunc: (oldBox, newBox) => {
    // Minimum size
    if (newBox.width < 5 || newBox.height < 5) {
      return oldBox;
    }
    return newBox;
  },
});
```

## React Implementation Pattern

```jsx
const [selectedIds, setSelectedIds] = useState([]);
const trRef = useRef(null);

useEffect(() => {
  if (!trRef.current) return;
  const nodes = selectedIds
    .map((id) => stageRef.current.findOne(`#${id}`))
    .filter(Boolean);
  trRef.current.nodes(nodes);
  trRef.current.getLayer().batchDraw();
}, [selectedIds]);

// In JSX:
<Transformer ref={trRef} />
```
