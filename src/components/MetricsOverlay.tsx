import { useEffect, useMemo, useState } from 'react';

interface MetricsOverlayProps {
  averageCursorLatencyMs: number;
  userCount: number;
}

const enableMetricsFromEnv =
  String(import.meta.env.VITE_ENABLE_METRICS || '').toLowerCase() === 'true';
const shouldShowMetrics = import.meta.env.DEV || enableMetricsFromEnv;

export function MetricsOverlay({ averageCursorLatencyMs, userCount }: MetricsOverlayProps) {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    if (!shouldShowMetrics) {
      return;
    }

    let frame = 0;
    let frameCount = 0;
    let lastTick = performance.now();

    const update = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastTick;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTick = now;
      }

      frame = window.requestAnimationFrame(update);
    };

    frame = window.requestAnimationFrame(update);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const cursorStatus = useMemo(
    () => (averageCursorLatencyMs < 50 ? '✅' : '⚠️'),
    [averageCursorLatencyMs],
  );

  if (!shouldShowMetrics) {
    return null;
  }

  return (
    <aside className="metrics-overlay" aria-label="Realtime metrics overlay">
      <p>FPS: {fps}</p>
      <p>
        Cursor avg: {averageCursorLatencyMs}ms {cursorStatus}
      </p>
      <p>Users: {userCount}</p>
    </aside>
  );
}
