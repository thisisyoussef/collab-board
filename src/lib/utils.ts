export function generateColor(userId: string): string {
  const source = userId || 'guest';
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = source.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function getInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    return '??';
  }

  if (cleaned.includes('@')) {
    const localPart = cleaned.split('@')[0] || cleaned;
    return localPart.slice(0, 2).toUpperCase();
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
}
