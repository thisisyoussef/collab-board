# WebSocket Troubleshooting Runbook

Use this runbook when frontend logs errors like:

`WebSocket connection ... failed: WebSocket is closed before the connection is established`

## 1) Verify Backend Health

```bash
curl -i https://collab-board-0948.onrender.com/health
```

Expected: HTTP 200 with a healthy status payload.

If it fails:

- Render service may be cold or restarting.
- Check Render service logs and restart if needed.

## 2) Confirm Frontend Socket URL

Ensure frontend uses the intended backend:

```bash
cat /Users/youss/Development/gauntlet/collab-board/.env | rg '^VITE_SOCKET_URL='
```

Production should point to the active Render origin.

## 3) Confirm Socket Server CORS + Transport

Server must allow frontend origin and websocket upgrades.

Checklist:

1. CORS origin includes deployed frontend URL.
2. Socket path matches client path (`/socket.io`).
3. Render service allows websocket upgrades (default for web services).
4. No proxy rule strips upgrade headers.

## 4) Distinguish Cold Start vs Misconfiguration

Cold start signals:

- First connection fails, retries succeed in 5-20 seconds.
- Health endpoint begins returning 200 shortly after.

Misconfiguration signals:

- Repeated failures beyond warm-up window.
- CORS errors in browser console.
- 4xx/5xx on socket polling handshake.

## 5) Client-Side Hardening

Recommended client behavior:

1. Keep reconnection enabled.
2. Backoff retries during initial board load.
3. Show "connecting" state during retries.
4. Avoid declaring hard offline failure until retry budget is exhausted.

## 6) Deployment Sanity Sequence

After push:

1. Deploy Render socket server.
2. Wait for healthy `/health` response.
3. Deploy frontend.
4. Open app and verify presence + cursor events across two sessions.

## 7) Quick Recovery Actions

1. Trigger service wake-up by hitting `/health`.
2. Restart Render service from dashboard if stuck.
3. Redeploy frontend if socket URL changed.
4. Re-test with two browsers before marking fixed.
