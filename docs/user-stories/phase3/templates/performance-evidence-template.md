# Performance Evidence Template (Phase III)

Date: February 20, 2026

## Test Environment

- Frontend URL: `https://collab-board-iota.vercel.app`
- Socket URL: `https://collab-board-0948.onrender.com`
- Browser/device: Chrome 133+ / macOS
- Network profile: WiFi (unthrottled unless noted)
- Concurrent users tested: `TODO (target: 5+)`

## Metric Results

| Metric | PRD Target | Measured | Pass/Fail | Evidence |
|---|---|---|---|---|
| Frame rate during pan/zoom/manipulation | 60 FPS | `TODO` | `TODO` | MetricsOverlay FPS counter during drag/zoom |
| Object sync latency | <100ms | `TODO` | `TODO` | MetricsOverlay "Object avg" during 2-user editing |
| Cursor sync latency | <50ms | `TODO` | `TODO` | MetricsOverlay "Cursor avg" during 2-user cursor movement |
| Object capacity | 500+ objects | `TODO` | `TODO` | Load 500 objects via stress generator, verify FPS and interaction |
| Concurrent users | 5+ users | `TODO` | `TODO` | 5 browser sessions on same board, verify metrics stability |

## Scenario Notes

### Scenario 1: Two users simultaneous edits

**Steps:**
1. Open board URL in Browser A (Chrome) and Browser B (Chrome Incognito or different profile).
2. Both users sign in (or use guest mode).
3. User A creates 5 sticky notes. User B creates 5 rectangles.
4. Both users drag objects simultaneously for 30 seconds.
5. Read MetricsOverlay in both sessions.

**Pass criteria:** Object sync latency <100ms average in both sessions. All 10 objects visible in both views.

**Measured:** `TODO`

### Scenario 2: Mid-edit refresh recovery

**Steps:**
1. User A creates 10+ objects on the board (mix of stickies, shapes).
2. User B is viewing the same board and sees all objects.
3. User B refreshes the page (Cmd+R).
4. After page load, verify all objects appear correctly from Firestore.

**Pass criteria:** All objects reload with correct positions, colors, and text. No data loss.

**Measured:** `TODO`

### Scenario 3: Rapid create/move stress

**Steps:**
1. Single user session on a board.
2. Rapidly create 30+ sticky notes in under 60 seconds (click toolbar, click canvas, repeat).
3. Then select and drag multiple objects rapidly for 30 seconds.
4. Monitor FPS counter in MetricsOverlay throughout.

**Pass criteria:** FPS stays ≥45 sustained (minor dips acceptable). No UI freezes.

**Measured:** `TODO`

### Scenario 4: Network throttle/disconnect recovery

**Steps:**
1. Open board in Browser A, create a few objects.
2. Open Chrome DevTools → Network → select "Slow 3G" throttling.
3. Observe: "Reconnecting..." banner should appear.
4. Switch back to "No throttling".
5. Verify reconnect succeeds and board state converges.

**Pass criteria:** Reconnect banner appears within 5s of throttle. Board recovers fully after network restored. No duplicate objects or missing state.

**Measured:** `TODO`

### Scenario 5: Five-user collaboration stability

**Steps:**
1. Open the same board URL in 5 separate sessions (different browsers, incognito windows, or devices).
2. All 5 users move cursors actively for 60 seconds.
3. 3 users create/edit objects simultaneously.
4. Read MetricsOverlay in each session.

**Pass criteria:** Cursor latency <50ms average. Object latency <100ms average. FPS ≥50 in all sessions. Presence shows 5 users.

**Measured:** `TODO`

## Bottlenecks / Follow-ups

- `TODO (document any observed issues after manual execution)`
