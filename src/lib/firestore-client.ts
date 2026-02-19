import { logger } from './logger';

const FIRESTORE_HINT =
  'If you use an ad/privacy blocker, allow firestore.googleapis.com for this site and retry.';

export const FIRESTORE_REQUEST_TIMEOUT_MS = 12000;

export async function withFirestoreTimeout<T>(
  operationLabel: string,
  promise: Promise<T>,
  timeoutMs = FIRESTORE_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: number | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        logger.error('FIRESTORE', `Firestore operation timed out after ${timeoutMs}ms: ${operationLabel}`, { operationLabel, timeoutMs });
        reject(new Error(`${operationLabel} timed out. ${FIRESTORE_HINT}`));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

export function toFirestoreUserMessage(fallback: string, err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
      ? err.code
      : null;
  const message = err instanceof Error ? err.message.toLowerCase() : '';

  if (code === 'permission-denied') {
    return `${fallback} Permission denied for this account. If this is a shared board, deploy Firestore rules that allow authenticated read/update access.`;
  }

  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    message.includes('timed out') ||
    message.includes('blocked by client')
  ) {
    return `${fallback} ${FIRESTORE_HINT}`;
  }

  return fallback;
}
