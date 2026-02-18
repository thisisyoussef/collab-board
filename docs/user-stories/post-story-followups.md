# Post-Story Follow-Ups

This file tracks non-blocking improvements discovered during manual checkpoints so they are not lost while continuing Phase I delivery.

## Cursor Sync Follow-Ups (US-04)

1. **Stale remote cursor when tab/window loses focus without disconnect**
- Current behavior: if a user switches tabs/windows or pointer leaves active stage without disconnect, other clients may keep seeing the last cursor position until a new cursor event or disconnect.
- Not blocking for US-04 acceptance.
- Post-story fix idea:
  - Emit a new lightweight `cursor:hide` event on `visibilitychange`, `blur`, and stage pointer leave.
  - Add stale-cursor timeout on receivers (for example 3-5 seconds without updates -> hide cursor).

2. **Occasional cursor latency spikes slightly above 50ms**
- Current behavior: average latency stays near target, but short spikes above 50ms can happen.
- Not blocking for US-04 acceptance.
- Post-story optimization ideas:
  - Reduce payload size and avoid unnecessary fields in high-frequency events.
  - Tune throttle interval dynamically (for example 33-50ms based on frame budget).
  - Add moving percentile metrics (p95) in overlay to distinguish transient spikes from sustained latency.
