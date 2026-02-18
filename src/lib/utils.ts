export function generateColor(userId: string): string {
  const source = userId || 'guest';
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = source.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function getInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    return '??';
  }

  if (cleaned.includes('@')) {
    const localPart = cleaned.split('@')[0] || cleaned;
    return localPart.slice(0, 2).toUpperCase();
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
}

interface StageTransform {
  x: () => number;
  y: () => number;
  scaleX: () => number;
}

export function screenToWorld(
  stage: StageTransform,
  screenPos: { x: number; y: number },
): { x: number; y: number } {
  const scale = stage.scaleX() || 1;
  return {
    x: (screenPos.x - stage.x()) / scale,
    y: (screenPos.y - stage.y()) / scale,
  };
}

export function worldToScreen(
  stage: StageTransform,
  worldPos: { x: number; y: number },
): { x: number; y: number } {
  const scale = stage.scaleX() || 1;
  return {
    x: worldPos.x * scale + stage.x(),
    y: worldPos.y * scale + stage.y(),
  };
}
