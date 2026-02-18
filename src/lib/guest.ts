import { generateColor } from './utils';

const GUEST_ID_KEY = 'collab-board-guest-id';

export interface GuestIdentity {
  userId: string;
  displayName: string;
  color: string;
}

function getStoredGuestId(): string | null {
  try {
    const value = window.localStorage.getItem(GUEST_ID_KEY)?.trim();
    return value || null;
  } catch {
    // Some embedded/privacy modes can block storage access.
    return null;
  }
}

function setStoredGuestId(value: string) {
  try {
    window.localStorage.setItem(GUEST_ID_KEY, value);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

export function getOrCreateGuestIdentity(): GuestIdentity {
  const existing = getStoredGuestId();
  // Reuse a stable guest id per browser so reconnects preserve identity color/name.
  const userId = existing || `guest-${crypto.randomUUID()}`;

  if (!existing) {
    setStoredGuestId(userId);
  }

  return {
    userId,
    displayName: `Guest ${userId.slice(-4)}`,
    color: generateColor(userId),
  };
}
