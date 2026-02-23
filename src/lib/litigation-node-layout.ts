import {
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_WIDTH,
  STICKY_MIN_HEIGHT,
  STICKY_MIN_WIDTH,
} from './board-object';

const STICKY_MIN_FONT_SIZE = 10;
const STICKY_DEFAULT_FONT_SIZE = 14;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizePositiveScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface StickyResizeStateInput {
  width: number;
  height: number;
  fontSize?: number;
  scaleX: number;
  scaleY: number;
}

export interface StickyResizeState {
  width: number;
  height: number;
  fontSize: number;
}

/**
 * Computes sticky-node size + typography after a Konva transform.
 * Keeps text scaling deterministic using the same transform factor as geometry.
 */
export function computeStickyResizeState(input: StickyResizeStateInput): StickyResizeState {
  const safeScaleX = normalizePositiveScale(input.scaleX);
  const safeScaleY = normalizePositiveScale(input.scaleY);
  const baseFontSize =
    Number.isFinite(input.fontSize) && (input.fontSize || 0) > 0
      ? Number(input.fontSize)
      : STICKY_DEFAULT_FONT_SIZE;

  return {
    width: Math.max(STICKY_MIN_WIDTH, roundToHundredths(input.width * safeScaleX)),
    height: Math.max(STICKY_MIN_HEIGHT, roundToHundredths(input.height * safeScaleY)),
    fontSize: Math.max(
      STICKY_MIN_FONT_SIZE,
      roundToHundredths(baseFontSize * Math.min(safeScaleX, safeScaleY)),
    ),
  };
}

function getDecorationScale(width: number, height: number): number {
  const widthScale = width / STICKY_DEFAULT_WIDTH;
  const heightScale = height / STICKY_DEFAULT_HEIGHT;
  return clamp(Math.min(widthScale, heightScale), 0.7, 2.2);
}

export interface LegalStickyDecorationMetrics {
  stripeWidth: number;
  stripeCornerRadius: number;
  badgeFontSize: number;
  badgeHeight: number;
  badgeInset: number;
  badgePaddingX: number;
  badgeTextOffsetY: number;
}

/**
 * Returns proportional badge + stripe dimensions for legal sticky nodes.
 */
export function computeLegalStickyDecorationMetrics({
  width,
  height,
}: {
  width: number;
  height: number;
}): LegalStickyDecorationMetrics {
  const scale = getDecorationScale(width, height);
  const badgeFontSize = clamp(Math.round(9 * scale), 8, 18);
  const badgeHeight = clamp(Math.round(16 * scale), 14, 32);
  const badgePaddingX = clamp(Math.round(5 * scale), 4, 12);

  return {
    stripeWidth: clamp(Math.round(4 * scale), 3, 10),
    stripeCornerRadius: clamp(Math.round(4 * scale), 3, 10),
    badgeFontSize,
    badgeHeight,
    badgeInset: clamp(Math.round(6 * scale), 4, 14),
    badgePaddingX,
    badgeTextOffsetY: Math.max(2, Math.round((badgeHeight - badgeFontSize) / 2) - 1),
  };
}
