import React from 'react';
import { Group, Rect } from 'react-konva';

interface ShapeRectProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  rotation?: number;
  onDragEnd?: (e: { target: { x: () => number; y: () => number } }) => void;
  onClick?: () => void;
  onTransformEnd?: (e: {
    target: {
      x: () => number;
      y: () => number;
      scaleX: () => number;
      scaleY: () => number;
      rotation: () => number;
      width: () => number;
      height: () => number;
    };
  }) => void;
}

const ShapeRect = React.memo(
  ({
    id,
    x,
    y,
    width,
    height,
    color,
    rotation = 0,
    onDragEnd,
    onClick,
    onTransformEnd,
  }: ShapeRectProps) => (
    <Group
      id={id}
      x={x}
      y={y}
      rotation={rotation}
      draggable
      onDragEnd={onDragEnd}
      onClick={onClick}
      onTransformEnd={onTransformEnd}
    >
      <Rect
        width={width}
        height={height}
        fill={color}
        stroke="#bbb"
        strokeWidth={1}
        cornerRadius={2}
      />
    </Group>
  ),
  (prev, next) =>
    prev.x === next.x &&
    prev.y === next.y &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.color === next.color &&
    prev.rotation === next.rotation,
);

ShapeRect.displayName = 'ShapeRect';

export default ShapeRect;
