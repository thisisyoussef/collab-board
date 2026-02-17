import Ably from "ably";

let ablyClient: Ably.Realtime | null = null;

/**
 * Get the Ably singleton. Must call initAblyClient() first.
 * Throws if not initialized — prevents accidental random-UUID clients.
 */
export function getAblyClient(): Ably.Realtime {
  if (!ablyClient) {
    throw new Error('Ably not initialized. Call initAblyClient() before using Ably.');
  }
  return ablyClient;
}

/**
 * Initialize Ably with an authenticated clientId (e.g. Firebase UID).
 * Idempotent: skips if already connected with the same clientId.
 */
export function initAblyClient(clientId: string): Ably.Realtime {
  if (ablyClient && ablyClient.auth.clientId === clientId) {
    return ablyClient;
  }
  if (ablyClient) {
    ablyClient.close();
  }
  ablyClient = new Ably.Realtime({
    key: import.meta.env.VITE_ABLY_API_KEY,
    clientId,
  });
  return ablyClient;
}

export function getBoardChannel(boardId: string) {
  const client = getAblyClient();
  return client.channels.get(`board:${boardId}`);
}
