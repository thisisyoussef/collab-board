import { useEffect, useState } from 'react';

/**
 * FPS monitoring hook — RAF loop, 1-second sampling.
 * From realtime-perf-monitoring skill verbatim.
 */
export function useFPS(): number {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const countFrame = () => {
      frameCount++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(countFrame);
    };

    rafId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps;
}
