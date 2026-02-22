interface DocumentExtractionOptions {
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 16_000;
const DEFAULT_MAX_BASE64_BYTES = 3_000_000;

function clamp(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function isPdfDocument(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export async function extractDocumentText(
  file: File,
  options: DocumentExtractionOptions = {},
): Promise<string> {
  const maxChars = clamp(options.maxChars ?? DEFAULT_MAX_CHARS, DEFAULT_MAX_CHARS);
  if (isPdfDocument(file)) {
    return '';
  }

  try {
    return (await file.slice(0, 600_000).text()).slice(0, maxChars);
  } catch {
    return '';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function encodeFileAsBase64(
  file: File,
  maxBytes = DEFAULT_MAX_BASE64_BYTES,
): Promise<string> {
  const byteLimit = clamp(maxBytes, DEFAULT_MAX_BASE64_BYTES);
  if (file.size <= 0 || file.size > byteLimit) {
    return '';
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return bytesToBase64(bytes);
  } catch {
    return '';
  }
}
