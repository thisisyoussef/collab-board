import { Circle } from 'react-konva';

interface BackgroundProps {
  stageWidth: number;
  stageHeight: number;
  stageX: number;
  stageY: number;
  scale: number;
}

/**
 * Dot grid pattern on Background layer (listening=false).
 * Generates dots visible in the current viewport.
 */
export function Background({ stageWidth, stageHeight, stageX, stageY, scale }: BackgroundProps) {
  const spacing = 40;

  // Calculate visible world bounds
  const startX = Math.floor((-stageX / scale) / spacing) * spacing - spacing;
  const startY = Math.floor((-stageY / scale) / spacing) * spacing - spacing;
  const endX = startX + (stageWidth / scale) + spacing * 2;
  const endY = startY + (stageHeight / scale) + spacing * 2;

  const dots: { x: number; y: number; key: string }[] = [];
  for (let x = startX; x <= endX; x += spacing) {
    for (let y = startY; y <= endY; y += spacing) {
      dots.push({ x, y, key: `${x}-${y}` });
    }
  }

  return (
    <>
      {dots.map((dot) => (
        <Circle
          key={dot.key}
          x={dot.x}
          y={dot.y}
          radius={1.5 / scale}
          fill="#ccc"
          listening={false}
        />
      ))}
    </>
  );
}
