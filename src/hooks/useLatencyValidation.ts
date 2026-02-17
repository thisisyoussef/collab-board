import { useState, useCallback, useRef } from 'react';
import { getBoardChannel } from '../lib/ably';

export interface LatencyResults {
  avg: number;
  max: number;
  p95: number;
  results: number[];
}

/**
 * Validates Ably round-trip latency with 100 echo messages.
 * From realtime-perf-monitoring skill — STOP GATE if avg > 50ms.
 */
export function useLatencyValidation(boardId: string) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<LatencyResults | null>(null);
  const abortRef = useRef(false);

  const runValidation = useCallback(async () => {
    setIsRunning(true);
    abortRef.current = false;
    const channel = getBoardChannel(boardId);
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      if (abortRef.current) break;

      await new Promise<void>((resolve) => {
        const start = Date.now();
        const testId = `latency-test-${i}`;

        const onMessage = () => {
          latencies.push(Date.now() - start);
          channel.unsubscribe(testId, onMessage);
          resolve();
        };

        channel.subscribe(testId, onMessage);
        channel.publish(testId, { sentAt: start });
      });
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? max;

    console.log(`Latency -- avg: ${avg.toFixed(1)}ms, max: ${max}ms, p95: ${p95}ms`);
    console.assert(avg < 50, `FAIL: Average latency ${avg.toFixed(1)}ms exceeds 50ms target`);

    const result: LatencyResults = { avg, max, p95, results: latencies };
    setResults(result);
    setIsRunning(false);
    return result;
  }, [boardId]);

  return { runValidation, isRunning, results };
}
