interface BoardZoomChipProps {
  zoomPercent: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
}

export function BoardZoomChip({
  zoomPercent,
  onZoomOut,
  onZoomIn,
  onReset,
}: BoardZoomChipProps) {
  return (
    <div className="board-zoom-chip" role="group" aria-label="Zoom controls">
      <button className="zoom-chip-btn" aria-label="Zoom out" onClick={onZoomOut}>
        −
      </button>
      <button className="zoom-chip-value" aria-label="Reset zoom" onClick={onReset}>
        {zoomPercent}%
      </button>
      <button className="zoom-chip-btn" aria-label="Zoom in" onClick={onZoomIn}>
        +
      </button>
    </div>
  );
}

