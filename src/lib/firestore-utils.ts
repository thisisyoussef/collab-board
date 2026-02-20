// Firestore data conversion utilities.
// Firestore stores timestamps as Timestamp objects, not plain numbers.
// This helper safely converts them for sorting/comparison in the UI.

/**
 * Convert a Firestore Timestamp (or unknown value) to epoch milliseconds.
 *
 * Firestore Timestamps expose a `toMillis()` method. This helper safely
 * handles arbitrary values (nulls, non-objects, etc.) so callers don't
 * need to guard against bad data from the database.
 */
export function toMillis(value: unknown): number {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis() ?? 0;
  }
  return 0;
}
