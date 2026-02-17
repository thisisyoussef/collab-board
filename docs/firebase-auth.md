# Firebase Authentication — Web (v9+ Modular SDK)

> Source: https://firebase.google.com/docs/auth/web/

## Overview

Firebase Authentication provides backend services, SDKs, and UI libraries for authenticating users. Supports email/password, phone, and federated providers (Google, Facebook, Apple, GitHub, etc.).

**Installation:**
```bash
npm install firebase
```

---

## Setup & Initialization

### Firebase Config

```js
// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Enable Google Sign-In

1. Go to [Firebase Console](https://console.firebase.google.com) → Authentication → Sign-in method
2. Enable **Google** provider
3. Set project support email
4. Add authorized domains (localhost, your-app.vercel.app)

---

## Google Sign-In

### Popup Method (Recommended for SPA)

```js
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const auth = getAuth();
const provider = new GoogleAuthProvider();

// Optional: add scopes
provider.addScope("https://www.googleapis.com/auth/contacts.readonly");

// Optional: force account selection
provider.setCustomParameters({ prompt: "select_account" });

async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);

    // Google access token (for Google APIs, if needed)
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;

    // Signed-in user info
    const user = result.user;
    console.log(user.displayName, user.email, user.photoURL, user.uid);

    return user;
  } catch (error) {
    const errorCode = error.code;
    const errorMessage = error.message;
    const email = error.customData?.email;
    const credential = GoogleAuthProvider.credentialFromError(error);
    console.error("Sign-in error:", errorCode, errorMessage);
    throw error;
  }
}
```

### Redirect Method (Alternative)

```js
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "firebase/auth";

const auth = getAuth();
const provider = new GoogleAuthProvider();

// Initiate redirect
function signIn() {
  signInWithRedirect(auth, provider);
}

// Handle redirect result (call on page load)
async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const user = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
    }
  } catch (error) {
    console.error("Redirect error:", error);
  }
}
```

---

## Auth State Observer

The most important pattern — reacts to sign-in/sign-out across tabs and sessions.

```js
import { getAuth, onAuthStateChanged } from "firebase/auth";

const auth = getAuth();

// Returns an unsubscribe function
const unsubscribe = onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    const { uid, displayName, email, photoURL } = user;
    console.log("Signed in:", uid, displayName);
  } else {
    // User is signed out
    console.log("No user");
  }
});

// Later: stop listening
unsubscribe();
```

### React Hook Pattern

```jsx
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
```

---

## Sign Out

```js
import { getAuth, signOut } from "firebase/auth";

const auth = getAuth();

async function handleSignOut() {
  try {
    await signOut(auth);
    // onAuthStateChanged will fire with null
  } catch (error) {
    console.error("Sign out error:", error);
  }
}
```

---

## Current User

```js
import { getAuth } from "firebase/auth";

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  // User is signed in
  const { uid, displayName, email, emailVerified, photoURL } = user;
  const providerId = user.providerData[0]?.providerId; // "google.com"
} else {
  // No user signed in
}
```

**Warning:** `auth.currentUser` may be `null` on initial page load before auth state resolves. Always use `onAuthStateChanged` for reliable state.

---

## ID Tokens (JWT)

Firebase Auth issues JWT tokens for authenticating with your backend.

### Get ID Token (Client)

```js
import { getAuth } from "firebase/auth";

const auth = getAuth();

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  // Get fresh token (auto-refreshes if expired)
  const token = await user.getIdToken();
  return token;

  // Force refresh
  const freshToken = await user.getIdToken(true);
  return freshToken;
}
```

### Token Claims

The ID token contains:

```json
{
  "iss": "https://securetoken.google.com/<project-id>",
  "aud": "<project-id>",
  "auth_time": 1708200000,
  "user_id": "abc123",
  "sub": "abc123",
  "iat": 1708200000,
  "exp": 1708203600,
  "email": "user@example.com",
  "email_verified": true,
  "firebase": {
    "identities": {
      "google.com": ["123456789"],
      "email": ["user@example.com"]
    },
    "sign_in_provider": "google.com"
  }
}
```

### Verify ID Token (Server — Firebase Admin SDK)

```js
// Server-side (Node.js)
import admin from "firebase-admin";

// Initialize with service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});

// OR initialize with GOOGLE_APPLICATION_CREDENTIALS env var
admin.initializeApp();

async function verifyToken(idToken) {
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch (error) {
    throw new Error("Invalid token");
  }
}
```

### Verify Without Admin SDK (Lightweight)

For serverless environments where you don't want the full Admin SDK:

```js
// Using jose library for JWT verification
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

async function verifyFirebaseToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
    audience: process.env.FIREBASE_PROJECT_ID,
  });

  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}
```

---

## Socket.IO Auth Integration

Pass Firebase ID token when connecting to Socket.IO:

```js
// Client
import { io } from "socket.io-client";
import { getAuth } from "firebase/auth";

const auth = getAuth();

async function createSocket() {
  const token = await auth.currentUser.getIdToken();

  const socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token },
  });

  // Refresh token on reconnect
  socket.on("connect_error", async (err) => {
    if (err.message === "Authentication failed") {
      const newToken = await auth.currentUser?.getIdToken(true);
      if (newToken) {
        socket.auth = { token: newToken };
        socket.connect();
      }
    }
  });

  return socket;
}
```

```js
// Server (Socket.IO middleware)
import admin from "firebase-admin";

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token provided"));

    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.userId = decoded.uid;
    socket.data.email = decoded.email;
    socket.data.displayName = decoded.name || decoded.email;
    socket.data.photoURL = decoded.picture;
    next();
  } catch (err) {
    next(new Error("Authentication failed"));
  }
});
```

---

## Auth Persistence

Firebase Auth persists sign-in state by default in `localStorage`. Options:

```js
import { getAuth, setPersistence, browserLocalPersistence,
         browserSessionPersistence, inMemoryPersistence } from "firebase/auth";

const auth = getAuth();

// Persist across tabs and browser restarts (DEFAULT)
await setPersistence(auth, browserLocalPersistence);

// Clear on tab close
await setPersistence(auth, browserSessionPersistence);

// No persistence (for testing)
await setPersistence(auth, inMemoryPersistence);
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `auth/popup-closed-by-user` | User closed popup before completing sign-in |
| `auth/cancelled-popup-request` | Another popup was opened |
| `auth/popup-blocked` | Browser blocked the popup |
| `auth/account-exists-with-different-credential` | Email already used with different provider |
| `auth/network-request-failed` | Network error |
| `auth/too-many-requests` | Too many failed attempts |
| `auth/user-disabled` | Account disabled by admin |
| `auth/user-not-found` | No account for this email |
| `auth/invalid-credential` | Invalid credential |

---

## Security Rules (Firestore)

Restrict data access to authenticated users:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write
    match /boards/{boardId} {
      allow read, write: if request.auth != null;
    }

    // Only board creator can delete
    match /boards/{boardId} {
      allow delete: if request.auth.uid == resource.data.createdBy;
    }
  }
}
```
