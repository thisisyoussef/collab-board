interface FollowStagePositionInput {
  cursorWorldX: number;
  cursorWorldY: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
}

export function computeFollowStagePosition(input: FollowStagePositionInput): { x: number; y: number } | null {
  const { cursorWorldX, cursorWorldY, viewportWidth, viewportHeight, scale } = input;
  if (
    !Number.isFinite(cursorWorldX) ||
    !Number.isFinite(cursorWorldY) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(scale) ||
    scale <= 0
  ) {
    return null;
  }

  return {
    x: viewportWidth / 2 - cursorWorldX * scale,
    y: viewportHeight / 2 - cursorWorldY * scale,
  };
}
