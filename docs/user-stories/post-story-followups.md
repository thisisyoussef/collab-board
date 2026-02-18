# Post-Story Follow-Ups

This file tracks non-blocking improvements discovered during manual checkpoints so they are not lost while continuing Phase I delivery.

## Cursor Sync Follow-Ups (US-04)

1. **Stale remote cursor when tab/window loses focus without disconnect** — ✅ Resolved on February 18, 2026
- Implemented `cursor:hide` socket event flow.
- Client now emits hide on `visibilitychange` (hidden), `blur`, `pagehide`, and Konva stage leave/cancel events.
- Receivers also run a stale-cursor sweep (4s TTL, 1s interval) for safety in case hide events are dropped.

2. **Occasional cursor latency spikes slightly above 50ms** — ✅ Mitigated on February 18, 2026
- Reduced cursor throttle from 50ms to 40ms for smoother updates under fast movement.
- Preserved `volatile` cursor transport for non-blocking realtime flow.
- Remaining transient spikes can still occur under network load and can be revisited with p95 metrics in a later phase.
