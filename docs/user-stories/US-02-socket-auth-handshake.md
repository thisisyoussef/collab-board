# US-02: Socket.IO Authenticated Handshake

## Status

- State: Not Started
- Owner: Codex
- Depends on: US-01 Approved

## Persona

**Alex, the Facilitator** — After signing in and creating a board, Alex expects the app to silently establish a WebSocket connection in the background. Alex doesn't think about "sockets" — they just expect the board to feel live. If connection fails, Alex needs a clear visual indicator, not a blank screen.

## User Story

> As Alex, I want the board to automatically connect to the real-time server when I open it so that collaboration features work seamlessly without any manual setup.

## Goal

Deploy a Socket.IO server on Render with Firebase ID token verification. The client connects automatically on board mount and shows connection status.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — Server constructor, middleware section, "Authentication with Firebase JWT" pattern, client connection options
- **Required reading:** `docs/firebase-auth.md` — "ID Tokens" section (client `getIdToken()`), "Verify ID Token (Server)" section, "Socket.IO Auth Integration" pattern
- **Required reading:** `docs/pre-search.md` §9 (Backend/API Architecture — Render server structure), §13 (Deployment — Render setup)
- **Reference:** `CLAUDE.md` — environment variables section, deployment patterns
- **Check:** `.env.example` for required server-side vars (`SOCKET_CORS_ORIGIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)

**Be strategic:** This is the first story that creates the `server/` directory. Plan the folder structure carefully — it needs its own `package.json`, `index.js`, and will be deployed independently to Render. The Socket.IO middleware must verify Firebase ID tokens using either the Admin SDK or lightweight JWT verification (see `docs/firebase-auth.md` for both approaches). The client must pass the token via `socket.auth` and handle `connect_error` for token refresh. Keep the server minimal — no Express routes needed beyond a health check.

## Screens

### Screen: Board Page — Connection States

The board header from US-01 gains a **connection status indicator** in the top-right area, near the action buttons.

```
Connected state:
┌──────────────────────────────────────────────────────────┐
│  Board Shell                         🟢 Connected        │
│  Board ID: abc-123...                [ Back ] [ Sign out] │
│  User: Jane Doe                                          │
└──────────────────────────────────────────────────────────┘

Connecting state:
┌──────────────────────────────────────────────────────────┐
│  Board Shell                         🟡 Connecting...    │
│  Board ID: abc-123...                [ Back ] [ Sign out] │
└──────────────────────────────────────────────────────────┘

Disconnected state:
┌──────────────────────────────────────────────────────────┐
│  Board Shell                         🔴 Disconnected     │
│  Board ID: abc-123...                [ Back ] [ Sign out] │
└──────────────────────────────────────────────────────────┘
```

**Indicator design:**
- Small colored dot (`8px` circle) + text label.
- Connected: `#22c55e` dot, "Connected" text in `#16a34a`.
- Connecting: `#eab308` dot, "Connecting..." text in `#a16207`. Dot pulses (CSS animation).
- Disconnected: `#ef4444` dot, "Disconnected" text in `#dc2626`.
- Position: right side of header bar, vertically centered with action buttons.

## UX Script

### Happy Path: Board Opens → Socket Connects

1. Alex signs in and clicks "New Board" (from US-01).
2. Board page mounts. The connection indicator shows 🟡 "Connecting..." with a pulsing dot.
3. Behind the scenes:
   - Client calls `auth.currentUser.getIdToken()` to get a fresh Firebase JWT.
   - Client creates a Socket.IO connection to `VITE_SOCKET_SERVER_URL` with `auth: { token }`.
   - Server middleware receives connection, extracts `socket.handshake.auth.token`, verifies it with Firebase Admin SDK.
   - Server sets `socket.data.userId`, `socket.data.displayName`, `socket.data.email` from the decoded token.
   - Server calls `next()` — connection accepted.
4. Client receives `connect` event. Indicator transitions to 🟢 "Connected" within 1-3 seconds.
5. Alex doesn't notice any of this — the board just feels alive.

### Error: Invalid/Expired Token

1. Client sends an expired or malformed token.
2. Server middleware calls `next(new Error("Authentication failed"))`.
3. Client receives `connect_error` event with error message.
4. Client attempts one token refresh (`getIdToken(true)`) and reconnects.
5. If refresh fails → indicator stays 🔴 "Disconnected". Alex sees the status and can try refreshing the page.

### Error: Server Unreachable (Render Cold Start)

1. Alex opens a board. Render server is sleeping (15 min idle).
2. Indicator shows 🟡 "Connecting..." for up to 30 seconds while Render spins up.
3. Socket.IO auto-retries with exponential backoff.
4. Once server is ready → connection establishes → 🟢 "Connected".
5. If >60 seconds pass → indicator shows 🔴 "Disconnected". Alex can refresh.

### Edge: Navigation Away

1. Alex clicks "Back" to return to landing.
2. Board component unmounts. Socket disconnects cleanly (client-initiated).
3. No error shown on landing page.

## Implementation Details

### New Files — Server

| File | Purpose |
|------|---------|
| `server/package.json` | Node.js deps: `socket.io`, `firebase-admin` |
| `server/index.js` | HTTP server + Socket.IO setup + auth middleware + health endpoint |

### New/Modified Files — Client

| File | Purpose |
|------|---------|
| `src/hooks/useSocket.ts` | Socket.IO client connection hook — connect on mount, disconnect on unmount, expose connection status |
| `src/pages/Board.tsx` | Add `useSocket` hook, display connection indicator in header |

### Server Structure

```js
// server/index.js
import http from "http";
import { Server } from "socket.io";
import admin from "firebase-admin";

// Firebase Admin init (from env vars, no JSON file)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const server = http.createServer((req, res) => {
  // Health check
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

// Auth middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token provided"));
    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.userId = decoded.uid;
    socket.data.displayName = decoded.name || decoded.email;
    socket.data.email = decoded.email;
    socket.data.photoURL = decoded.picture;
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  console.log(`Connected: ${socket.data.displayName} (${socket.id})`);
  socket.on("disconnect", (reason) => {
    console.log(`Disconnected: ${socket.data.displayName} — ${reason}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Socket server on :${PORT}`));
```

### Client Hook

```ts
// src/hooks/useSocket.ts
function useSocket(boardId: string) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    const connect = async () => {
      const token = await user.getIdToken();
      const socket = io(import.meta.env.VITE_SOCKET_SERVER_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => setStatus("connected"));
      socket.on("disconnect", () => setStatus("disconnected"));
      socket.on("connect_error", async (err) => {
        setStatus("disconnected");
        if (err.message === "Authentication failed") {
          const newToken = await user.getIdToken(true);
          socket.auth = { token: newToken };
          socket.connect();
        }
      });

      socketRef.current = socket;
    };

    connect();
    return () => { socketRef.current?.disconnect(); };
  }, [user, boardId]);

  return { socket: socketRef, status };
}
```

## Acceptance Criteria

- [ ] `server/` directory exists with its own `package.json` and `index.js`.
- [ ] Server verifies Firebase ID token in Socket.IO middleware.
- [ ] Invalid/missing token is rejected with "Authentication failed" error.
- [ ] `GET /health` on the server returns 200.
- [ ] Client connects automatically when the board page mounts.
- [ ] Connection status indicator shows 🟢 Connected / 🟡 Connecting / 🔴 Disconnected.
- [ ] Client disconnects cleanly when navigating away from the board.
- [ ] Client attempts token refresh on `connect_error` with "Authentication failed".
- [ ] Server deployed to Render, frontend deployed to Vercel.
- [ ] `npm run build` and `npm run lint` pass (frontend).

## Checkpoint Test (User)

1. Sign in, create a board. Verify the connection indicator shows 🟡 then transitions to 🟢.
2. Open browser DevTools → Network → WS tab. Verify a WebSocket connection to the Render server URL.
3. Check Render dashboard logs — verify the "Connected: {name}" log appears.
4. Navigate back to landing. Verify no errors; Render logs show "Disconnected".
5. Open the Render health endpoint in browser (`https://your-server.onrender.com/health`). Verify it returns "ok".

## Checkpoint Result

- Production Frontend URL:
- Production Socket URL:
- User Validation: Pending
- Notes:
