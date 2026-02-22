interface DocumentExtractionOptions {
  maxChars?: number;
  maxPdfPages?: number;
}

const DEFAULT_MAX_CHARS = 16_000;
const DEFAULT_MAX_PDF_PAGES = 12;

function clamp(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function isPdfDocument(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function extractPdfText(
  file: File,
  options: Required<DocumentExtractionOptions>,
): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      stopAtErrors: true,
    });

    const documentProxy = await loadingTask.promise;
    const pageCount = Math.min(documentProxy.numPages, options.maxPdfPages);
    const chunks: string[] = [];
    let totalLength = 0;

    for (let page = 1; page <= pageCount; page += 1) {
      const pageProxy = await documentProxy.getPage(page);
      const textContent = await pageProxy.getTextContent();
      const lines = textContent.items
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'str' in entry && typeof entry.str === 'string') {
            return entry.str;
          }
          return '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (lines) {
        chunks.push(lines);
        totalLength += lines.length;
      }

      pageProxy.cleanup();
      if (totalLength >= options.maxChars) {
        break;
      }
    }

    documentProxy.cleanup();
    documentProxy.destroy();
    return chunks.join('\n').slice(0, options.maxChars);
  } catch {
    return '';
  }
}

export async function extractDocumentText(
  file: File,
  options: DocumentExtractionOptions = {},
): Promise<string> {
  const resolvedOptions = {
    maxChars: clamp(options.maxChars ?? DEFAULT_MAX_CHARS, DEFAULT_MAX_CHARS),
    maxPdfPages: clamp(options.maxPdfPages ?? DEFAULT_MAX_PDF_PAGES, DEFAULT_MAX_PDF_PAGES),
  };

  if (isPdfDocument(file)) {
    const pdfText = await extractPdfText(file, resolvedOptions);
    if (pdfText.trim()) {
      return pdfText;
    }
  }

  try {
    return (await file.slice(0, 600_000).text()).slice(0, resolvedOptions.maxChars);
  } catch {
    return '';
  }
}
