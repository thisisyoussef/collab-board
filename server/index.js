import http from 'http';
import admin from 'firebase-admin';
import { Server } from 'socket.io';

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

  socket.on('disconnect', (reason) => {
    console.log(`[socket] Disconnected: ${socket.data.displayName} (${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`[socket] Server listening on :${PORT}`);
  console.log(`[socket] Allowed origins: ${allowedOrigins.join(', ')}`);
});
