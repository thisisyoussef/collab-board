# Konva API Reference

> Source: https://konvajs.org/api/

## Architecture Overview

Konva uses a hierarchical node structure:
- **Stage** → root container, holds layers
- **Layer** → each has its own canvas element + hit graph canvas for event detection
- **Group** → logical grouping of shapes
- **Shape** → visual elements (Rect, Circle, Text, Line, etc.)

Built-in shapes: Rect, Circle, Ellipse, Line, Polygon, Spline, Blob, Image, Text, TextPath, Star, Label, SVG Path, RegularPolygon, Arrow.

---

## Konva.Stage

```js
const stage = new Konva.Stage({ container: 'container-id', width: 800, height: 600 });
```

### Key Config
| Param | Type | Description |
|-------|------|-------------|
| container | String/Element | DOM element for the stage |
| width, height | Number | Stage dimensions |
| draggable | Boolean | Enable stage panning |
| listening | Boolean | Enable event detection |
| scale, scaleX, scaleY | Number | Zoom level |

### Key Methods
| Method | Description |
|--------|-------------|
| `getPointerPosition()` | Absolute pointer coords (mouse/touch) |
| `getIntersection(pos)` | Shape at position (hit detection) |
| `getLayers()` | Array of layers |
| `batchDraw()` | Batch render (optimized) |
| `clear()` | Remove all layers |
| `toDataURL(config)` | Export as base64 image |
| `toJSON()` | Serialize to JSON |
| `find(selector)` | Query nodes: `'#id'`, `'.name'`, `'Type'` |
| `findOne(selector)` | First matching node |

---

## Konva.Layer

```js
const layer = new Konva.Layer({ listening: false, clearBeforeDraw: true });
stage.add(layer);
```

### Key Config
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| clearBeforeDraw | Boolean | true | Clear canvas before each draw |
| listening | Boolean | true | Enable event detection |
| imageSmoothingEnabled | Boolean | true | Anti-aliasing |

### Key Methods
| Method | Description |
|--------|-------------|
| `batchDraw()` | Schedule draw on next animation frame |
| `getCanvas()` | Canvas wrapper |
| `getNativeCanvasElement()` | Raw HTML canvas |
| `getHitCanvas()` | Hit detection canvas |
| `getContext()` | Canvas 2d context |
| `getIntersection(pos)` | Shape at position |
| `add(children)` | Add shapes/groups |
| `destroyChildren()` | Remove and destroy all children |

---

## Konva.Group

```js
const group = new Konva.Group({ x: 100, y: 100, draggable: true });
```

Container for shapes. Supports all transform properties (x, y, rotation, scale, offset, opacity). Children inherit parent transforms.

### Key Methods
| Method | Description |
|--------|-------------|
| `add(children)` | Add child nodes |
| `getChildren(filter)` | Direct descendants |
| `find(selector)` | Query descendants |
| `findOne(selector)` | First match |
| `destroyChildren()` | Destroy all children |
| `moveTo(container)` | Move to different parent |
| `cache()` | Cache to bitmap for performance |

---

## Konva.Rect

```js
const rect = new Konva.Rect({
  x: 10, y: 10, width: 100, height: 50,
  fill: 'red', stroke: 'black', strokeWidth: 2,
  cornerRadius: 5, // or [tl, tr, br, bl]
  draggable: true,
});
```

### Own Methods
- `cornerRadius(val)` — get/set corner radius (Number or Array of 4)

---

## Konva.Circle

```js
const circle = new Konva.Circle({
  x: 100, y: 100, radius: 50,
  fill: 'green', stroke: 'black',
});
```

### Own Methods
- `radius(val)` — get/set radius

---

## Konva.Text

```js
const text = new Konva.Text({
  x: 10, y: 10, text: 'Hello World',
  fontSize: 20, fontFamily: 'Arial', fontStyle: 'bold',
  fill: 'black', width: 200,
  align: 'center', verticalAlign: 'middle',
  wrap: 'word', ellipsis: true,
  padding: 10, lineHeight: 1.5,
  letterSpacing: 2, textDecoration: 'underline',
});
```

### Key Config
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| text | String | | Content to display |
| fontSize | Number | 12 | Font size in pixels |
| fontFamily | String | Arial | Font name |
| fontStyle | String | normal | `'normal'`, `'italic'`, `'bold'`, `'italic bold'` |
| fontVariant | String | normal | `'normal'` or `'small-caps'` |
| align | String | left | `'left'`, `'center'`, `'right'`, `'justify'` |
| verticalAlign | String | top | `'top'`, `'middle'`, `'bottom'` |
| wrap | String | word | `'word'`, `'char'`, `'none'` |
| ellipsis | Boolean | false | Add `...` when text overflows |
| padding | Number | 0 | Internal padding |
| lineHeight | Number | 1 | Line spacing |
| letterSpacing | Number | 0 | Character spacing |
| textDecoration | String | | `'underline'`, `'line-through'`, or both |

### Own Methods
- `text(val)` — get/set text content
- `getTextWidth()` — pure text width (no padding)
- `measureSize(text)` — measure text dimensions
- `width(val)` — supports `'auto'`
- `height(val)` — supports `'auto'`

---

## Konva.Line

```js
const line = new Konva.Line({
  points: [10, 10, 100, 50, 200, 10],
  stroke: 'red', strokeWidth: 3,
  tension: 0.5,    // 0 = straight, higher = more curved
  closed: false,   // true = polygon
  bezier: false,   // true = bezier instead of tension
  lineCap: 'round', lineJoin: 'round',
});
```

### Own Methods
- `points(arr)` — get/set flat points array `[x1, y1, x2, y2, ...]`
- `tension(val)` — curvature (0 = straight)
- `closed(bool)` — close the path (polygon)
- `bezier(bool)` — use bezier interpolation

---

## Konva.Arrow

Extends `Konva.Line` with arrowheads.

```js
const arrow = new Konva.Arrow({
  points: [10, 10, 200, 100],
  pointerLength: 10, pointerWidth: 10,
  pointerAtBeginning: false, pointerAtEnding: true,
  fill: 'black', stroke: 'black', strokeWidth: 2,
});
```

### Own Methods
- `pointerLength(val)` — arrow tip length (default: 10)
- `pointerWidth(val)` — arrow tip width (default: 10)
- `pointerAtBeginning(bool)` — show arrow at start
- `pointerAtEnding(bool)` — show arrow at end

---

## Konva.Image

```js
// From URL (static method):
Konva.Image.fromURL('/image.png', (img) => {
  img.setAttrs({ x: 10, y: 10, width: 200, height: 150 });
  layer.add(img);
  layer.batchDraw();
});

// From Image element:
const imageObj = new window.Image();
imageObj.onload = () => {
  const konvaImg = new Konva.Image({
    image: imageObj, x: 0, y: 0, width: 200, height: 150,
  });
  layer.add(konvaImg);
};
imageObj.src = '/image.png';
```

### Own Methods
- `image(img)` — get/set image source (Image, Canvas, or Video element)
- `crop({ x, y, width, height })` — get/set crop region
- `cropX()`, `cropY()`, `cropWidth()`, `cropHeight()` — individual crop accessors
- `cornerRadius(val)` — rounded corners

---

## Konva.Transformer

```js
const tr = new Konva.Transformer({
  nodes: [rect1, rect2],
  keepRatio: true,
  boundBoxFunc: (oldBox, newBox) => {
    if (newBox.width < 5 || newBox.height < 5) return oldBox;
    return newBox;
  },
});
layer.add(tr);
```

### Key Config
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| resizeEnabled | Boolean | true | Allow resizing |
| rotateEnabled | Boolean | true | Allow rotation |
| rotateLineVisible | Boolean | true | Show line to rotation handle |
| rotationSnaps | Array | [] | Snap-to angles |
| rotationSnapTolerance | Number | 5 | Snap threshold |
| rotateAnchorOffset | Number | 50 | Distance of rotation handle |
| padding | Number | 0 | Space around nodes |
| borderEnabled | Boolean | true | Show border |
| borderStroke | String | | Border color |
| borderStrokeWidth | Number | | Border width |
| borderDash | Array | | Dashed border |
| anchorFill | String | | Handle fill |
| anchorStroke | String | | Handle stroke |
| anchorSize | Number | 10 | Handle size |
| anchorCornerRadius | String | | Handle corner radius |
| keepRatio | Boolean | true | Maintain aspect ratio |
| centeredScaling | Boolean | false | Scale from center |
| enabledAnchors | Array | all | Which handles to show |
| flipEnabled | Boolean | true | Allow flipping |
| ignoreStroke | Boolean | false | Exclude stroke from size |
| boundBoxFunc | Function | | Constrain resize |
| shouldOverdrawWholeArea | Boolean | false | Drag from empty space |

### Key Methods
| Method | Description |
|--------|-------------|
| `nodes([shapes])` | Get/set attached nodes |
| `detach()` | Remove from node |
| `forceUpdate()` | Refresh after node changes |
| `isTransforming()` | Check if actively transforming |
| `stopTransform()` | Cancel ongoing transform |
| `getActiveAnchor()` | Current handle name or null |

### Events
- `transformstart`, `transform`, `transformend`

**Important:** Transformer changes `scaleX`/`scaleY`, NOT `width`/`height`. Reset scale and compute new dimensions manually.

---

## Common Node Methods (inherited by all)

### Positioning & Transform
```js
node.x(100); node.y(200);
node.position({ x: 100, y: 200 });
node.absolutePosition({ x: 300, y: 400 });
node.move({ x: 10, y: 5 }); // relative
node.rotation(45); // degrees
node.rotate(10);   // relative
node.scale({ x: 2, y: 2 });
node.scaleX(2); node.scaleY(2);
node.offset({ x: 50, y: 50 }); // rotation/scale center
node.getAbsolutePosition();
node.getAbsoluteTransform();
node.getAbsoluteScale();
node.getRelativePointerPosition();
```

### Events
```js
node.on('click', (e) => { /* e.target */ });
node.on('mousedown mousemove mouseup', handler);
node.off('click');
node.fire('click', { evt: {} }, true); // bubble
```

### Style
```js
node.fill('red');
node.stroke('black');
node.strokeWidth(2);
node.opacity(0.5);
node.visible(true);
node.listening(false); // disable hit detection
node.dash([10, 5]);
node.shadowColor('black');
node.shadowBlur(10);
node.shadowOffset({ x: 5, y: 5 });
node.shadowOpacity(0.5);
```

### Querying
```js
stage.find('#myId');       // by id
stage.find('.myName');     // by name
stage.find('Rect');        // by type
stage.findOne('#myId');    // first match
node.getParent();
node.getLayer();
node.getStage();
```

### Lifecycle
```js
node.remove();   // detach (reusable)
node.destroy();  // permanent removal
node.clone();    // deep copy
node.moveTo(otherContainer);
```

### Performance
```js
node.cache();        // render to bitmap
node.clearCache();
layer.batchDraw();   // schedule draw on next RAF
layer.listening(false); // disable hit graph
shape.perfectDrawEnabled(false); // skip extra compositing
```

### Export
```js
node.toDataURL({ pixelRatio: 2 });
node.toImage({ callback: (img) => {} });
node.toBlob({ callback: (blob) => {} });
node.toJSON();
node.toObject();
```

---

## Performance Tips

1. **Minimize layers** — each is a separate canvas element
2. **`listening: false`** on layers/shapes that don't need events
3. **`cache()`** complex shapes/groups to bitmap
4. **`batchDraw()`** instead of `draw()` — batches to next RAF
5. **`perfectDrawEnabled(false)`** — skip extra fill+stroke compositing
6. **Move shapes to dedicated layer during drag** — avoids redrawing main layer
7. **Hide/remove offscreen objects** — reduce existence cost
8. **`Konva.pixelRatio = 1`** on retina — reduces scaling work
9. **Avoid large stages** — more pixels = more memory-to-screen transfer

---

## Data & Serialization Best Practices

**Don't serialize Konva nodes.** Store minimal app state, reconstruct canvas from state.

```js
// GOOD: Store only essential data
const state = [
  { id: '1', type: 'rect', x: 10, y: 10, width: 100, height: 50, fill: 'red' },
  { id: '2', type: 'circle', x: 200, y: 100, radius: 30, fill: 'blue' },
];

// Reconstruct canvas from state
function renderBoard(layer, objects) {
  layer.destroyChildren();
  objects.forEach((obj) => {
    const shape = createShape(obj); // your factory function
    layer.add(shape);
  });
  layer.batchDraw();
}
```

For undo/redo: maintain history array of JSON-stringified state snapshots.
