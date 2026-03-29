import { describe, expect, it } from 'vitest';
import { computeFollowStagePosition } from './presenter-follow';

describe('computeFollowStagePosition', () => {
  it('centers the target cursor when scale is 1', () => {
    const position = computeFollowStagePosition({
      cursorWorldX: 300,
      cursorWorldY: 240,
      viewportWidth: 1200,
      viewportHeight: 800,
      scale: 1,
    });

    expect(position).toEqual({
      x: 300,
      y: 160,
    });
  });

  it('accounts for zoom scale when centering', () => {
    const position = computeFollowStagePosition({
      cursorWorldX: 400,
      cursorWorldY: 250,
      viewportWidth: 1000,
      viewportHeight: 700,
      scale: 2,
    });

    expect(position).toEqual({
      x: -300,
      y: -150,
    });
  });

  it('returns null for invalid numeric input', () => {
    const position = computeFollowStagePosition({
      cursorWorldX: Number.NaN,
      cursorWorldY: 50,
      viewportWidth: 800,
      viewportHeight: 600,
      scale: 1,
    });

    expect(position).toBeNull();
  });
});
