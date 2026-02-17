# React-Konva Documentation

> Source: https://konvajs.org/docs/react/

## Overview

`react-konva` is a JavaScript library for drawing complex canvas graphics using React. It provides declarative and reactive bindings to the Konva Framework.

**Installation:**
```bash
npm install react-konva konva --save
```

**Limitation:** Not supported in React Native.

---

## Getting Started

All Konva nodes and shapes work as React components. Events use the same pattern as standard React events.

```jsx
import { Stage, Layer, Rect, Circle, Text } from 'react-konva';

const App = () => (
  <Stage width={window.innerWidth} height={window.innerHeight}>
    <Layer>
      <Text text="Try to drag shapes" fontSize={15} />
      <Rect x={20} y={50} width={100} height={100} fill="red" shadowBlur={10} draggable />
      <Circle x={200} y={100} radius={50} fill="green" draggable />
    </Layer>
  </Stage>
);
```

---

## Available Shapes

All `react-konva` components correspond to `Konva` components of the same name. All parameters available for Konva objects are valid props for the corresponding react-konva components.

**Core shapes:** `Rect`, `Circle`, `Ellipse`, `Line`, `Image`, `Text`, `TextPath`, `Star`, `Label`, `SVG Path`, `RegularPolygon`

```jsx
import { Stage, Layer, Rect, Text, Circle, Line } from 'react-konva';

const App = () => (
  <Stage width={window.innerWidth} height={window.innerHeight}>
    <Layer>
      <Text text="Some text on canvas" fontSize={15} />
      <Rect x={20} y={50} width={100} height={100} fill="red" shadowBlur={10} />
      <Circle x={200} y={100} radius={50} fill="green" />
      <Line
        x={20} y={200}
        points={[0, 0, 100, 0, 100, 100]}
        tension={0.5}
        closed
        stroke="black"
        fillLinearGradientStartPoint={{ x: -50, y: -50 }}
        fillLinearGradientEndPoint={{ x: 50, y: 50 }}
        fillLinearGradientColorStops={[0, 'red', 1, 'yellow']}
      />
    </Layer>
  </Stage>
);
```

---

## Events

Use the `onEventName` naming convention: `mousedown` → `onMouseDown`, `dragend` → `onDragEnd`.

**Available events:**
- Mouse: `mouseover`, `mouseout`, `mouseenter`, `mouseleave`, `mousemove`, `mousedown`, `mouseup`, `wheel`, `click`, `dblclick`
- Touch: `touchstart`, `touchmove`, `touchend`, `tap`, `dbltap`
- Pointer: `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `pointerover`, `pointerenter`, `pointerout`, `pointerleave`, `pointerclick`, `pointerdblclick`
- Drag: `dragstart`, `dragmove`, `dragend`
- Transform: `transformstart`, `transform`, `transformend`

```jsx
<Star
  draggable
  onDragStart={(e) => {
    // e.target is the Konva node
    const id = e.target.id();
    // update state...
  }}
  onDragEnd={(e) => {
    // finalize position
  }}
/>
```

Access pointer position: `stage.getPointerPosition()`

---

## Drag and Drop

Add `draggable` prop to enable drag-and-drop. Store positions in app state.

```jsx
const [position, setPosition] = useState({ x: 100, y: 100 });
const [isDragging, setIsDragging] = useState(false);

<Text
  x={position.x}
  y={position.y}
  draggable
  fill={isDragging ? 'green' : 'black'}
  onDragStart={() => setIsDragging(true)}
  onDragEnd={(e) => {
    setIsDragging(false);
    setPosition({ x: e.target.x(), y: e.target.y() });
  }}
/>
```

---

## Transformer (Select & Resize)

There is no pure declarative way to use Transformer. Use refs to manually attach.

```jsx
const Rectangle = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = React.useRef(null);
  const trRef = React.useRef(null);

  React.useEffect(() => {
    if (isSelected) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Rect
        ref={shapeRef}
        {...shapeProps}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};
```

**Key behavior:** Transformer changes `scaleX`/`scaleY`, NOT `width`/`height`. Reset scale to 1 and compute new dimensions in `onTransformEnd`.

**Selection patterns:**
- Click shape → select (show Transformer)
- Click empty area → deselect
- SHIFT/CTRL + click → multi-select
- Drag on empty area → rubber-band selection rect
- Use `Konva.Util.haveIntersection()` to detect shape overlap with selection rect

---

## Accessing Konva Nodes

### Method 1: Refs
```jsx
const shapeRef = React.useRef(null);
React.useEffect(() => {
  console.log(shapeRef.current); // Konva.Circle instance
});
<Circle ref={shapeRef} radius={50} fill="red" />
```

### Method 2: Event target
```jsx
const handleClick = (e) => {
  console.log(e.target); // Konva.Circle instance
};
<Circle onClick={handleClick} radius={50} fill="red" />
```

---

## Free Drawing

```jsx
const [lines, setLines] = useState([]);
const isDrawing = useRef(false);

const handleMouseDown = (e) => {
  isDrawing.current = true;
  const pos = e.target.getStage().getPointerPosition();
  setLines([...lines, { points: [pos.x, pos.y] }]);
};

const handleMouseMove = (e) => {
  if (!isDrawing.current) return;
  const stage = e.target.getStage();
  const point = stage.getPointerPosition();
  let lastLine = lines[lines.length - 1];
  lastLine.points = lastLine.points.concat([point.x, point.y]);
  lines.splice(lines.length - 1, 1, lastLine);
  setLines(lines.concat());
};

const handleMouseUp = () => { isDrawing.current = false; };

// Render lines:
{lines.map((line, i) => (
  <Line key={i} points={line.points} stroke="#df4b26" strokeWidth={5}
    tension={0.5} lineCap="round" lineJoin="round"
    globalCompositeOperation={tool === 'eraser' ? 'destination-out' : 'source-over'}
  />
))}
```

**Performance note:** Gets slower with hundreds/thousands of lines. Optimize for whiteboard use.

---

## Undo/Redo

Track a history of state changes. No need for Konva serialization.

```jsx
const history = useRef([initialState]);
const historyStep = useRef(0);

const handleUndo = () => {
  if (historyStep.current === 0) return;
  historyStep.current -= 1;
  const previous = history.current[historyStep.current];
  // apply previous state
};

const handleRedo = () => {
  if (historyStep.current === history.current.length - 1) return;
  historyStep.current += 1;
  const next = history.current[historyStep.current];
  // apply next state
};

const handleChange = (newState) => {
  // Remove future states after current step
  history.current = history.current.slice(0, historyStep.current + 1);
  history.current = history.current.concat([newState]);
  historyStep.current += 1;
};
```

---

## zIndex / Ordering

**Don't use `zIndex` for react-konva components.** React-konva strictly follows the order of nodes as described in your JSX.

Instead, manage ordering through state:

```jsx
const handleDragStart = (e) => {
  const id = e.target.id();
  // Move dragged item to end of array (renders on top)
  setItems((prev) => {
    const item = prev.find((i) => i.id === id);
    return [...prev.filter((i) => i.id !== id), item];
  });
};
```

---

## Images

Use the `use-image` hook:

```jsx
import { Image } from 'react-konva';
import useImage from 'use-image';

const URLImage = ({ src, ...rest }) => {
  const [image] = useImage(src, 'anonymous');
  return <Image image={image} {...rest} />;
};
```

---

## Custom Shapes

Use the `Shape` component with `sceneFunc`:

```jsx
import { Shape } from 'react-konva';

<Shape
  sceneFunc={(context, shape) => {
    context.beginPath();
    context.moveTo(20, 50);
    context.lineTo(220, 80);
    context.quadraticCurveTo(150, 100, 260, 170);
    context.closePath();
    context.fillStrokeShape(shape);
  }}
  fill="#00D2FF"
  stroke="black"
  strokeWidth={4}
/>
```

---

## Canvas Export

```jsx
const stageRef = React.useRef(null);

const handleExport = () => {
  const uri = stageRef.current.toDataURL();
  // Download helper:
  const link = document.createElement('a');
  link.download = 'stage.png';
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

<Stage ref={stageRef} width={500} height={500}>
  {/* ... */}
</Stage>
```

---

## DOM Portal

Use `<Html />` from `react-konva-utils` to embed DOM elements in canvas:

```jsx
import { Html } from 'react-konva-utils';

<Layer>
  <Html>
    <input type="text" style={{ width: 200 }} />
  </Html>
  <Rect x={200} y={0} width={100} height={100} fill="red" />
</Layer>
```

**Note:** HTML content will NOT be visible when exporting canvas as image.
