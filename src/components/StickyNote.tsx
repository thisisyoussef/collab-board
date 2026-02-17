import React from 'react';
import { Group, Rect, Text } from 'react-konva';

interface StickyNoteProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize?: number;
  rotation?: number;
  onDragEnd?: (e: { target: { x: () => number; y: () => number } }) => void;
  onDblClick?: () => void;
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

/**
 * Memoized sticky note component — per vite-react-konva skill.
 * Custom comparator to avoid unnecessary re-renders.
 */
const StickyNote = React.memo(
  ({
    id,
    x,
    y,
    width,
    height,
    text,
    color,
    fontSize = 14,
    rotation = 0,
    onDragEnd,
    onDblClick,
    onClick,
    onTransformEnd,
  }: StickyNoteProps) => (
    <Group
      id={id}
      x={x}
      y={y}
      rotation={rotation}
      draggable
      onDragEnd={onDragEnd}
      onDblClick={onDblClick}
      onClick={onClick}
      onTransformEnd={onTransformEnd}
    >
      <Rect
        width={width}
        height={height}
        fill={color}
        cornerRadius={4}
        shadowBlur={4}
        shadowOpacity={0.2}
        shadowColor="#000"
        shadowOffsetY={2}
      />
      <Text
        text={text}
        width={width}
        height={height}
        padding={8}
        fontSize={fontSize}
        fill="#333"
        align="left"
        verticalAlign="top"
      />
    </Group>
  ),
  (prev, next) =>
    prev.x === next.x &&
    prev.y === next.y &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.text === next.text &&
    prev.color === next.color &&
    prev.rotation === next.rotation,
);

StickyNote.displayName = 'StickyNote';

export default StickyNote;
