import Ably from "ably";

let ablyClient: Ably.Realtime | null = null;

export function getAblyClient(): Ably.Realtime {
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({
      key: import.meta.env.VITE_ABLY_API_KEY,
      clientId: crypto.randomUUID(),
    });
  }
  return ablyClient;
}

export function getBoardChannel(boardId: string) {
  const client = getAblyClient();
  return client.channels.get(`board:${boardId}`);
}
