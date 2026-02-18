import { useEffect, useMemo, useRef, useState } from 'react';
import type { SocketStatus } from '../hooks/useSocket';

interface ReconnectBannerProps {
  status: SocketStatus;
  disconnectedSinceMs: number | null;
}

const OFFLINE_DETAIL_THRESHOLD_MS = 5000;
const RECONNECTED_FLASH_MS = 1500;

export function ReconnectBanner({ status, disconnectedSinceMs }: ReconnectBannerProps) {
  const [showRecovered, setShowRecovered] = useState(false);
  const [disconnectElapsedMs, setDisconnectElapsedMs] = useState(0);
  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (status === 'disconnected') {
      wasDisconnectedRef.current = true;
      return;
    }

    if (status === 'connected' && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false;
      const frameId = window.requestAnimationFrame(() => {
        setShowRecovered(true);
      });
      const timeoutId = window.setTimeout(() => {
        setShowRecovered(false);
      }, RECONNECTED_FLASH_MS);

      return () => {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(timeoutId);
      };
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'disconnected' || !disconnectedSinceMs) {
      return;
    }

    const update = () => {
      setDisconnectElapsedMs(Math.max(0, Date.now() - disconnectedSinceMs));
    };

    const intervalId = window.setInterval(update, 250);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [disconnectedSinceMs, status]);

  const warningText = useMemo(() => {
    if (disconnectElapsedMs >= OFFLINE_DETAIL_THRESHOLD_MS) {
      return 'Offline — edits will sync when reconnected';
    }
    return 'Connection lost. Reconnecting...';
  }, [disconnectElapsedMs]);

  if (status === 'disconnected') {
    return (
      <aside className="reconnect-banner warning" role="status" aria-live="polite">
        {warningText}
      </aside>
    );
  }

  if (showRecovered) {
    return (
      <aside className="reconnect-banner success" role="status" aria-live="polite">
        Reconnected
      </aside>
    );
  }

  return null;
}
