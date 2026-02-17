import React from 'react';
import { Group, Line, Rect, Text } from 'react-konva';

interface RemoteCursorProps {
  x: number;
  y: number;
  color: string;
  name: string;
}

/**
 * Memoized Konva cursor component — arrow + colored name label.
 * Rendered on the Cursors layer (listening={false}).
 */
const RemoteCursor = React.memo(
  ({ x, y, color, name }: RemoteCursorProps) => (
    <Group x={x} y={y}>
      {/* Cursor arrow */}
      <Line
        points={[0, 0, 0, 16, 4, 12, 8, 16]}
        fill={color}
        closed
        stroke={color}
        strokeWidth={1}
      />
      {/* Name label */}
      <Group x={10} y={16}>
        <Rect
          width={Math.max(name.length * 7 + 8, 30)}
          height={18}
          fill={color}
          cornerRadius={3}
        />
        <Text
          text={name}
          fontSize={11}
          fill="#fff"
          padding={4}
          width={Math.max(name.length * 7 + 8, 30)}
        />
      </Group>
    </Group>
  ),
  (prev, next) =>
    prev.x === next.x &&
    prev.y === next.y &&
    prev.color === next.color &&
    prev.name === next.name,
);

RemoteCursor.displayName = 'RemoteCursor';

export default RemoteCursor;
