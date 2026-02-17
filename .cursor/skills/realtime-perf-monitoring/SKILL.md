---
name: realtime-perf-monitoring
description: Monitor and optimize real-time sync latency and canvas performance for CollabBoard. Use when implementing Ably messaging, measuring latency, debugging FPS drops, validating performance targets (<100ms objects, <50ms cursors, 60 FPS), or building the metrics overlay.
---

# Real-Time Performance Monitoring

## Performance Gates (hard requirements)

| Metric              | Target | Gate |
| ------------------- | ------ | ---- |
| Object sync latency | <100ms | HARD |
| Cursor sync latency | <50ms  | HARD |
| Canvas FPS          | 60 FPS | HARD |
| Object capacity     | 500+   | HARD |
| Concurrent users    | 5+     | HARD |

**If any gate fails, STOP feature work and debug before continuing.**

## Latency Measurement

### Ably Message Latency Tracker

```javascript
const measureLatency = (channel, eventName, data) => {
  const sent = Date.now();
  channel.publish(eventName, { _ts: sent, ...data });
};

// On receive side:
channel.subscribe(eventName, (msg) => {
  const latency = Date.now() - msg.data._ts;
  performanceLog.push({ event: eventName, latency, timestamp: Date.now() });
  if (latency > 100)
    console.warn(`[PERF] High latency: ${eventName} ${latency}ms`);
});
```

### Latency Validation Script (run early — hours 1-4)

```javascript
async function validateAblyLatency(channel) {
  const results = { cursor: [], object: [] };

  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => {
      const start = Date.now();
      const testId = `test-${i}`;

      channel.subscribe(testId, () => {
        results.cursor.push(Date.now() - start);
        channel.unsubscribe(testId);
        resolve();
      });

      channel.publish(testId, { sentAt: start });
    });
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const max = (arr) => Math.max(...arr);

  console.log(
    `Cursor latency — avg: ${avg(results.cursor).toFixed(1)}ms, max: ${max(results.cursor)}ms`,
  );
  console.assert(
    avg(results.cursor) < 50,
    "FAIL: Cursor latency exceeds 50ms target",
  );
  return results;
}
```

## FPS Monitoring

### stats.js Overlay (development)

```javascript
import Stats from "stats.js";

export function initFPSMonitor() {
  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb
  stats.dom.style.cssText = "position:fixed;top:0;left:0;z-index:9999;";
  document.body.appendChild(stats.dom);

  function loop() {
    stats.begin();
    // ... rendering happens ...
    stats.end();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return stats;
}
```

### Custom FPS Hook (for MetricsOverlay component)

```javascript
function useFPS() {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId;

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
```

## Firestore Write Latency

```javascript
async function measureFirestoreWrite(boardRef, data) {
  const start = Date.now();
  await updateDoc(boardRef, data);
  const latency = Date.now() - start;
  console.log(`[PERF] Firestore write: ${latency}ms`);
  return latency;
}
```

## MetricsOverlay Component

Build a toggleable overlay showing live metrics during demos:

```jsx
function MetricsOverlay({
  cursorLatency,
  objectLatency,
  fps,
  userCount,
  objectCount,
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        background: "#000a",
        color: "#0f0",
        padding: 8,
        fontFamily: "monospace",
        fontSize: 12,
        zIndex: 9999,
        borderRadius: 4,
      }}
    >
      <div>FPS: {fps}</div>
      <div>
        Cursor avg: {cursorLatency.toFixed(0)}ms{" "}
        {cursorLatency > 50 ? "⚠️" : "✅"}
      </div>
      <div>
        Object avg: {objectLatency.toFixed(0)}ms{" "}
        {objectLatency > 100 ? "⚠️" : "✅"}
      </div>
      <div>
        Users: {userCount} | Objects: {objectCount}
      </div>
    </div>
  );
}
```

## Object Capacity Stress Test

```javascript
function stressTest(stage, layer, count = 500) {
  console.time("stress-test-create");
  for (let i = 0; i < count; i++) {
    const rect = new Konva.Rect({
      id: `stress-${i}`,
      x: Math.random() * 5000,
      y: Math.random() * 5000,
      width: 100,
      height: 80,
      fill: `hsl(${Math.random() * 360}, 70%, 60%)`,
    });
    layer.add(rect);
  }
  layer.batchDraw();
  console.timeEnd("stress-test-create");
  console.log(`Rendered ${count} objects. Check FPS counter.`);
}
```

## When to Use This Skill

- **Phase 1 (hours 1-4):** Run `validateAblyLatency` to confirm architecture works before building features.
- **During object sync:** Measure latency on every Ably publish/subscribe.
- **During canvas work:** Monitor FPS with stats.js, especially with 500+ objects.
- **Before demos:** Enable MetricsOverlay to show live proof of performance.
- **Any time performance degrades:** Use these tools to identify the bottleneck.
