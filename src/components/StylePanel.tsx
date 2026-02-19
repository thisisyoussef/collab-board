import type { BoardObject } from '../types/board';
import { isApplicableToAll } from '../lib/style-applicability';
import { safeColor } from '../lib/color-utils';
import { ColorPicker } from './ColorPicker';

export interface StylePanelProps {
  selectedObjects: BoardObject[];
  disabled?: boolean;
  onStyleChange: (ids: string[], patch: Partial<BoardObject>) => void;
}

/**
 * For stroke color: connectors and lines store it in `color`, shapes use `stroke`.
 * Returns the correct field value for the "stroke color" concept.
 */
function getStrokeColorValue(obj: BoardObject): string {
  if (obj.type === 'connector' || obj.type === 'line') {
    return safeColor(obj.color, '#64748b');
  }
  return safeColor(obj.stroke, '#334155');
}

/**
 * For stroke color changes: connectors and lines use `{ color }`, shapes use `{ stroke }`.
 * When multi-selecting mixed types, we need per-type patches — but since the batch handler
 * in Board.tsx iterates per object, we emit the patch that applies to ALL selected.
 * If all selected are line/connector, emit { color }. If all are shapes, emit { stroke }.
 * Mixed case shouldn't happen because isApplicableToAll would hide the control for
 * incompatible combos like sticky + line (sticky doesn't support strokeColor).
 * For combos like rect + connector (both support stroke), we need to handle it in Board.tsx.
 * The simplest approach: always check the object type in the batch handler.
 * Here we just flag which field to use based on whether any are line/connector.
 */
function buildStrokeColorPatch(
  objects: BoardObject[],
  color: string,
): Partial<BoardObject> {
  const hasLineOrConnector = objects.some(
    (o) => o.type === 'line' || o.type === 'connector',
  );
  const hasShape = objects.some(
    (o) => o.type === 'rect' || o.type === 'circle' || o.type === 'frame',
  );

  // If mixed (e.g. rect + connector), set both fields so Board.tsx can route correctly
  if (hasLineOrConnector && hasShape) {
    return { color, stroke: color };
  }
  if (hasLineOrConnector) {
    return { color };
  }
  return { stroke: color };
}

function getSharedValue<T>(objects: BoardObject[], getter: (obj: BoardObject) => T): T | null {
  if (objects.length === 0) return null;
  const first = getter(objects[0]);
  for (let i = 1; i < objects.length; i++) {
    if (getter(objects[i]) !== first) return null;
  }
  return first;
}

export function StylePanel({ selectedObjects, disabled, onStyleChange }: StylePanelProps) {
  if (selectedObjects.length === 0) return null;

  const types = selectedObjects.map((o) => o.type);
  const ids = selectedObjects.map((o) => o.id);

  const showFill = isApplicableToAll('fillColor', types);
  const showStroke = isApplicableToAll('strokeColor', types);
  const showStrokeWidth = isApplicableToAll('strokeWidth', types);
  const showFontSize = isApplicableToAll('fontSize', types);

  // Shared values (null = mixed)
  const sharedFillColor = showFill
    ? getSharedValue(selectedObjects, (o) => safeColor(o.color))
    : null;
  const sharedStrokeColor = showStroke
    ? getSharedValue(selectedObjects, getStrokeColorValue)
    : null;
  const sharedStrokeWidth = showStrokeWidth
    ? getSharedValue(selectedObjects, (o) => o.strokeWidth ?? 2)
    : null;
  const sharedFontSize = showFontSize
    ? getSharedValue(selectedObjects, (o) => o.fontSize ?? 14)
    : null;

  return (
    <>
      {showFill && (
        <ColorPicker
          label="Fill"
          value={sharedFillColor ?? ''}
          isMixed={sharedFillColor === null}
          disabled={disabled}
          onChange={(color) => onStyleChange(ids, { color })}
        />
      )}

      {showStroke && (
        <ColorPicker
          label="Stroke"
          value={sharedStrokeColor ?? ''}
          isMixed={sharedStrokeColor === null}
          disabled={disabled}
          onChange={(color) => onStyleChange(ids, buildStrokeColorPatch(selectedObjects, color))}
        />
      )}

      {showStrokeWidth && (
        <label className="property-row" htmlFor="style-stroke-width">
          <span>Stroke width</span>
          <input
            id="style-stroke-width"
            type="range"
            min={1}
            max={8}
            step={1}
            value={sharedStrokeWidth ?? 2}
            disabled={disabled}
            onChange={(e) => onStyleChange(ids, { strokeWidth: Number(e.target.value) })}
          />
        </label>
      )}

      {showFontSize && (
        <label className="property-row" htmlFor="style-font-size">
          <span>Font size</span>
          <input
            id="style-font-size"
            type="range"
            min={10}
            max={72}
            step={1}
            value={sharedFontSize ?? 14}
            disabled={disabled}
            onChange={(e) => onStyleChange(ids, { fontSize: Number(e.target.value) })}
          />
        </label>
      )}
    </>
  );
}
