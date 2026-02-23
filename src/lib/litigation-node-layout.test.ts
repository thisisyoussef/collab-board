import { describe, expect, it } from 'vitest';
import {
  computeLegalStickyDecorationMetrics,
  computeStickyResizeState,
} from './litigation-node-layout';

describe('computeStickyResizeState', () => {
  it('scales sticky geometry and text proportionally', () => {
    const next = computeStickyResizeState({
      width: 150,
      height: 100,
      fontSize: 14,
      scaleX: 1.5,
      scaleY: 1.5,
    });

    expect(next).toEqual({
      width: 225,
      height: 150,
      fontSize: 21,
    });
  });

  it('clamps sticky geometry and font to minimums', () => {
    const next = computeStickyResizeState({
      width: 70,
      height: 42,
      fontSize: 12,
      scaleX: 0.3,
      scaleY: 0.2,
    });

    expect(next.width).toBe(48);
    expect(next.height).toBe(36);
    expect(next.fontSize).toBe(10);
  });
});

describe('computeLegalStickyDecorationMetrics', () => {
  it('returns baseline metrics at default sticky size', () => {
    const metrics = computeLegalStickyDecorationMetrics({
      width: 150,
      height: 100,
    });

    expect(metrics).toEqual({
      stripeWidth: 4,
      stripeCornerRadius: 4,
      badgeFontSize: 9,
      badgeHeight: 16,
      badgeInset: 6,
      badgePaddingX: 5,
      badgeTextOffsetY: 3,
    });
  });

  it('scales badge and stripe metrics up for larger legal nodes', () => {
    const metrics = computeLegalStickyDecorationMetrics({
      width: 300,
      height: 200,
    });

    expect(metrics.stripeWidth).toBeGreaterThan(4);
    expect(metrics.badgeFontSize).toBeGreaterThan(9);
    expect(metrics.badgeHeight).toBeGreaterThan(16);
    expect(metrics.badgePaddingX).toBeGreaterThan(5);
  });
});
