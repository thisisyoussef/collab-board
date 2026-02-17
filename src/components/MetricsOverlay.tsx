import { useEffect, useState } from 'react';

interface MetricsOverlayProps {
  fps: number;
  cursorLatency: number;
  objectLatency: number;
  userCount: number;
  objectCount: number;
}

/**
 * Fixed DOM overlay showing real-time performance metrics.
 * Toggle with Ctrl+Shift+M.
 * From realtime-perf-monitoring skill.
 */
export function MetricsOverlay({
  fps,
  cursorLatency,
  objectLatency,
  userCount,
  objectCount,
}: MetricsOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!visible) return null;

  const fpsOk = fps >= 55;
  const cursorOk = cursorLatency > 0 ? cursorLatency < 50 : true;
  const objectOk = objectLatency > 0 ? objectLatency < 100 : true;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontFamily: 'monospace',
        lineHeight: 1.6,
        zIndex: 10000,
        minWidth: 200,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Performance Metrics</div>
      <div>
        {fpsOk ? '✅' : '❌'} FPS: <strong>{fps}</strong> (target: 60)
      </div>
      <div>
        {cursorOk ? '✅' : '❌'} Cursor: <strong>{cursorLatency.toFixed(1)}ms</strong>{' '}
        (target: &lt;50ms)
      </div>
      <div>
        {objectOk ? '✅' : '❌'} Object: <strong>{objectLatency.toFixed(1)}ms</strong>{' '}
        (target: &lt;100ms)
      </div>
      <div>Users: {userCount} | Objects: {objectCount}</div>
      <div
        style={{
          marginTop: 4,
          color: fpsOk && cursorOk && objectOk ? '#27ae60' : '#e74c3c',
          fontWeight: 700,
        }}
      >
        {fpsOk && cursorOk && objectOk ? 'ALL GATES PASS' : 'GATE FAILURE'}
      </div>
    </div>
  );
}
