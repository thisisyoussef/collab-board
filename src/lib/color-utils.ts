/** Returns a valid hex color or fallback. */
export function safeColor(value: string | undefined, fallback = '#2A4A7F'): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized) || /^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return normalized;
  }
  return fallback;
}

/** Returns true if the string is a valid 3 or 6-digit hex color with # prefix. */
export function isValidHex(value: string): boolean {
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) || /^#[0-9a-fA-F]{3}$/.test(normalized);
}

/** Normalize a hex string: add # prefix if missing, expand 3-digit to 6-digit. */
export function normalizeHex(input: string): string {
  let hex = input.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return `#${hex}`;
}
