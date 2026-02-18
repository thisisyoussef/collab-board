import http from 'http';
import admin from 'firebase-admin';
import { Server } from 'socket.io';
import {
  boardRoom,
  buildCursorPayload,
  buildPresenceMember,
  generateColor,
  normalizeNonEmptyString,
} from './presence.js';

const PORT = Number(process.env.PORT || 3001);
const SOCKET_CORS_ORIGIN = process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173';

function parseAllowedOrigins(value) {
  return value
    .split(',')
    .map((item) => item.trim())
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
  transports: ['websocket'],
});

io.use(async (socket, next) => {
  try {
    if (!canVerifyFirebaseTokens) {
      next(new Error('Authentication failed'));
      return;
    }

    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      next(new Error('Authentication failed'));
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.userId = decoded.uid;
    socket.data.displayName = decoded.name || decoded.email || 'Unknown';
    socket.data.email = decoded.email || null;
    socket.data.photoURL = decoded.picture || null;
    next();
  } catch {
    next(new Error('Authentication failed'));
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

  socket.on('disconnect', (reason) => {
    console.log(`[socket] Disconnected: ${socket.data.displayName} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`[socket] Server listening on :${PORT}`);
  console.log(`[socket] Allowed origins: ${allowedOrigins.join(', ')}`);
});
