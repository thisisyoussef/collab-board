import http from 'http';
import admin from 'firebase-admin';
import { Server } from 'socket.io';
import {
  boardRoom,
  buildCursorHidePayload,
  buildCursorPayload,
  buildPresenceMember,
  generateColor,
  normalizeNonEmptyString,
} from './presence.js';
import { extractRealtimeMeta } from './realtime-meta.js';

const PORT = Number(process.env.PORT || 3001);
const SOCKET_CORS_ORIGIN = process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173';

function parseAllowedOrigins(value) {
  return value
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(SOCKET_CORS_ORIGIN);

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const canVerifyFirebaseTokens =
  Boolean(firebaseProjectId) &&
  Boolean(firebaseClientEmail) &&
  Boolean(firebasePrivateKey);

if (canVerifyFirebaseTokens) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey,
    }),
  });
} else {
  console.warn(
    '[socket] Firebase Admin env vars are missing. Socket auth will reject connections until configured.',
  );
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  transports: ['polling', 'websocket'],
});

function applyGuestIdentity(socket) {
  const requestedGuestId = normalizeNonEmptyString(socket.handshake.auth?.guestId);
  const requestedGuestName = normalizeNonEmptyString(socket.handshake.auth?.guestName);
  const guestId = requestedGuestId || `guest-${socket.id}`;

  socket.data.userId = guestId;
  socket.data.displayName = requestedGuestName || `Guest ${guestId.slice(-4)}`;
  socket.data.email = null;
  socket.data.photoURL = null;
  socket.data.isGuest = true;
}

function resolveBoardIdFromPayload(socket, data) {
  const currentBoardId = normalizeNonEmptyString(socket.data.boardId);
  const payloadBoardId = normalizeNonEmptyString(data?.boardId);
  return payloadBoardId || currentBoardId || null;
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (token && typeof token === 'string' && canVerifyFirebaseTokens) {
      const decoded = await admin.auth().verifyIdToken(token);
      socket.data.userId = decoded.uid;
      socket.data.displayName = decoded.name || decoded.email || 'Unknown';
      socket.data.email = decoded.email || null;
      socket.data.photoURL = decoded.picture || null;
      socket.data.isGuest = false;
      next();
      return;
    }

    applyGuestIdentity(socket);
    next();
  } catch {
    applyGuestIdentity(socket);
    next();
  }
});

io.on('connection', (socket) => {
  console.log(`[socket] Connected: ${socket.data.displayName} (${socket.id})`);
  socket.data.color = generateColor(socket.data.userId);

  socket.on('join-board', async (payload) => {
    const boardId = normalizeNonEmptyString(payload?.boardId);
    if (!boardId) {
      socket.emit('server:error', { code: 'INVALID_BOARD_ID', message: 'Invalid board id.' });
      return;
    }

    const room = boardRoom(boardId);
    const previousBoardId = normalizeNonEmptyString(socket.data.boardId);

    if (previousBoardId && previousBoardId !== boardId) {
      socket.leave(boardRoom(previousBoardId));
    }

    const requestedName = normalizeNonEmptyString(payload?.user?.displayName);
    if (requestedName) {
      socket.data.displayName = requestedName;
    }

    const requestedColor = normalizeNonEmptyString(payload?.user?.color);
    if (requestedColor) {
      socket.data.color = requestedColor;
    }

    socket.data.boardId = boardId;
    socket.join(room);

    const sockets = await io.in(room).fetchSockets();
    const snapshot = sockets.map((entry) => buildPresenceMember(entry));
    socket.emit('presence:snapshot', snapshot);
    socket.to(room).emit('user:joined', buildPresenceMember(socket));
  });

  socket.on('disconnecting', () => {
    const boardId = normalizeNonEmptyString(socket.data.boardId);
    if (!boardId) {
      return;
    }

    socket.to(boardRoom(boardId)).emit('user:left', {
      socketId: socket.id,
      userId: socket.data.userId,
    });
  });

  socket.on('cursor:move', (data) => {
    const boardId = normalizeNonEmptyString(socket.data.boardId);
    if (!boardId) {
      return;
    }

    const payload = buildCursorPayload(data, socket);
    if (!payload) {
      return;
    }

    socket.volatile.to(boardRoom(boardId)).emit('cursor:move', payload);
  });

  socket.on('cursor:hide', (data) => {
    const boardId = normalizeNonEmptyString(socket.data.boardId);
    if (!boardId) {
      return;
    }

    const payload = buildCursorHidePayload(data, socket);
    socket.to(boardRoom(boardId)).emit('cursor:hide', payload);
  });

  socket.on('board:changed', (data) => {
    const boardId = resolveBoardIdFromPayload(socket, data);
    if (!boardId) {
      return;
    }

    const ts = Number(data?._ts);
    const meta = extractRealtimeMeta(data, socket.data.userId);
    socket.to(boardRoom(boardId)).emit('board:changed', {
      boardId,
      _ts: Number.isFinite(ts) ? ts : Date.now(),
      ...meta,
    });
  });

  socket.on('object:create', (data) => {
    const boardId = resolveBoardIdFromPayload(socket, data);
    if (!boardId) {
      return;
    }

    const object = data?.object;
    if (!object || typeof object !== 'object') {
      return;
    }

    const objectId = normalizeNonEmptyString(object.id);
    if (!objectId) {
      return;
    }

    const ts = Number(data?._ts);
    const meta = extractRealtimeMeta(data, socket.data.userId);
    socket.to(boardRoom(boardId)).emit('object:create', {
      boardId,
      object,
      _ts: Number.isFinite(ts) ? ts : Date.now(),
      ...meta,
    });
  });

  socket.on('object:update', (data) => {
    const boardId = resolveBoardIdFromPayload(socket, data);
    if (!boardId) {
      return;
    }

    const object = data?.object;
    if (!object || typeof object !== 'object') {
      return;
    }

    const objectId = normalizeNonEmptyString(object.id);
    if (!objectId) {
      return;
    }

    const ts = Number(data?._ts);
    const meta = extractRealtimeMeta(data, socket.data.userId);
    socket.to(boardRoom(boardId)).emit('object:update', {
      boardId,
      object,
      _ts: Number.isFinite(ts) ? ts : Date.now(),
      ...meta,
    });
  });

  socket.on('object:delete', (data) => {
    const boardId = resolveBoardIdFromPayload(socket, data);
    if (!boardId) {
      return;
    }

    const objectId = normalizeNonEmptyString(data?.objectId);
    if (!objectId) {
      return;
    }

    const ts = Number(data?._ts);
    const meta = extractRealtimeMeta(data, socket.data.userId);
    socket.to(boardRoom(boardId)).emit('object:delete', {
      boardId,
      objectId,
      _ts: Number.isFinite(ts) ? ts : Date.now(),
      ...meta,
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] Disconnected: ${socket.data.displayName} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`[socket] Server listening on :${PORT}`);
  console.log(`[socket] Allowed origins: ${allowedOrigins.join(', ')}`);
});
