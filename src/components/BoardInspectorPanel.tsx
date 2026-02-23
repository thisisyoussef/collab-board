import type { BoardObject } from '../types/board';
import { getAutoColorForRole } from '../lib/board-object';
import { StylePanel } from './StylePanel';

interface BoardInspectorPanelProps {
  selectedIds: string[];
  selectedObject: BoardObject | null;
  selectedObjects: BoardObject[];
  zoomPercent: number;
  canEditBoard: boolean;
  onDeleteSelected: () => void;
  onDeleteObject: (objectId: string) => void;
  onUpdateObject: (objectId: string, patch: Partial<BoardObject>) => void;
  onUpdateConnector: (connectorId: string, patch: Partial<BoardObject>) => void;
  onBatchStyleChange: (ids: string[], patch: Partial<BoardObject>) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

function selectedLabel(object: BoardObject): string {
  if (object.type === 'sticky') {
    return 'Case Card';
  }
  if (object.type === 'rect') {
    return 'Region';
  }
  if (object.type === 'circle') {
    return 'Marker';
  }
  if (object.type === 'line') {
    return 'Line';
  }
  if (object.type === 'text') {
    return 'Annotation';
  }
  if (object.type === 'frame') {
    return 'Case Group';
  }
  return 'Relationship';
}

const NODE_ROLE_OPTIONS: Array<{ value: NonNullable<BoardObject['nodeRole']>; label: string }> = [
  { value: 'claim', label: 'Claim' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'witness', label: 'Witness' },
  { value: 'timeline_event', label: 'Timeline event' },
  { value: 'contradiction', label: 'Contradiction' },
];

const RELATION_OPTIONS: Array<{ value: NonNullable<BoardObject['relationType']>; label: string }> = [
  { value: 'supports', label: 'Supports' },
  { value: 'contradicts', label: 'Contradicts' },
  { value: 'depends_on', label: 'Depends on' },
];

export function BoardInspectorPanel({
  selectedIds,
  selectedObject,
  selectedObjects,
  zoomPercent,
  canEditBoard,
  onDeleteSelected,
  onDeleteObject,
  onUpdateObject,
  onUpdateConnector,
  onBatchStyleChange,
  onDuplicate,
  onCopy,
  onPaste,
}: BoardInspectorPanelProps) {
  const isMulti = selectedIds.length > 1;
  const isSingle = selectedIds.length === 1 && selectedObject;

  return (
    <section className="properties-panel">
      <h3>Case element inspector</h3>
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
          <StylePanel
            selectedObjects={selectedObjects}
            disabled={!canEditBoard}
            onStyleChange={onBatchStyleChange}
          />
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

          <StylePanel
            selectedObjects={[selectedObject]}
            disabled={!canEditBoard}
            onStyleChange={onBatchStyleChange}
          />

          {selectedObject.type !== 'connector' ? (
            <label className="property-row" htmlFor="node-role">
              <span>Node role</span>
              <select
                id="node-role"
                value={selectedObject.nodeRole || ''}
                disabled={!canEditBoard}
                onChange={(event) => {
                  const nextRole = event.target.value;
                  const resolvedRole = nextRole
                    ? (nextRole as NonNullable<BoardObject['nodeRole']>)
                    : undefined;
                  const roleColor =
                    selectedObject.type === 'sticky'
                      ? getAutoColorForRole(resolvedRole)
                      : undefined;
                  onUpdateObject(selectedObject.id, {
                    nodeRole: resolvedRole,
                    ...(roleColor ? { color: roleColor } : {}),
                  });
                }}
              >
                <option value="">None</option>
                {NODE_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedObject.type === 'connector' ? (
            <>
              <label className="property-row" htmlFor="connector-relation">
                <span>Relation</span>
                <select
                  id="connector-relation"
                  value={selectedObject.relationType || ''}
                  disabled={!canEditBoard}
                  onChange={(event) =>
                    onUpdateConnector(selectedObject.id, {
                      relationType: event.target.value
                        ? (event.target.value as NonNullable<BoardObject['relationType']>)
                        : undefined,
                    })
                  }
                >
                  <option value="">None</option>
                  {RELATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
          ) : null}

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
