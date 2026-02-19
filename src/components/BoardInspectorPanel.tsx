import type { BoardObject } from '../types/board';

interface BoardInspectorPanelProps {
  selectedIds: string[];
  selectedObject: BoardObject | null;
  zoomPercent: number;
  canEditBoard: boolean;
  onDeleteSelected: () => void;
  onDeleteObject: (objectId: string) => void;
  onUpdateObject: (objectId: string, patch: Partial<BoardObject>) => void;
  onUpdateConnector: (connectorId: string, patch: Partial<BoardObject>) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

function selectedLabel(object: BoardObject): string {
  if (object.type === 'sticky') {
    return 'Sticky Note';
  }
  if (object.type === 'rect') {
    return 'Rectangle';
  }
  if (object.type === 'circle') {
    return 'Circle';
  }
  if (object.type === 'line') {
    return 'Line';
  }
  if (object.type === 'text') {
    return 'Text';
  }
  if (object.type === 'frame') {
    return 'Frame';
  }
  return 'Connector';
}

function safeColor(value: string | undefined, fallback = '#64748b'): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized) || /^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return normalized;
  }
  return fallback;
}

export function BoardInspectorPanel({
  selectedIds,
  selectedObject,
  zoomPercent,
  canEditBoard,
  onDeleteSelected,
  onDeleteObject,
  onUpdateObject,
  onUpdateConnector,
  onDuplicate,
  onCopy,
  onPaste,
}: BoardInspectorPanelProps) {
  const isMulti = selectedIds.length > 1;
  const isSingle = selectedIds.length === 1 && selectedObject;

  return (
    <section className="properties-panel">
      <h3>Inspector</h3>
      {selectedIds.length === 0 ? (
        <>
          <div className="property-row">
            <span>Selection</span>
            <strong>None</strong>
          </div>
          <div className="property-row">
            <span>Zoom</span>
            <strong>{zoomPercent}%</strong>
          </div>
          <div className="property-row">
            <span>Grid</span>
            <strong>On</strong>
          </div>
        </>
      ) : null}

      {isMulti ? (
        <>
          <div className="property-row">
            <span>Selection</span>
            <strong>{selectedIds.length} objects</strong>
          </div>
          <div className="property-row property-actions">
            <button
              className="secondary-btn"
              disabled={!canEditBoard}
              onClick={onDuplicate}
              title="Duplicate (Ctrl+D)"
            >
              Duplicate
            </button>
            <button
              className="secondary-btn"
              disabled={!canEditBoard}
              onClick={onCopy}
              title="Copy (Ctrl+C)"
            >
              Copy
            </button>
            <button
              className="secondary-btn"
              disabled={!canEditBoard}
              onClick={onPaste}
              title="Paste (Ctrl+V)"
            >
              Paste
            </button>
          </div>
          <button
            className="danger-btn property-delete-btn"
            disabled={!canEditBoard}
            onClick={onDeleteSelected}
          >
            Delete Selected
          </button>
        </>
      ) : null}

      {isSingle ? (
        <>
          <div className="property-row">
            <span>Selection</span>
            <strong>{selectedLabel(selectedObject)}</strong>
          </div>
          <div className="property-row">
            <span>X</span>
            <strong>{Math.round(selectedObject.x)}</strong>
          </div>
          <div className="property-row">
            <span>Y</span>
            <strong>{Math.round(selectedObject.y)}</strong>
          </div>
          <div className="property-row">
            <span>W</span>
            <strong>{Math.round(selectedObject.width)}</strong>
          </div>
          <div className="property-row">
            <span>H</span>
            <strong>{Math.round(selectedObject.height)}</strong>
          </div>
          <div className="property-row">
            <span>Rotation</span>
            <strong>{Math.round(selectedObject.rotation)}°</strong>
          </div>

          {selectedObject.type === 'connector' ? (
            <>
              <label className="property-row" htmlFor="connector-color">
                <span>Stroke</span>
                <input
                  id="connector-color"
                  type="color"
                  value={safeColor(selectedObject.color, '#64748b')}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      color: event.target.value,
                    })
                  }
                />
              </label>
              <label className="property-row" htmlFor="connector-stroke-width">
                <span>Width</span>
                <input
                  id="connector-stroke-width"
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={selectedObject.strokeWidth || 2}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      strokeWidth: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="property-row" htmlFor="connector-type">
                <span>Path</span>
                <select
                  id="connector-type"
                  value={selectedObject.connectorType || 'straight'}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      connectorType: event.target.value as BoardObject['connectorType'],
                    })
                  }
                >
                  <option value="straight">Straight</option>
                  <option value="bent">Bent</option>
                  <option value="curved">Curved</option>
                </select>
              </label>
              <label className="property-row" htmlFor="connector-stroke-style">
                <span>Stroke style</span>
                <select
                  id="connector-stroke-style"
                  value={selectedObject.strokeStyle || 'solid'}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      strokeStyle: event.target.value as BoardObject['strokeStyle'],
                    })
                  }
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                </select>
              </label>
              <label className="property-row" htmlFor="connector-start-arrow">
                <span>Start Arrow</span>
                <select
                  id="connector-start-arrow"
                  value={selectedObject.startArrow || 'none'}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      startArrow: event.target.value as BoardObject['startArrow'],
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="line">Line</option>
                  <option value="triangle">Triangle</option>
                  <option value="diamond">Diamond</option>
                </select>
              </label>
              <label className="property-row" htmlFor="connector-end-arrow">
                <span>End Arrow</span>
                <select
                  id="connector-end-arrow"
                  value={selectedObject.endArrow || 'solid'}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      endArrow: event.target.value as BoardObject['endArrow'],
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="line">Line</option>
                  <option value="triangle">Triangle</option>
                  <option value="diamond">Diamond</option>
                </select>
              </label>
              <label className="property-row" htmlFor="connector-label">
                <span>Label</span>
                <input
                  id="connector-label"
                  type="text"
                  value={selectedObject.label || ''}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      label: event.target.value,
                    })
                  }
                />
              </label>
              <label className="property-row" htmlFor="connector-label-position">
                <span>Label Position</span>
                <input
                  id="connector-label-position"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Number.isFinite(selectedObject.labelPosition) ? Number(selectedObject.labelPosition) : 50}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      labelPosition: Number(event.target.value),
                    })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label className="property-row" htmlFor="object-fill">
                <span>{selectedObject.type === 'line' ? 'Stroke' : 'Fill'}</span>
                <input
                  id="object-fill"
                  type="color"
                  value={safeColor(selectedObject.color, '#64748b')}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateObject(selectedObject.id, {
                      color: event.target.value,
                    })
                  }
                />
              </label>

              {selectedObject.type === 'rect' ||
              selectedObject.type === 'circle' ||
              selectedObject.type === 'frame' ? (
                <label className="property-row" htmlFor="object-stroke">
                  <span>Stroke</span>
                  <input
                    id="object-stroke"
                    type="color"
                    value={safeColor(selectedObject.stroke, '#334155')}
                    disabled={!canEditBoard}
                    onChange={(event) =>
                      onUpdateObject(selectedObject.id, {
                        stroke: event.target.value,
                      })
                    }
                  />
                </label>
              ) : null}

              {selectedObject.type === 'rect' ||
              selectedObject.type === 'circle' ||
              selectedObject.type === 'frame' ||
              selectedObject.type === 'line' ? (
                <label className="property-row" htmlFor="object-stroke-width">
                  <span>Stroke width</span>
                  <input
                    id="object-stroke-width"
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={selectedObject.strokeWidth || 2}
                    disabled={!canEditBoard}
                    onChange={(event) =>
                      onUpdateObject(selectedObject.id, {
                        strokeWidth: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ) : null}

              {selectedObject.type === 'sticky' || selectedObject.type === 'text' ? (
                <label className="property-row" htmlFor="object-font-size">
                  <span>Font size</span>
                  <input
                    id="object-font-size"
                    type="range"
                    min={10}
                    max={72}
                    step={1}
                    value={selectedObject.fontSize || 14}
                    disabled={!canEditBoard}
                    onChange={(event) =>
                      onUpdateObject(selectedObject.id, {
                        fontSize: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ) : null}
            </>
          )}

          <div className="property-row property-actions">
            <button
              className="secondary-btn"
              disabled={!canEditBoard}
              onClick={onDuplicate}
              title="Duplicate (Ctrl+D)"
            >
              Duplicate
            </button>
            <button
              className="secondary-btn"
              disabled={!canEditBoard}
              onClick={onCopy}
              title="Copy (Ctrl+C)"
            >
              Copy
            </button>
            <button
              className="secondary-btn"
              disabled={!canEditBoard}
              onClick={onPaste}
              title="Paste (Ctrl+V)"
            >
              Paste
            </button>
          </div>
          <button
            className="danger-btn property-delete-btn"
            disabled={!canEditBoard}
            onClick={() => onDeleteObject(selectedObject.id)}
          >
            Delete
          </button>
        </>
      ) : null}
    </section>
  );
}

