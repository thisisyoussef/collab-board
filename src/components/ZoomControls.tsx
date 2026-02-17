interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onZoomReset }: ZoomControlsProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: '#fff',
        padding: '4px 6px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        fontSize: 13,
        userSelect: 'none',
      }}
    >
      <button
        onClick={onZoomOut}
        title="Zoom out (Cmd+-)"
        style={btnStyle}
      >
        -
      </button>
      <button
        onClick={onZoomReset}
        title="Reset zoom (Cmd+0)"
        style={{ ...btnStyle, minWidth: 48, fontWeight: 500 }}
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        title="Zoom in (Cmd+=)"
        style={btnStyle}
      >
        +
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 14,
  background: 'transparent',
  lineHeight: 1,
};
