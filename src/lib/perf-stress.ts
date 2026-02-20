// Stress-test object generator for PRD capacity validation (500+ objects).
// Produces a BoardObjectsRecord that can be loaded onto a board to verify
// FPS, rendering, and sync performance at scale.

import type { BoardObjectType, BoardObjectsRecord } from '../types/board';
import { createDefaultObject } from './board-object';

const STRESS_TYPES: BoardObjectType[] = ['sticky', 'rect', 'circle'];

const DEFAULT_COLORS: Record<string, string> = {
  sticky: '#FFEB3B',
  rect: '#E3F2FD',
  circle: '#C8E6C9',
};

export interface StressOptions {
  /** Max canvas spread in pixels (default 5000). */
  spread?: number;
  /** Starting zIndex (default 1). */
  startZIndex?: number;
}

/**
 * Generate `count` board objects spread across a canvas area.
 *
 * Objects cycle through sticky → rect → circle types for visual variety.
 * Positions are deterministic (seeded from index) so tests are repeatable.
 */
export function generateStressObjects(
  count: number,
  opts: StressOptions = {},
): BoardObjectsRecord {
  const spread = opts.spread ?? 5000;
  const startZ = opts.startZIndex ?? 1;
  const record: BoardObjectsRecord = {};

  for (let i = 0; i < count; i++) {
    const type = STRESS_TYPES[i % STRESS_TYPES.length]!;
    const id = `stress-${i}`;

    // Deterministic positions based on index for repeatable tests.
    // Uses a simple grid-wrap: ~25 columns, spacing derived from spread.
    const cols = 25;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellW = spread / cols;
    const cellH = spread / cols;

    const obj = createDefaultObject(type, {
      id,
      x: col * cellW + 10,
      y: row * cellH + 10,
      color: DEFAULT_COLORS[type] ?? '#FFFFFF',
      createdBy: 'stress-test',
      zIndex: startZ + i,
    });

    record[id] = obj;
  }

  return record;
}
