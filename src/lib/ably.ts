import Ably from "ably";

let ablyClient: Ably.Realtime | null = null;

/**
 * Get (or lazily create) the Ably singleton.
 * When called without a prior initAblyClient(), falls back to a random clientId.
 */
export function getAblyClient(): Ably.Realtime {
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({
      key: import.meta.env.VITE_ABLY_API_KEY,
      clientId: crypto.randomUUID(),
    });
  }
  return ablyClient;
}

/**
 * (Re-)initialize Ably with an authenticated clientId (e.g. Firebase UID).
 * Closes any existing connection first.
 */
export function initAblyClient(clientId: string): Ably.Realtime {
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
