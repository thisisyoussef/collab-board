// Canvas rendering helpers — pure functions for hit-testing, text display, and clipboard.
// Used by Board.tsx for viewport culling (intersects), sticky note placeholder logic,
// connector label sizing, and fallback clipboard copy for older browsers.
import type { Bounds } from '../types/board-canvas';
import {
  CONNECTOR_LABEL_CHAR_WIDTH_FACTOR,
  CONNECTOR_LABEL_FONT_SIZE,
  CONNECTOR_LABEL_PADDING_X,
  CONNECTOR_LABEL_PADDING_Y,
  RECT_CLICK_DEFAULT_HEIGHT,
  RECT_CLICK_DEFAULT_WIDTH,
  STICKY_PLACEHOLDER_TEXT,
} from './board-constants';
import { RECT_MIN_SIZE } from './board-object';

const BASELINE_VIEWPORT_WIDTH = 960;
const BASELINE_VIEWPORT_HEIGHT = 560;
const RECT_VIEWPORT_WIDTH_RATIO = RECT_CLICK_DEFAULT_WIDTH / BASELINE_VIEWPORT_WIDTH;
const RECT_VIEWPORT_HEIGHT_RATIO = RECT_CLICK_DEFAULT_HEIGHT / BASELINE_VIEWPORT_HEIGHT;

export interface ClickShapeDefaults {
  rectWidth: number;
  rectHeight: number;
  circleSize: number;
  lineWidth: number;
}

function normalizeViewportValue(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeScaleValue(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function toWorldSize(screenSize: number, scale: number): number {
  return Math.max(RECT_MIN_SIZE, Math.round(screenSize / scale));
}

export function getClickShapeDefaultsForViewport({
  viewportWidth,
  viewportHeight,
  scale,
}: {
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
}): ClickShapeDefaults {
  const safeScale = normalizeScaleValue(scale);
  const safeViewportWidth = normalizeViewportValue(viewportWidth, BASELINE_VIEWPORT_WIDTH);
  const safeViewportHeight = normalizeViewportValue(viewportHeight, BASELINE_VIEWPORT_HEIGHT);

  const rectScreenWidth = safeViewportWidth * RECT_VIEWPORT_WIDTH_RATIO;
  const rectScreenHeight = safeViewportHeight * RECT_VIEWPORT_HEIGHT_RATIO;
  const lineScreenWidth = safeViewportWidth * RECT_VIEWPORT_WIDTH_RATIO;
  const circleScreenSize = Math.min(rectScreenWidth, rectScreenHeight);

  const rectWidth = toWorldSize(rectScreenWidth, safeScale);
  const rectHeight = toWorldSize(rectScreenHeight, safeScale);
  const lineWidth = toWorldSize(lineScreenWidth, safeScale);
  const circleSize = toWorldSize(circleScreenSize, safeScale);

  return {
    rectWidth,
    rectHeight,
    circleSize,
    lineWidth,
  };
}

/** Axis-aligned bounding-box intersection test. */
export function intersects(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function isPlaceholderStickyText(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return value.trim().toLowerCase() === STICKY_PLACEHOLDER_TEXT.toLowerCase();
}

export function getStickyRenderText(value: string | undefined): string {
  return isPlaceholderStickyText(value) ? STICKY_PLACEHOLDER_TEXT : value || '';
}

export function getStickyRenderColor(value: string | undefined): string {
  return isPlaceholderStickyText(value) ? '#6b7280' : '#111827';
}

export function estimateConnectorLabelBounds(text: string): { width: number; height: number } {
  const length = Math.max(1, text.length);
  const estimatedTextWidth = Math.max(
    CONNECTOR_LABEL_FONT_SIZE,
    length * CONNECTOR_LABEL_FONT_SIZE * CONNECTOR_LABEL_CHAR_WIDTH_FACTOR,
  );
  return {
    width: estimatedTextWidth + CONNECTOR_LABEL_PADDING_X * 2,
    height: CONNECTOR_LABEL_FONT_SIZE + CONNECTOR_LABEL_PADDING_Y * 2,
  };
}

export function fallbackCopyToClipboard(value: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  textarea.remove();
  return copied;
}

export function buildBoardReturnToPath(boardId: string): string {
  if (typeof window !== 'undefined') {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath.startsWith('/board/')) {
      return currentPath;
    }
  }
  return `/board/${boardId}`;
}
