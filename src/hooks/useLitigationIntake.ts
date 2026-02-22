import type { User } from 'firebase/auth';
import { useCallback, useRef, useState } from 'react';
import { logger } from '../lib/logger';
import {
  encodeFileAsBase64,
  extractDocumentText,
  isPdfDocument,
} from '../lib/documentTextExtraction';
import type {
  LitigationIntakeDraft,
  LitigationIntakeInput,
  LitigationIntakeObjective,
  LitigationLayoutMode,
  LitigationIntakePreferences,
  LitigationSectionKey,
  LitigationUploadedDocument,
} from '../types/litigation';

interface UseLitigationIntakeOptions {
  boardId?: string;
  user?: User | null;
  endpoint?: string;
}

interface IntakeApiPayload {
  draft?: unknown;
  message?: unknown;
  error?: unknown;
}

interface UseLitigationIntakeResult {
  input: LitigationIntakeInput;
  draft: LitigationIntakeDraft | null;
  uploadedDocuments: LitigationUploadedDocument[];
  objective: LitigationIntakeObjective;
  layoutMode: LitigationLayoutMode;
  includedSections: Record<LitigationSectionKey, boolean>;
  canGenerate: boolean;
  loading: boolean;
  error: string | null;
  message: string | null;
  setInputField: (field: keyof LitigationIntakeInput, value: string) => void;
  setObjective: (objective: LitigationIntakeObjective) => void;
  setLayoutMode: (layoutMode: LitigationLayoutMode) => void;
  toggleSection: (section: LitigationSectionKey) => void;
  addUploadedDocuments: (files: File[]) => Promise<void>;
  removeUploadedDocument: (documentId: string) => void;
  clearDraft: () => void;
  resetInput: () => void;
  generateDraft: () => Promise<boolean>;
}

const EMPTY_INPUT: LitigationIntakeInput = {
  caseSummary: '',
  claims: '',
  witnesses: '',
  evidence: '',
  timeline: '',
};

const DEFAULT_PREFERENCES: LitigationIntakePreferences = {
  objective: 'board_overview',
  layoutMode: 'summary',
  includeClaims: true,
  includeEvidence: true,
  includeWitnesses: true,
  includeTimeline: true,
};

const SECTION_TO_PREFERENCE_KEY: Record<
  LitigationSectionKey,
  keyof Omit<LitigationIntakePreferences, 'objective' | 'layoutMode'>
> = {
  claims: 'includeClaims',
  evidence: 'includeEvidence',
  witnesses: 'includeWitnesses',
  timeline: 'includeTimeline',
};

function ensureString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function ensureDraft(value: unknown): LitigationIntakeDraft {
  const fallback: LitigationIntakeDraft = {
    claims: [],
    evidence: [],
    witnesses: [],
    timeline: [],
    links: [],
  };

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  return {
    claims: Array.isArray(record.claims) ? (record.claims as LitigationIntakeDraft['claims']) : [],
    evidence: Array.isArray(record.evidence) ? (record.evidence as LitigationIntakeDraft['evidence']) : [],
    witnesses: Array.isArray(record.witnesses) ? (record.witnesses as LitigationIntakeDraft['witnesses']) : [],
    timeline: Array.isArray(record.timeline) ? (record.timeline as LitigationIntakeDraft['timeline']) : [],
    links: Array.isArray(record.links) ? (record.links as LitigationIntakeDraft['links']) : [],
  };
}

async function parseJsonPayload(response: Response): Promise<IntakeApiPayload> {
  try {
    const payload = (await response.json()) as IntakeApiPayload;
    if (payload && typeof payload === 'object') {
      return payload;
    }
  } catch {
    // Ignore parse errors and fallback to empty payload.
  }
  return {};
}

function parseApiError(status: number, payloadError: unknown): string {
  if (typeof payloadError === 'string' && payloadError.trim()) {
    return payloadError.trim();
  }
  if (status === 401) {
    return 'Sign in again before generating an intake draft.';
  }
  if (status === 403) {
    return 'You need editor access to generate intake drafts.';
  }
  return 'Unable to generate intake draft right now.';
}

function hasAnyInputValue(input: LitigationIntakeInput): boolean {
  return Object.values(input).some((value) => value.trim().length > 0);
}

function hasEnabledSections(preferences: LitigationIntakePreferences): boolean {
  return (
    preferences.includeClaims ||
    preferences.includeEvidence ||
    preferences.includeWitnesses ||
    preferences.includeTimeline
  );
}

function toIncludedSections(
  preferences: LitigationIntakePreferences,
): Record<LitigationSectionKey, boolean> {
  return {
    claims: preferences.includeClaims,
    evidence: preferences.includeEvidence,
    witnesses: preferences.includeWitnesses,
    timeline: preferences.includeTimeline,
  };
}

function formatUploadedDocumentLine(document: LitigationUploadedDocument): string {
  if (!document.excerpt) {
    return `- ${document.name}`;
  }
  return `- ${document.name}: ${document.excerpt}`;
}

function buildUploadSignature(document: LitigationUploadedDocument): string {
  return `${document.name.toLowerCase()}::${document.size}`;
}

function dedupeUploadedDocuments(
  entries: LitigationUploadedDocument[],
): LitigationUploadedDocument[] {
  const seen = new Set<string>();
  const next: LitigationUploadedDocument[] = [];

  entries.forEach((entry) => {
    const signature = buildUploadSignature(entry);
    if (seen.has(signature)) {
      return;
    }
    seen.add(signature);
    next.push(entry);
  });

  return next;
}

function buildIntakePayload(
  input: LitigationIntakeInput,
  uploadedDocuments: LitigationUploadedDocument[],
): LitigationIntakeInput {
  if (uploadedDocuments.length === 0) {
    return input;
  }

  const uploadedLines = dedupeUploadedDocuments(uploadedDocuments).map(formatUploadedDocumentLine);
  const evidence = [input.evidence.trim(), ...uploadedLines].filter(Boolean).join('\n');

  return {
    ...input,
    caseSummary: input.caseSummary.trim(),
    evidence,
  };
}

function buildDocumentId(file: File): string {
  const base = file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildExcerpt(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function isLikelyTextDocument(file: File): boolean {
  if (file.type.startsWith('text/')) {
    return true;
  }
  return /\.(txt|md|markdown|csv|json|xml|html|htm|rtf)$/i.test(file.name);
}

function looksMostlyBinary(raw: string): boolean {
  if (!raw) {
    return false;
  }
  const sample = raw.slice(0, 4096);
  if (!sample) {
    return false;
  }
  let suspicious = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const code = sample.charCodeAt(index);
    const isControl = code < 9 || (code > 13 && code < 32);
    if (isControl) {
      suspicious += 1;
    }
  }
  return suspicious / sample.length > 0.08;
}

async function parseUploadedDocument(file: File): Promise<LitigationUploadedDocument> {
  const likelyText = isLikelyTextDocument(file);
  const pdfDocument = isPdfDocument(file);
  let content = '';
  let binaryBase64 = '';

  content = await extractDocumentText(file, { maxChars: 4_000 });
  if (pdfDocument) {
    binaryBase64 = await encodeFileAsBase64(file);
  }

  if (!content && pdfDocument && !binaryBase64) {
    logger.warn('AI', `Uploaded PDF '${file.name}' is too large for inline parsing payload.`, {
      fileName: file.name,
      fileSize: file.size,
    });
  }

  if (!likelyText && !pdfDocument && looksMostlyBinary(content)) {
    content = '';
  }

  return {
    id: buildDocumentId(file),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    excerpt: buildExcerpt(content),
    content: content.slice(0, 4000),
    ...(binaryBase64 ? { binaryBase64 } : {}),
  };
}

export function useLitigationIntake({
  boardId,
  user,
  endpoint = '/api/ai/intake-to-board',
}: UseLitigationIntakeOptions): UseLitigationIntakeResult {
  const [input, setInput] = useState<LitigationIntakeInput>(EMPTY_INPUT);
  const [draft, setDraft] = useState<LitigationIntakeDraft | null>(null);
  const [preferences, setPreferences] = useState<LitigationIntakePreferences>(DEFAULT_PREFERENCES);
  const [uploadedDocuments, setUploadedDocuments] = useState<LitigationUploadedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const inputRef = useRef<LitigationIntakeInput>(EMPTY_INPUT);
  const preferencesRef = useRef<LitigationIntakePreferences>(DEFAULT_PREFERENCES);
  const uploadedDocumentsRef = useRef<LitigationUploadedDocument[]>([]);

  const setInputField = useCallback((field: keyof LitigationIntakeInput, value: string) => {
    setInput((previous) => {
      const next = { ...previous, [field]: value };
      inputRef.current = next;
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
    setError(null);
    setMessage(null);
  }, []);

  const setObjective = useCallback((objective: LitigationIntakeObjective) => {
    setPreferences((previous) => {
      const next = {
        ...previous,
        objective,
      };
      preferencesRef.current = next;
      return next;
    });
    setDraft(null);
  }, []);

  const setLayoutMode = useCallback((layoutMode: LitigationLayoutMode) => {
    setPreferences((previous) => {
      const next = {
        ...previous,
        layoutMode,
      };
      preferencesRef.current = next;
      return next;
    });
    setDraft(null);
  }, []);

  const toggleSection = useCallback((section: LitigationSectionKey) => {
    const preferenceKey = SECTION_TO_PREFERENCE_KEY[section];
    setPreferences((previous) => {
      const next = {
        ...previous,
        [preferenceKey]: !previous[preferenceKey],
      };
      preferencesRef.current = next;
      return next;
    });
    setDraft(null);
  }, []);

  const addUploadedDocuments = useCallback(async (files: File[]) => {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    const parsed = await Promise.all(files.map((file) => parseUploadedDocument(file)));
    setUploadedDocuments((previous) => {
      const next = dedupeUploadedDocuments([...previous, ...parsed]);
      uploadedDocumentsRef.current = next;
      return next;
    });
    setError(null);
    setMessage(null);
    setDraft(null);
  }, []);

  const removeUploadedDocument = useCallback((documentId: string) => {
    setUploadedDocuments((previous) => {
      const next = previous.filter((entry) => entry.id !== documentId);
      uploadedDocumentsRef.current = next;
      return next;
    });
    setDraft(null);
  }, []);

  const resetInput = useCallback(() => {
    setInput(EMPTY_INPUT);
    inputRef.current = EMPTY_INPUT;
    setPreferences(DEFAULT_PREFERENCES);
    preferencesRef.current = DEFAULT_PREFERENCES;
    setUploadedDocuments([]);
    uploadedDocumentsRef.current = [];
    setDraft(null);
    setError(null);
    setMessage(null);
  }, []);

  const generateDraft = useCallback(async (): Promise<boolean> => {
    if (loadingRef.current) {
      return false;
    }

    if (!boardId) {
      setError('Board is unavailable. Reload and try again.');
      return false;
    }

    const nextInput = inputRef.current;
    const nextUploadedDocuments = uploadedDocumentsRef.current;
    const nextPreferences = preferencesRef.current;
    const payloadInput = buildIntakePayload(nextInput, nextUploadedDocuments);

    if (!hasAnyInputValue(payloadInput)) {
      setError('Add at least one intake field before generating.');
      return false;
    }

    if (!hasEnabledSections(nextPreferences)) {
      setError('Select at least one section to include in the board draft.');
      return false;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (user && typeof user.getIdToken === 'function') {
        try {
          const token = await user.getIdToken();
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
        } catch {
          logger.warn('AI', 'Failed to acquire auth token for intake generation request');
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          boardId,
          intake: payloadInput,
          documents: nextUploadedDocuments.map((document) => ({
            name: document.name,
            mimeType: document.mimeType,
            size: document.size,
            excerpt: document.excerpt,
            content: document.content,
            ...(document.binaryBase64 ? { binaryBase64: document.binaryBase64 } : {}),
          })),
          preferences: nextPreferences,
        }),
      });

      const payload = await parseJsonPayload(response);
      if (!response.ok) {
        setDraft(null);
        setError(parseApiError(response.status, payload.error));
        return false;
      }

      const nextDraft = ensureDraft(payload.draft);
      setDraft(nextDraft);
      setMessage(
        ensureString(payload.message).trim() ||
          `Draft generated with ${nextDraft.claims.length} claims and ${nextDraft.links.length} links.`,
      );
      return true;
    } catch {
      setDraft(null);
      setError('Unable to generate intake draft right now.');
      return false;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [boardId, endpoint, user]);

  const canGenerateSections = hasEnabledSections(preferences);

  return {
    input,
    draft,
    uploadedDocuments,
    objective: preferences.objective,
    layoutMode: preferences.layoutMode,
    includedSections: toIncludedSections(preferences),
    canGenerate: hasAnyInputValue(buildIntakePayload(input, uploadedDocuments)) && canGenerateSections,
    loading,
    error,
    message,
    setInputField,
    setObjective,
    setLayoutMode,
    toggleSection,
    addUploadedDocuments,
    removeUploadedDocument,
    clearDraft,
    resetInput,
    generateDraft,
  };
}
