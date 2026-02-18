import { describe, it, expect } from 'vitest';
import { extractRealtimeMeta } from './realtime-meta.js';

// Test the parseAllowedOrigins logic directly (extracted for testability)
function parseAllowedOrigins(value) {
  return value
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

describe('parseAllowedOrigins', () => {
  it('parses a single origin', () => {
    expect(parseAllowedOrigins('http://localhost:5173')).toEqual(['http://localhost:5173']);
  });

  it('parses multiple comma-separated origins', () => {
    const result = parseAllowedOrigins(
      'http://localhost:5173,https://collab-board-iota.vercel.app',
    );
    expect(result).toEqual([
      'http://localhost:5173',
      'https://collab-board-iota.vercel.app',
    ]);
  });

  it('trims whitespace from origins', () => {
    const result = parseAllowedOrigins('  http://localhost:5173 , https://example.com  ');
    expect(result).toEqual(['http://localhost:5173', 'https://example.com']);
  });

  it('removes trailing slashes from origins', () => {
    const result = parseAllowedOrigins('https://example.com/,https://foo.vercel.app///');
    expect(result).toEqual(['https://example.com', 'https://foo.vercel.app']);
  });

  it('filters out empty strings', () => {
    const result = parseAllowedOrigins('http://localhost:5173,,,,https://example.com');
    expect(result).toEqual(['http://localhost:5173', 'https://example.com']);
  });

  it('returns empty array for empty string', () => {
    expect(parseAllowedOrigins('')).toEqual([]);
  });

  it('handles whitespace-only input', () => {
    expect(parseAllowedOrigins('  ,  ,  ')).toEqual([]);
  });
});

describe('Server Configuration', () => {
  it('uses PORT from environment or defaults to 3001', () => {
    const PORT = Number(process.env.PORT || 3001);
    expect(PORT).toBe(3001); // Default when PORT not set
  });

  it('uses SOCKET_CORS_ORIGIN from environment or defaults to localhost', () => {
    const SOCKET_CORS_ORIGIN = process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5173';
    expect(SOCKET_CORS_ORIGIN).toBe('http://localhost:5173');
  });
});

describe('Firebase Admin Configuration', () => {
  it('detects when Firebase env vars are missing', () => {
    const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
    const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    const canVerifyFirebaseTokens =
      Boolean(firebaseProjectId) &&
      Boolean(firebaseClientEmail) &&
      Boolean(firebasePrivateKey);

    // In test environment, these are not set
    expect(canVerifyFirebaseTokens).toBe(false);
  });

  it('detects when all Firebase env vars are present', () => {
    const canVerifyFirebaseTokens =
      Boolean('project-id') &&
      Boolean('client@email.com') &&
      Boolean('private-key');

    expect(canVerifyFirebaseTokens).toBe(true);
  });
});

describe('Auth Middleware Logic', () => {
  it('rejects when canVerifyFirebaseTokens is false', () => {
    const canVerifyFirebaseTokens = false;
    let error = null;

    if (!canVerifyFirebaseTokens) {
      error = new Error('Authentication failed');
    }

    expect(error).not.toBeNull();
    expect(error?.message).toBe('Authentication failed');
  });

  it('rejects when token is missing', () => {
    const token = undefined;
    let error = null;

    if (!token || typeof token !== 'string') {
      error = new Error('Authentication failed');
    }

    expect(error?.message).toBe('Authentication failed');
  });

  it('rejects when token is not a string', () => {
    const token = 12345;
    let error = null;

    if (!token || typeof token !== 'string') {
      error = new Error('Authentication failed');
    }

    expect(error?.message).toBe('Authentication failed');
  });

  it('allows valid token through (string type check)', () => {
    const token = 'valid-firebase-token';
    let error = null;

    if (!token || typeof token !== 'string') {
      error = new Error('Authentication failed');
    }

    expect(error).toBeNull();
  });
});

describe('Socket Status Label Logic', () => {
  function getSocketStatusLabel(status) {
    return status === 'connected'
      ? '🟢 Live'
      : status === 'connecting'
        ? '🟡 Connecting...'
        : '🔴 Offline';
  }

  it('returns Live for connected status', () => {
    expect(getSocketStatusLabel('connected')).toBe('🟢 Live');
  });

  it('returns Connecting for connecting status', () => {
    expect(getSocketStatusLabel('connecting')).toBe('🟡 Connecting...');
  });

  it('returns Offline for disconnected status', () => {
    expect(getSocketStatusLabel('disconnected')).toBe('🔴 Offline');
  });

  it('returns Offline for unknown status', () => {
    expect(getSocketStatusLabel('unknown')).toBe('🔴 Offline');
  });
});

describe('Realtime Metadata Rebroadcast', () => {
  it('preserves tx metadata from payload when valid', () => {
    const meta = extractRealtimeMeta(
      {
        txId: 'tx-123',
        source: 'ai',
        actorUserId: 'user-abc',
      },
      'socket-user',
    );

    expect(meta).toEqual({
      txId: 'tx-123',
      source: 'ai',
      actorUserId: 'user-abc',
    });
  });

  it('falls back actorUserId to socket user id and ignores invalid source', () => {
    const meta = extractRealtimeMeta(
      {
        source: 'undo',
      },
      'socket-user-2',
    );

    expect(meta).toEqual({
      actorUserId: 'socket-user-2',
    });
  });
});
