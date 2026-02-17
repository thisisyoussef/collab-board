# Socket.IO Documentation

> Source: https://socket.io/docs/v4/

## Overview

Socket.IO is a library for real-time, bidirectional, event-based communication between clients and servers. It uses WebSocket when available, with HTTP long-polling as fallback.

**Installation:**
```bash
# Server
npm install socket.io

# Client
npm install socket.io-client
```

---

## Server API

### Server Constructor

```js
import { createServer } from "http";
import { Server } from "socket.io";

// With HTTP server
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});
httpServer.listen(3000);

// With port directly
const io = new Server(3000, { cors: { origin: "*" } });

// Standalone
const io = new Server({ cors: { origin: "*" } });
io.listen(3000);
```

### Server Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | String | `/socket.io` | URL path for connection |
| `serveClient` | Boolean | `true` | Serve client files |
| `adapter` | Adapter | in-memory | Adapter for multi-server |
| `cors` | Object | | CORS configuration |
| `connectTimeout` | Number | `45000` | Timeout before disconnect (ms) |
| `pingTimeout` | Number | `20000` | Ping timeout (ms) |
| `pingInterval` | Number | `25000` | Ping interval (ms) |
| `maxHttpBufferSize` | Number | `1e6` | Max message size (bytes) |
| `transports` | Array | `["polling","websocket"]` | Allowed transports |

### Server Events

```js
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

io.on("new_namespace", (namespace) => {
  namespace.use(myMiddleware);
});
```

### Server Broadcasting

```js
// Emit to ALL connected clients
io.emit("hello", "world");

// Emit to a specific room
io.to("room1").emit("message", data);
io.in("room1").emit("message", data); // synonym

// Emit to multiple rooms
io.to("room1").to("room2").emit("message", data);

// Emit to all EXCEPT a room
io.except("room1").emit("message", data);

// Emit with acknowledgement (v4.5.0+)
io.timeout(10000).emit("event", (err, responses) => {
  if (err) console.log("timeout");
  else console.log(responses);
});
```

### Server Socket Management

```js
// Join all sockets to a room
io.socketsJoin("room1");
io.in("room1").socketsJoin("room2");

// Remove all sockets from a room
io.socketsLeave("room1");

// Fetch all socket instances
const sockets = await io.fetchSockets();
const roomSockets = await io.in("room1").fetchSockets();

// Disconnect all sockets
io.disconnectSockets();
io.in("room1").disconnectSockets(true); // close connection
```

---

## Socket (Server-Side)

Represents connection with an individual client.

### Socket Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `socket.id` | String | Unique session ID |
| `socket.rooms` | Set | Rooms socket has joined |
| `socket.data` | Object | Arbitrary data storage |
| `socket.handshake` | Object | Connection handshake info |
| `socket.handshake.auth` | Object | Auth credentials from client |
| `socket.handshake.query` | Object | Query params from connection URL |
| `socket.handshake.headers` | Object | HTTP headers |
| `socket.request` | IncomingMessage | HTTP request object |
| `socket.recovered` | Boolean | Connection state recovered (v4.6+) |

### Socket Events

```js
io.on("connection", (socket) => {
  // Listen for custom events
  socket.on("message", (data) => {
    console.log(data);
  });

  // With acknowledgement
  socket.on("message", (data, callback) => {
    callback("received");
  });

  // Before disconnect (socket still in rooms)
  socket.on("disconnecting", (reason) => {
    console.log("Rooms:", socket.rooms);
  });

  // After disconnect (socket left all rooms)
  socket.on("disconnect", (reason) => {
    console.log("Disconnected:", reason);
  });
});
```

**Disconnect reasons:** `server namespace disconnect`, `client namespace disconnect`, `server shutting down`, `ping timeout`, `transport close`, `transport error`, `parse error`, `forced close`, `forced server close`

### Socket Emitting

```js
// Basic emit
socket.emit("hello", "world");

// With acknowledgement
socket.emit("hello", (response) => {
  console.log(response);
});

// Promise-based (v4.6+)
const response = await socket.emitWithAck("hello", "world");

// With timeout
socket.timeout(5000).emit("event", (err) => {
  if (err) console.log("No ack");
});

// Volatile (may be dropped if not ready)
socket.volatile.emit("cursor", position);
```

### Socket Room Management

```js
// Join a room
socket.join("room1");
socket.join(["room1", "room2"]);

// Leave a room
socket.leave("room1");

// Broadcast to room (excluding sender)
socket.to("room1").emit("message", data);

// Broadcast to all except sender
socket.broadcast.emit("new-user", socket.id);

// Broadcast to room excluding another room
socket.to("room1").except("room2").emit("message", data);
```

### Catch-All Listeners

```js
// Listen to any event
socket.onAny((event, ...args) => {
  console.log(`Event: ${event}`, args);
});

// Listen to any outgoing event
socket.onAnyOutgoing((event, ...args) => {
  console.log(`Sent: ${event}`, args);
});

// Remove catch-all
socket.offAny(listener);
```

### Socket-Level Middleware

```js
socket.use(([event, ...args], next) => {
  if (isUnauthorized(event)) {
    return next(new Error("unauthorized"));
  }
  next();
});
```

---

## Rooms

Rooms are server-only arbitrary channels that sockets can join/leave. Clients don't know about rooms directly.

### Joining & Leaving

```js
io.on("connection", (socket) => {
  // Join
  socket.join("board:abc123");

  // Leave
  socket.leave("board:abc123");

  // Auto-leave on disconnect (no cleanup needed)
});
```

### Broadcasting to Rooms

```js
// Send to everyone in room
io.to("board:abc123").emit("update", data);

// Send to room from a socket (excludes sender)
socket.to("board:abc123").emit("update", data);

// Multiple rooms (union — each socket gets event once)
io.to("room1").to("room2").emit("event");

// Exclude a room
io.except("room1").emit("event");
```

### Common Patterns

```js
// User-specific room (multi-device)
io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
  io.to(`user:${userId}`).emit("notification", msg);
});

// Board/document room
io.on("connection", (socket) => {
  socket.on("join-board", (boardId) => {
    socket.join(`board:${boardId}`);
    socket.data.boardId = boardId;
  });
});
```

### Disconnection

```js
io.on("connection", (socket) => {
  // Access rooms BEFORE disconnect completes
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user:left", socket.data.userId);
      }
    }
  });

  // After disconnect — socket.rooms is empty
  socket.on("disconnect", () => {
    // cleanup
  });
});
```

### Room Events (v3.1+)

```js
io.of("/").adapter.on("join-room", (room, id) => {
  console.log(`Socket ${id} joined ${room}`);
});

io.of("/").adapter.on("leave-room", (room, id) => {
  console.log(`Socket ${id} left ${room}`);
});
```

---

## Emitting Events

### Basic

```js
// Server → Client
socket.emit("hello", "world");

// Client → Server
socket.emit("hello", "world");

// Multiple arguments
socket.emit("hello", 1, "2", { 3: "4", 5: Buffer.from([6]) });
```

**Notes:**
- `Date` objects convert to string (ISO format)
- `Map` and `Set` require manual serialization
- Don't call `JSON.stringify()` manually — Socket.IO handles it

### Acknowledgements

```js
// Server
socket.on("update", (arg1, arg2, callback) => {
  console.log(arg1, arg2);
  callback({ status: "ok" });
});

// Client
socket.emit("update", "1", { name: "new" }, (response) => {
  console.log(response.status); // "ok"
});
```

### Timeout

```js
socket.timeout(5000).emit("event", (err) => {
  if (err) console.log("No ack within 5s");
});

// Promise-based (v4.6+)
try {
  const res = await socket.timeout(5000).emitWithAck("event");
} catch (err) {
  // timeout
}
```

### Volatile Events

Events that may be dropped if connection isn't ready (like UDP):

```js
socket.volatile.emit("cursor", { x: 100, y: 200 });
```

Use for data where delivery isn't critical (cursor positions, real-time indicators).

---

## Listening to Events

### Standard Listeners

```js
socket.on("event", (...args) => { });        // Every time
socket.once("event", (...args) => { });       // Only first time
socket.off("event", listener);                // Remove specific
socket.removeAllListeners("event");           // Remove all for event
socket.removeAllListeners();                  // Remove all
```

### Catch-All

```js
socket.onAny((eventName, ...args) => {
  console.log(eventName, args);
});

socket.onAnyOutgoing((event, ...args) => { });

socket.prependAny((event, ...args) => { });   // Add to front
socket.offAny(listener);                       // Remove
socket.offAny();                               // Remove all
```

### Error Handling

Socket.IO has no built-in error handling — wrap listeners manually:

```js
socket.on("action", async (data, callback) => {
  try {
    const result = await processAction(data);
    callback({ status: "ok", result });
  } catch (e) {
    callback({ status: "error", message: e.message });
  }
});
```

---

## Middleware

### Namespace-Level Middleware

Executed for every incoming connection. Use for auth, logging, rate limiting.

```js
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (isValidToken(token)) {
    socket.data.userId = getUserId(token);
    next();
  } else {
    next(new Error("Authentication error"));
  }
});
```

- Multiple middlewares execute sequentially
- Must call `next()` or connection hangs until timeout
- Socket is NOT connected during middleware (no `disconnect` event on failure)

### Client Auth Credentials

```js
// Client
const socket = io("http://localhost:3000", {
  auth: { token: "my-jwt-token" },
});

// Server
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // verify token...
  next();
});
```

### Error Handling

```js
// Server
io.use((socket, next) => {
  const err = new Error("not authorized");
  err.data = { content: "Please retry later" };
  next(err);
});

// Client
socket.on("connect_error", (err) => {
  console.log(err.message);  // "not authorized"
  console.log(err.data);     // { content: "Please retry later" }
});
```

### Express Middleware (v4.6+)

```js
import session from "express-session";
io.engine.use(session({ secret: "keyboard cat" }));
io.engine.use(helmet());
```

---

## Client API

### Creating a Connection

```js
import { io } from "socket.io-client";

// Auto-detect server URL
const socket = io();

// Explicit URL
const socket = io("http://localhost:3000");

// With options
const socket = io("http://localhost:3000", {
  auth: { token: "abc" },
  query: { boardId: "123" },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ["websocket", "polling"],
  autoConnect: true,
});

// Namespace
const socket = io("http://localhost:3000/my-namespace");

// Force new connection (don't reuse Manager)
const socket = io("http://localhost:3000", { forceNew: true });
```

### Socket Attributes (Client)

| Attribute | Type | Description |
|-----------|------|-------------|
| `socket.id` | String | Unique ID (ephemeral, changes on reconnect) |
| `socket.connected` | Boolean | Connection status |
| `socket.disconnected` | Boolean | Inverse of connected |
| `socket.active` | Boolean | Will auto-reconnect |
| `socket.recovered` | Boolean | Session recovered (v4.6+) |
| `socket.io` | Manager | Underlying Manager |

### Socket Events (Client)

```js
socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("connect_error", (error) => {
  if (socket.active) {
    // temporary failure, will auto-reconnect
  } else {
    // denied by server, need manual reconnect
    console.log(error.message);
  }
});

socket.on("disconnect", (reason) => {
  // Auto-reconnect reasons: "ping timeout", "transport close", "transport error"
  // No auto-reconnect: "io server disconnect", "io client disconnect"
  if (socket.active) {
    // will auto-reconnect
  } else {
    // need manual reconnect
  }
});
```

### Socket Methods (Client)

```js
// Emit
socket.emit("event", data);
socket.emit("event", data, (ack) => { });

// Promise-based (v4.6+)
const res = await socket.emitWithAck("event", data);
const res = await socket.timeout(5000).emitWithAck("event", data);

// Listen
socket.on("event", (data) => { });
socket.once("event", (data) => { });
socket.off("event", listener);
socket.onAny((event, ...args) => { });

// Connection control
socket.connect();     // Manual connect
socket.disconnect();  // Manual disconnect (no auto-reconnect)

// Volatile
socket.volatile.emit("cursor", pos);

// Compression
socket.compress(false).emit("large-data", data);
```

### Manager Events

```js
socket.io.on("error", (error) => { });
socket.io.on("reconnect", (attempt) => {
  console.log(`Reconnected after ${attempt} attempts`);
});
socket.io.on("reconnect_attempt", (attempt) => { });
socket.io.on("reconnect_error", (error) => { });
socket.io.on("reconnect_failed", () => { });
socket.io.on("ping", () => { });
```

### Transport Info

```js
socket.on("connect", () => {
  const engine = socket.io.engine;
  console.log(engine.transport.name); // "polling" initially

  engine.once("upgrade", () => {
    console.log(engine.transport.name); // "websocket"
  });
});
```

---

## Common Patterns

### Authentication with Firebase JWT

```js
// Client
import { getAuth } from "firebase/auth";

const auth = getAuth();
const token = await auth.currentUser.getIdToken();

const socket = io("http://localhost:3000", {
  auth: { token },
});

// Server
import admin from "firebase-admin";

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.userId = decoded.uid;
    socket.data.email = decoded.email;
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
});
```

### Board Room Pattern

```js
// Server
io.on("connection", (socket) => {
  socket.on("join-board", ({ boardId, user }) => {
    socket.join(`board:${boardId}`);
    socket.data = { boardId, user };
    socket.to(`board:${boardId}`).emit("user:joined", user);
  });

  socket.on("cursor:move", (data) => {
    const { boardId } = socket.data;
    socket.volatile.to(`board:${boardId}`).emit("cursor:move", {
      ...data,
      userId: socket.data.user.id,
    });
  });

  socket.on("object:create", (obj) => {
    const { boardId } = socket.data;
    socket.to(`board:${boardId}`).emit("object:create", obj);
  });

  socket.on("object:update", (data) => {
    const { boardId } = socket.data;
    socket.to(`board:${boardId}`).emit("object:update", data);
  });

  socket.on("object:delete", (data) => {
    const { boardId } = socket.data;
    socket.to(`board:${boardId}`).emit("object:delete", data);
  });

  socket.on("disconnecting", () => {
    const { boardId, user } = socket.data || {};
    if (boardId) {
      socket.to(`board:${boardId}`).emit("user:left", user);
    }
  });
});
```

### Presence Pattern

```js
// Server
io.on("connection", (socket) => {
  socket.on("join-board", async ({ boardId, user }) => {
    socket.join(`board:${boardId}`);
    socket.data = { boardId, user };

    // Get all sockets in the room
    const sockets = await io.in(`board:${boardId}`).fetchSockets();
    const users = sockets.map((s) => s.data.user).filter(Boolean);

    // Send current users to the joining client
    socket.emit("presence:sync", users);

    // Notify others
    socket.to(`board:${boardId}`).emit("user:joined", user);
  });
});
```

### Reconnection Handling

```js
// Client
socket.on("connect", () => {
  if (socket.recovered) {
    // Missed events will be received
  } else {
    // New session — need to re-fetch state
    socket.emit("join-board", { boardId, user });
  }
});

socket.io.on("reconnect", (attempt) => {
  console.log(`Reconnected after ${attempt} attempts`);
  // Re-join board room
  socket.emit("join-board", { boardId, user });
});

socket.io.on("reconnect_attempt", (attempt) => {
  // Show "Reconnecting..." UI
});

socket.io.on("reconnect_failed", () => {
  // Show "Connection lost" UI
});
```

---

## Performance Tips

1. **Use `volatile` for cursor updates** — dropped messages are fine for cursors
2. **Binary data** is handled natively — no base64 encoding needed
3. **Rooms are server-side only** — no extra client bandwidth
4. **Namespace multiplexing** shares one WebSocket connection across namespaces
5. **Use `socket.compress(false)`** for frequent small messages (cursor data)
6. **Avoid `io.emit()` for large payloads** — prefer targeted room broadcasts
7. **Set `transports: ["websocket"]`** to skip polling upgrade if all clients support WS
