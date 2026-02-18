import { useEffect, useMemo, useState } from 'react';
import { Group, Layer, Line, Rect, Text } from 'react-konva';
import type { RemoteCursor } from '../hooks/useCursors';

const INTERPOLATION_FACTOR = 0.35;
const SNAP_THRESHOLD = 0.5;
const NAME_MAX_LENGTH = 12;

interface AnimatedCursor extends RemoteCursor {
  renderX: number;
  renderY: number;
  targetX: number;
  targetY: number;
}

interface RemoteCursorsProps {
  cursors: RemoteCursor[];
}

function clampName(displayName: string): string {
  const trimmed = displayName.trim() || 'Unknown';
  return trimmed.length > NAME_MAX_LENGTH ? `${trimmed.slice(0, NAME_MAX_LENGTH)}…` : trimmed;
}

export function RemoteCursors({ cursors }: RemoteCursorsProps) {
  const [animatedBySocketId, setAnimatedBySocketId] = useState<Record<string, AnimatedCursor>>({});

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setAnimatedBySocketId((previous) => {
        const next: Record<string, AnimatedCursor> = {};

        cursors.forEach((cursor) => {
          const existing = previous[cursor.socketId];
          next[cursor.socketId] = existing
            ? {
                ...existing,
                userId: cursor.userId,
                displayName: cursor.displayName,
                color: cursor.color,
                targetX: cursor.x,
                targetY: cursor.y,
              }
            : {
                ...cursor,
                renderX: cursor.x,
                renderY: cursor.y,
                targetX: cursor.x,
                targetY: cursor.y,
              };
        });

        return next;
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [cursors]);

  const hasAnimatedCursors = useMemo(
    () => Object.keys(animatedBySocketId).length > 0,
    [animatedBySocketId],
  );

  useEffect(() => {
    if (!hasAnimatedCursors) {
      return;
    }

    let frameId = 0;

    const animate = () => {
      setAnimatedBySocketId((previous) => {
        let changed = false;
        const next: Record<string, AnimatedCursor> = {};

        Object.entries(previous).forEach(([socketId, cursor]) => {
          const nextX =
            Math.abs(cursor.targetX - cursor.renderX) <= SNAP_THRESHOLD
              ? cursor.targetX
              : cursor.renderX + (cursor.targetX - cursor.renderX) * INTERPOLATION_FACTOR;
          const nextY =
            Math.abs(cursor.targetY - cursor.renderY) <= SNAP_THRESHOLD
              ? cursor.targetY
              : cursor.renderY + (cursor.targetY - cursor.renderY) * INTERPOLATION_FACTOR;

          if (nextX !== cursor.renderX || nextY !== cursor.renderY) {
            changed = true;
          }

          next[socketId] = {
            ...cursor,
            renderX: nextX,
            renderY: nextY,
          };
        });

        return changed ? next : previous;
      });

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [hasAnimatedCursors]);

  const cursorsToRender = useMemo(
    () => Object.values(animatedBySocketId),
    [animatedBySocketId],
  );

  return (
    <Layer listening={false} name="remote-cursors-layer">
      {cursorsToRender.map((cursor) => {
        const label = clampName(cursor.displayName);
        const labelWidth = Math.max(44, label.length * 7 + 12);

        return (
          <Group key={cursor.socketId} x={cursor.renderX} y={cursor.renderY}>
            <Line
              points={[0, 0, 0, 16, 5, 12, 8, 22, 11, 21, 8, 12, 16, 12]}
              closed
              fill={cursor.color}
              stroke="#ffffff"
              strokeWidth={1}
              shadowBlur={4}
              shadowColor="rgba(15, 23, 42, 0.35)"
            />
            <Rect
              x={10}
              y={16}
              width={labelWidth}
              height={18}
              cornerRadius={4}
              fill={cursor.color}
              opacity={0.92}
            />
            <Text
              x={15}
              y={20}
              text={label}
              fill="#ffffff"
              fontSize={11}
              fontStyle="bold"
            />
          </Group>
        );
      })}
    </Layer>
  );
}
