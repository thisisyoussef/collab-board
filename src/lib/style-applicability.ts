import type { BoardObjectType } from '../types/board';

export type StyleProperty = 'fillColor' | 'strokeColor' | 'strokeWidth' | 'fontSize';

const APPLICABILITY: Record<StyleProperty, Set<BoardObjectType>> = {
  fillColor: new Set(['sticky', 'rect', 'circle', 'text', 'frame']),
  strokeColor: new Set(['rect', 'circle', 'line', 'frame', 'connector']),
  strokeWidth: new Set(['rect', 'circle', 'line', 'frame', 'connector']),
  fontSize: new Set(['sticky', 'text']),
};

/** Returns true when the property applies to a single object type. */
export function isApplicable(property: StyleProperty, type: BoardObjectType): boolean {
  return APPLICABILITY[property].has(type);
}

/**
 * Returns true when the property applies to ALL types in the array.
 * Used for multi-select: only show control if every selected type supports it.
 */
export function isApplicableToAll(property: StyleProperty, types: BoardObjectType[]): boolean {
  if (types.length === 0) return false;
  return types.every((t) => APPLICABILITY[property].has(t));
}

/** 12 preset color swatches for the color picker. */
export const COLOR_SWATCHES = [
  '#FFEB3B', '#FF9800', '#F44336', '#E91E63',
  '#9C27B0', '#3F51B5', '#2196F3', '#00BCD4',
  '#4CAF50', '#8BC34A', '#795548', '#607D8B',
] as const;
