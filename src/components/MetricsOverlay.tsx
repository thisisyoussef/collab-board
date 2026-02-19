import { useEffect, useMemo, useState } from 'react';
import type { SocketStatus } from '../hooks/useSocket';

interface MetricsOverlayProps {
  averageCursorLatencyMs: number;
  averageObjectLatencyMs: number;
  averageAIApplyLatencyMs: number;
  aiApplyCount: number;
  aiDedupeDrops: number;
  userCount: number;
  objectCount: number;
  reconnectCount: number;
  connectionStatus: SocketStatus;
  connectedSinceMs: number | null;
}

const enableMetricsFromEnv =
  String(import.meta.env.VITE_ENABLE_METRICS || '').trim().toLowerCase() === 'true';
const shouldShowMetrics = import.meta.env.DEV || enableMetricsFromEnv;

export function MetricsOverlay({
  averageCursorLatencyMs,
  averageObjectLatencyMs,
  averageAIApplyLatencyMs,
  aiApplyCount,
  aiDedupeDrops,
  userCount,
  objectCount,
  reconnectCount,
  connectionStatus,
  connectedSinceMs,
}: MetricsOverlayProps) {
  const [fps, setFps] = useState(60);
  const [uptimeTickMs, setUptimeTickMs] = useState(0);

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

  useEffect(() => {
    if (connectionStatus !== 'connected' || !connectedSinceMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setUptimeTickMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [connectedSinceMs, connectionStatus]);

  const cursorStatus = useMemo(
    () => (averageCursorLatencyMs < 50 ? '✅' : '⚠️'),
    [averageCursorLatencyMs],
  );
  const objectStatus = useMemo(
    () => (averageObjectLatencyMs < 100 ? '✅' : '⚠️'),
    [averageObjectLatencyMs],
  );
  const aiStatus = useMemo(
    () => (averageAIApplyLatencyMs < 400 ? '✅' : '⚠️'),
    [averageAIApplyLatencyMs],
  );

  const statusLabel = useMemo(() => {
    if (connectionStatus !== 'connected') {
      return 'Status: Offline';
    }

    if (!connectedSinceMs) {
      return 'Status: Connected (0m 00s)';
    }

    const uptimeMs = Math.max(0, uptimeTickMs - connectedSinceMs);
    const totalSeconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formatted = `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    return `Status: Connected (${formatted})`;
  }, [connectedSinceMs, connectionStatus, uptimeTickMs]);

  if (!shouldShowMetrics) {
    return null;
  }

  return (
    <aside className="metrics-overlay" aria-label="Realtime metrics overlay">
      <p>FPS: {fps}</p>
      <p>
        Cursor avg: {averageCursorLatencyMs}ms {cursorStatus}
      </p>
      <p>
        Object avg: {averageObjectLatencyMs}ms {objectStatus}
      </p>
      <p>
        AI apply avg: {averageAIApplyLatencyMs}ms {aiStatus}
      </p>
      <p>
        AI applies: {aiApplyCount} | AI dedupe drops: {aiDedupeDrops}
      </p>
      <p>Reconnects: {reconnectCount}</p>
      <p>
        Users: {userCount} | Objects: {objectCount}
      </p>
      <p>{statusLabel}</p>
    </aside>
  );
}
