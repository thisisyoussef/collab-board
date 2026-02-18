# US-02: Socket.IO Authenticated Handshake

## Status

- State: In Progress (Awaiting Render URL + User Validation)
- Owner: Codex
- Depends on: US-01 Approved

## Persona

**Alex, the Facilitator** — Alex just created a new board and is looking at the empty canvas. Alex doesn't know or care about WebSockets — they just expect the board to feel alive. When teammates open the same link, everything should already be connected. If the connection fails silently, Alex would never know the board isn't multiplayer. That's why Alex expects a small, unobtrusive status indicator that confirms the board is live.

**Jordan, the IT Admin** — Jordan's team uses CollabBoard for standups. Jordan expects that the real-time server authenticates every connection with the same Firebase credentials the app already uses — no separate login, no extra configuration. If a user's session expires, the board should silently refresh the token, not kick them out.

## User Story

> As Alex, I want the board to automatically connect to the real-time server when I open it so collaboration features work seamlessly — I should never have to think about connectivity.

> As Jordan, I want the real-time server to verify user identity on every connection so unauthenticated clients can't eavesdrop on board data.

## Goal

Deploy a Socket.IO server on Render with Firebase ID token verification. The client connects automatically when the board page mounts and shows a subtle connection status indicator in the topbar. This is invisible plumbing — the user should never interact with it directly.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- **Required reading:** `docs/socketio.md` — Server constructor, middleware section, "Authentication with Firebase JWT" pattern, client connection options
- **Required reading:** `docs/firebase-auth.md` — "ID Tokens" section (client `getIdToken()`), "Verify ID Token (Server)" section, "Socket.IO Auth Integration" pattern
- **Required reading:** `docs/pre-search.md` §9 (Backend/API Architecture — Render server structure), §13 (Deployment — Render setup)
- **Reference:** `CLAUDE.md` — environment variables section, deployment patterns
- **Check:** `.env.example` for required server-side vars (`SOCKET_CORS_ORIGIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)

**Be strategic:** This is the first story that creates the `server/` directory. Plan the folder structure carefully — it needs its own `package.json`, `index.js`, and will be deployed independently to Render. The Socket.IO middleware must verify Firebase ID tokens using either the Admin SDK or lightweight JWT verification (see `docs/firebase-auth.md` for both approaches). The client must pass the token via `socket.auth` and handle `connect_error` for token refresh. Keep the server minimal — no Express routes needed beyond a health check.

## Setup Prerequisites

### 1. Firebase Admin SDK Service Account

The Socket.IO server needs to verify Firebase ID tokens server-side. This requires a Firebase Admin SDK service account:

1. Firebase Console → Project Settings → Service Accounts → **Generate new private key**.
2. This downloads a JSON file. Extract these three values from it:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (the full PEM string including `-----BEGIN PRIVATE KEY-----`)

> **Security:** Never commit the service account JSON. These values go into Render's environment variables only.

### 2. Render Web Service

Create a new **Web Service** on [render.com](https://render.com):

1. Connect your GitHub repo.
2. **Root Directory:** `server` (Render builds from this subfolder).
3. **Build Command:** `npm install`
4. **Start Command:** `node index.js`
5. **Environment:** Node
6. **Instance Type:** Free (sufficient for development; 15-min idle spin-down is expected).

### 3. Render Environment Variables

Set these in Render's dashboard (Settings → Environment):

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SOCKET_CORS_ORIGIN=https://collab-board-iota.vercel.app
PORT=3001  # Render sets this automatically, but good to have as fallback
```

> **Note on `FIREBASE_PRIVATE_KEY`:** Render may require you to paste the key with literal `\n` characters (not actual newlines). The server code handles this with `.replace(/\\n/g, '\n')`.

### 4. Client Environment Variable (Vercel + local `.env`)

```bash
VITE_SOCKET_SERVER_URL=https://your-service-name.onrender.com
```

Add this to both your local `.env` and Vercel's project environment variables.

### 5. Server Directory Structure

This story creates the `server/` directory from scratch:

```
server/
├── package.json    # deps: socket.io, firebase-admin
└── index.js        # HTTP server + Socket.IO + auth middleware + /health
```

The server has its own `package.json` independent of the frontend. It is deployed separately to Render.

### 6. Install Client Dependency

The frontend needs the Socket.IO client:

```bash
npm install socket.io-client
```

## Screens

### Screen: Board Topbar — Connection Status Integrated

The connection status lives inside the existing `presence-pill` area in the board topbar's right cluster. It's a small, unobtrusive indicator — not a separate element.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ≡  ● CollabBoard  │ Sprint Plan V2 [Rename]  │ Move Frame Text Shape │
│                    │                          │                       │
│                    │              🟢 Live  (AJ)  [Dashboard] [Sign out]│
└─────────────────────────────────────────────────────────────────────┘
```

**Connection states in the presence pill:**

| State | Pill appearance | Text |
|-------|----------------|------|
| Connected | Green border, green background | `🟢 Live` |
| Connecting | Amber border, amber background, pulsing dot | `🟡 Connecting...` |
| Disconnected | Red border, red background | `🔴 Offline` |

**Design specs:**
- The presence pill (`presence-pill` class) already exists in the topbar right cluster. Extend it with a dynamic color based on connection state.
- Connected: `border-color: #86efac`, `color: #166534`, `background: #f0fdf4` (already in CSS — the "Live" state).
- Connecting: `border-color: #fde68a`, `color: #92400E`, `background: #fffbeb`. Dot uses CSS `animation: pulse 1s infinite`.
- Disconnected: `border-color: #fca5a5`, `color: #991b1b`, `background: #fef2f2`.

### Screen: Board Page — Full Layout with Connection Indicator

```
┌─────────────────────────────────────────────────────────────────────┐
│ ≡  ● CollabBoard  Sprint Plan V2 [Rename]  Move Frame Text Shape    │
│                                             🟢 Live (AJ) [Dashboard]│
├──────┬──────────────────────────────────────────┬───────────────────┤
│  ↖   │                                          │ Properties        │
│  □   │          (canvas area — future)           │ Selection: None   │
│  ○   │                                          │ Zoom: 100%        │
│  T   │                                          │ Grid: On          │
│  ↔   │                                          │                   │
└──────┴──────────────────────────────────────────┴───────────────────┘
```

The connection indicator is always visible but does not demand attention when things are working normally. Users notice it only when the state changes to "Connecting..." or "Offline".

## UX Script

### Happy Path: Board Opens, Socket Connects Silently

1. Alex signs in and opens a board from the dashboard. The board page loads with the Figma-like layout — topbar, left rail, canvas area, right properties panel.
2. The presence pill shows 🟡 "Connecting..." with a pulsing amber dot.
3. Behind the scenes (invisible to Alex):
   - Client calls `auth.currentUser.getIdToken()` to get a fresh Firebase JWT.
   - Client creates a Socket.IO connection to `VITE_SOCKET_SERVER_URL` with `auth: { token }`.
   - Server middleware receives the connection, extracts `socket.handshake.auth.token`, verifies it against Firebase Admin SDK.
   - Server populates `socket.data` with `userId`, `displayName`, `email`, `photoURL` from the decoded token.
   - Server calls `next()` — connection accepted.
4. Within 1-3 seconds, the pill transitions to 🟢 "Live". Alex doesn't notice — they're already looking at the canvas.
5. The board is now ready for multiplayer features (presence, cursors, object sync).

### Happy Path: Returning to Board After Idle

1. Alex leaves the board tab open for 30 minutes. Firebase token expires after 1 hour.
2. Alex returns and moves their mouse. The socket is still connected (Socket.IO heartbeats maintain it).
3. If the socket does disconnect due to token expiry, the client catches the error, refreshes the token, and reconnects — all within seconds. The pill flickers to "Connecting..." then back to "Live".

### Error: Invalid/Expired Token

1. Client sends an expired or malformed token (e.g., clock skew, corrupted localStorage).
2. Server middleware calls `next(new Error("Authentication failed"))`.
3. Client receives `connect_error` with the error message.
4. Client automatically attempts one token refresh (`getIdToken(true)`) and reconnects.
5. If refresh succeeds → connection established → 🟢 "Live".
6. If refresh fails → pill shows 🔴 "Offline". Alex can try refreshing the page.

### Error: Server Unreachable (Render Cold Start)

1. Alex opens a board. The Render server is sleeping (free tier: 15 min idle → cold start).
2. Pill shows 🟡 "Connecting..." for up to 30 seconds while Render spins up.
3. Socket.IO auto-retries with exponential backoff. No action needed from Alex.
4. Once the server is ready → connection establishes → 🟢 "Live".
5. If >60 seconds pass without connection → pill shows 🔴 "Offline". Alex can refresh.

### Edge: Navigating Away

1. Alex clicks "Dashboard" to return to board management.
2. Board component unmounts. Socket disconnects cleanly (client-initiated).
3. No error state, no lingering connections. Clean teardown.

### Edge: Multiple Boards Open

1. Alex opens two boards in two tabs. Each tab creates its own socket connection.
2. Each connection is independently authenticated and joined to its board room.
3. Closing one tab doesn't affect the other.

## Implementation Details

### New Files — Server

| File | Purpose |
|------|---------|
| `server/package.json` | Node.js deps: `socket.io`, `firebase-admin` |
| `server/index.js` | HTTP server + Socket.IO setup + auth middleware + health endpoint |

### New/Modified Files — Client

| File | Purpose |
|------|---------|
| `src/hooks/useSocket.ts` | Socket.IO client connection hook — connect on mount, disconnect on unmount, expose connection status and socket ref |
| `src/pages/Board.tsx` | Add `useSocket` hook, update presence pill to reflect connection status |

### Server Structure

```js
// server/index.js
import http from "http";
import { Server } from "socket.io";
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const server = http.createServer((req, res) => {
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

// Auth middleware — every connection verified
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

### Topbar Integration

The existing `presence-pill` in `Board.tsx` currently shows static "Live" text. After this story, it dynamically reflects connection status:

```tsx
<span className={`presence-pill ${statusClass}`}>
  {status === "connected" && "🟢 Live"}
  {status === "connecting" && "🟡 Connecting..."}
  {status === "disconnected" && "🔴 Offline"}
</span>
```

## Acceptance Criteria

- [x] `server/` directory exists with its own `package.json` and `index.js`.
- [x] Server verifies Firebase ID token in Socket.IO middleware.
- [x] Invalid/missing token is rejected with "Authentication failed" error.
- [x] `GET /health` on the server returns 200.
- [x] Client connects automatically when the board page mounts.
- [x] Presence pill shows connection status: 🟢 Live / 🟡 Connecting... / 🔴 Offline.
- [x] Client disconnects cleanly when navigating away from the board.
- [x] Client attempts one token refresh on `connect_error` with "Authentication failed".
- [x] No visible board ID in the UI — the board is identified by its title only.
- [ ] Server deployed to Render, frontend deployed to Vercel.
- [x] `npm run build` and `npm run lint` pass (frontend).

## Checkpoint Test (User)

1. Sign in, open a board from the dashboard. Verify the topbar presence pill shows 🟡 then transitions to 🟢 "Live" within a few seconds.
2. Open browser DevTools → Network → WS tab. Verify a WebSocket connection to the Render server URL.
3. Check Render dashboard logs — verify the "Connected: {name}" log appears.
4. Click "Dashboard" to navigate back. Verify no errors; Render logs show "Disconnected".
5. Open the Render health endpoint in browser (`https://your-server.onrender.com/health`). Verify it returns "ok".

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: Pending (set after Render service is live)
- User Validation: Pending
- Notes:
  Frontend US-02 connection state UI is deployed.
  Server code is implemented under `server/` and locally validated (`/health` and auth failure path).
  Remaining gate is provisioning a live Render Web Service and wiring `VITE_SOCKET_SERVER_URL`.
