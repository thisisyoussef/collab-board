import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeBoardRole, resolveBoardAccess } from '../../src/lib/access.js';

type LitigationRelation = 'supports' | 'contradicts' | 'depends_on';
type LitigationIntakeObjective = 'board_overview' | 'chronology' | 'contradictions' | 'witness_prep';

interface LitigationIntakeInput {
  caseSummary: string;
  claims: string;
  witnesses: string;
  evidence: string;
  timeline: string;
}

interface LitigationUploadedDocumentInput {
  name: string;
  mimeType: string;
  size: number;
  excerpt: string;
  content: string;
  binaryBase64: string;
}

interface LitigationIntakePreferences {
  objective: LitigationIntakeObjective;
  includeClaims: boolean;
  includeEvidence: boolean;
  includeWitnesses: boolean;
  includeTimeline: boolean;
}

interface LitigationDraftClaim {
  id: string;
  title: string;
  summary?: string;
}

interface LitigationDraftEvidence {
  id: string;
  label: string;
  citation?: string;
}

interface LitigationDraftWitness {
  id: string;
  name: string;
  quote?: string;
  citation?: string;
}

interface LitigationDraftTimelineEvent {
  id: string;
  dateLabel: string;
  event: string;
}

interface LitigationDraftLink {
  fromId: string;
  toId: string;
  relation: LitigationRelation;
  reason?: string;
}

interface LitigationIntakeDraft {
  claims: LitigationDraftClaim[];
  evidence: LitigationDraftEvidence[];
  witnesses: LitigationDraftWitness[];
  timeline: LitigationDraftTimelineEvent[];
  links: LitigationDraftLink[];
}

interface BoardDocData {
  ownerId?: string;
  createdBy?: string;
  sharing?: {
    visibility?: string;
    authLinkRole?: string;
    publicLinkRole?: string;
  };
}

const MAX_LIST_ITEMS = 24;
const MAX_DOCUMENTS = 20;
const MAX_DOCUMENT_TEXT_LENGTH = 6_000;
const MAX_INLINE_BINARY_BYTES = 3_000_000;
const DEFAULT_PREFERENCES: LitigationIntakePreferences = {
  objective: 'board_overview',
  includeClaims: true,
  includeEvidence: true,
  includeWitnesses: true,
  includeTimeline: true,
};

function getFirebasePrivateKey(): string | null {
  const value = process.env.FIREBASE_PRIVATE_KEY;
  if (!value || typeof value !== 'string') {
    return null;
  }
  return value.replace(/\\n/g, '\n');
}

function ensureFirebaseAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured');
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function extractBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value || typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return null;
  }

  return match[1].trim() || null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isSyntheticUploadSummary(value: string): boolean {
  return /^uploaded\s+\d+\s+documents?\s+for intake parsing\.?$/i.test(value.trim());
}

function sanitizeIdPart(value: string, fallbackPrefix: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (normalized) {
    return normalized;
  }
  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureUniqueId(baseId: string, used: Set<string>): string {
  const candidate = baseId.trim() || 'item';
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  let suffix = 2;
  while (used.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  const nextId = `${candidate}-${suffix}`;
  used.add(nextId);
  return nextId;
}

function cleanListLine(rawLine: string): string {
  return rawLine
    .trim()
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+[).]\s+/, '')
    .trim();
}

function parseList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => cleanListLine(line))
    .filter((line) => line.length > 0)
    .slice(0, MAX_LIST_ITEMS);
}

function dedupeNormalizedLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  lines.forEach((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    next.push(line);
  });

  return next;
}

function splitTitleAndDetails(value: string): { title: string; detail?: string } {
  const colonMatch = value.match(/^([^:]+?)\s*:\s*(.+)$/);
  if (colonMatch) {
    return {
      title: colonMatch[1]?.trim() || value.trim(),
      detail: colonMatch[2]?.trim() || undefined,
    };
  }

  const dashMatch = value.match(/^(.+?)\s[–-]\s(.+)$/);
  if (dashMatch) {
    return {
      title: dashMatch[1]?.trim() || value.trim(),
      detail: dashMatch[2]?.trim() || undefined,
    };
  }

  return { title: value.trim() };
}

function splitCitation(value: string): { text: string; citation?: string } {
  const citationMatch = value.match(/\(([^)]+)\)\s*$/);
  if (!citationMatch || !citationMatch[1]) {
    return { text: value.trim() };
  }
  const citation = citationMatch[1].trim();
  const text = value.slice(0, citationMatch.index).trim();
  return {
    text: text || value.trim(),
    citation: citation || undefined,
  };
}

function buildClaims(input: LitigationIntakeInput, usedIds: Set<string>): LitigationDraftClaim[] {
  const claimLines = dedupeNormalizedLines(parseList(input.claims));
  const caseSummary = input.caseSummary.trim();

  if (claimLines.length === 0 && caseSummary && !isSyntheticUploadSummary(caseSummary)) {
    const fallback = caseSummary
      .split(/[.;]\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2);
    claimLines.push(...fallback);
  }

  return claimLines.map((line, index) => {
    const parsed = splitTitleAndDetails(line);
    const id = ensureUniqueId(
      `claim-${sanitizeIdPart(parsed.title || `claim-${index + 1}`, 'claim')}`,
      usedIds,
    );
    return {
      id,
      title: parsed.title.slice(0, 140),
      ...(parsed.detail ? { summary: parsed.detail.slice(0, 300) } : {}),
    };
  });
}

function buildEvidence(input: LitigationIntakeInput, usedIds: Set<string>): LitigationDraftEvidence[] {
  const lines = parseList(input.evidence);
  const seen = new Set<string>();
  const evidence: LitigationDraftEvidence[] = [];

  lines.forEach((line, index) => {
    const parsed = splitCitation(line);
    const signature = `${parsed.text.toLowerCase()}::${(parsed.citation || '').toLowerCase()}`;
    if (seen.has(signature)) {
      return;
    }
    seen.add(signature);

    const id = ensureUniqueId(
      `evidence-${sanitizeIdPart(parsed.text || `evidence-${index + 1}`, 'evidence')}`,
      usedIds,
    );
    evidence.push({
      id,
      label: parsed.text.slice(0, 160),
      ...(parsed.citation ? { citation: parsed.citation.slice(0, 160) } : {}),
    });
  });

  return evidence;
}

function buildWitnesses(input: LitigationIntakeInput, usedIds: Set<string>): LitigationDraftWitness[] {
  return parseList(input.witnesses).map((line, index) => {
    const parsed = splitCitation(line);
    const witnessSplit = splitTitleAndDetails(parsed.text);
    const id = ensureUniqueId(
      `witness-${sanitizeIdPart(witnessSplit.title || `witness-${index + 1}`, 'witness')}`,
      usedIds,
    );

    return {
      id,
      name: witnessSplit.title.slice(0, 120),
      ...(witnessSplit.detail ? { quote: witnessSplit.detail.slice(0, 240) } : {}),
      ...(parsed.citation ? { citation: parsed.citation.slice(0, 160) } : {}),
    };
  });
}

function parseTimelineLine(line: string): { dateLabel: string; event: string } {
  const split = splitTitleAndDetails(line);
  if (split.detail) {
    return {
      dateLabel: split.title.slice(0, 80),
      event: split.detail.slice(0, 220),
    };
  }

  return {
    dateLabel: `Event`,
    event: split.title.slice(0, 220),
  };
}

function buildTimeline(input: LitigationIntakeInput, usedIds: Set<string>): LitigationDraftTimelineEvent[] {
  return parseList(input.timeline).map((line, index) => {
    const parsed = parseTimelineLine(line);
    const id = ensureUniqueId(
      `timeline-${sanitizeIdPart(`${parsed.dateLabel}-${index + 1}`, 'timeline')}`,
      usedIds,
    );
    return {
      id,
      dateLabel: parsed.dateLabel,
      event: parsed.event,
    };
  });
}

function buildFallbackClaimFromEvidence(
  evidence: LitigationDraftEvidence[],
  usedIds: Set<string>,
): LitigationDraftClaim[] {
  if (evidence.length === 0) {
    return [];
  }

  const firstEvidence = evidence[0]?.label || 'uploaded evidence';
  const titleSeed = firstEvidence
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const title =
    (titleSeed ? titleSeed.charAt(0).toUpperCase() + titleSeed.slice(1) : 'Primary case theory').slice(0, 120);

  const id = ensureUniqueId(
    `claim-${sanitizeIdPart(title || 'claim-from-evidence', 'claim')}`,
    usedIds,
  );
  return [
    {
      id,
      title,
      summary: 'Auto-generated from uploaded evidence. Refine this claim language for litigation strategy.',
    },
  ];
}

function appendSectionLine(existing: string, line: string): string {
  const cleaned = cleanListLine(line);
  if (!cleaned) {
    return existing;
  }
  const merged = dedupeNormalizedLines([...(existing ? parseList(existing) : []), cleaned]);
  return merged.join('\n');
}

function extractStructuredSectionsFromText(text: string): Partial<LitigationIntakeInput> {
  const sections: Partial<LitigationIntakeInput> = {};
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    let match = line.match(/^claims?:\s*(.+)$/i);
    if (match?.[1]) {
      sections.claims = appendSectionLine(sections.claims || '', match[1]);
      return;
    }

    match = line.match(/^(?:evidence(?:\/exhibits?)?|exhibits?):\s*(.+)$/i);
    if (match?.[1]) {
      sections.evidence = appendSectionLine(sections.evidence || '', match[1]);
      return;
    }

    match = line.match(/^(?:witness(?:\s+statements?)?|witnesses?):\s*(.+)$/i);
    if (match?.[1]) {
      sections.witnesses = appendSectionLine(sections.witnesses || '', match[1]);
      return;
    }

    match = line.match(/^timeline:\s*(.+)$/i);
    if (match?.[1]) {
      sections.timeline = appendSectionLine(sections.timeline || '', match[1]);
      return;
    }

    match = line.match(/^(?:overview|case summary|summary):\s*(.+)$/i);
    if (match?.[1]) {
      sections.caseSummary = appendSectionLine(sections.caseSummary || '', match[1]);
    }
  });

  return sections;
}

function normalizeDocuments(raw: unknown): LitigationUploadedDocumentInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .slice(0, MAX_DOCUMENTS)
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const mimeType = asString(record.mimeType).trim();
      const sizeRaw = record.size;
      const size = typeof sizeRaw === 'number' && Number.isFinite(sizeRaw) ? Math.max(0, sizeRaw) : 0;
      const binaryBase64 = asString(record.binaryBase64).trim();
      return {
        name: asString(record.name).trim(),
        mimeType,
        size,
        excerpt: asString(record.excerpt).slice(0, MAX_DOCUMENT_TEXT_LENGTH),
        content: asString(record.content).slice(0, MAX_DOCUMENT_TEXT_LENGTH),
        binaryBase64:
          binaryBase64.length > 0 && size > 0 && size <= MAX_INLINE_BINARY_BYTES ? binaryBase64 : '',
      };
    })
    .filter((entry) => entry.name || entry.excerpt || entry.content || entry.binaryBase64);
}

interface MergedIntakeResult {
  input: LitigationIntakeInput;
  warnings: string[];
}

interface ParsedDocumentText {
  name: string;
  text: string;
  source: 'provided' | 'pdf_parse';
  quality: 'high' | 'low';
}

function isPdfMimeType(mimeType: string, name: string): boolean {
  return mimeType === 'application/pdf' || /\.pdf$/i.test(name);
}

let cachedPdfParse:
  | ((data: Buffer, options?: Record<string, unknown>) => Promise<{ text?: string } | Record<string, unknown>>)
  | null = null;

async function resolvePdfParse() {
  if (cachedPdfParse) {
    return cachedPdfParse;
  }

  const module = await import('pdf-parse');
  const candidate = (module as Record<string, unknown>).default || module;
  if (typeof candidate !== 'function') {
    throw new Error('pdf-parse module did not export a parser function');
  }

  cachedPdfParse = candidate as (
    data: Buffer,
    options?: Record<string, unknown>,
  ) => Promise<{ text?: string } | Record<string, unknown>>;
  return cachedPdfParse;
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdfTextFromBase64(base64: string): Promise<string> {
  if (!base64) {
    return '';
  }

  try {
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length || buffer.length > MAX_INLINE_BINARY_BYTES) {
      return '';
    }

    const pdfParse = await resolvePdfParse();
    const parsed = await pdfParse(buffer, { max: 18 });
    const text = asString((parsed as Record<string, unknown>).text);
    return cleanExtractedText(text).slice(0, MAX_DOCUMENT_TEXT_LENGTH * 8);
  } catch {
    return '';
  }
}

function detectExtractionQuality(text: string): 'high' | 'low' {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 250) {
    return 'low';
  }

  const alphaMatches = normalized.match(/[A-Za-z]/g);
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  const alphaRatio = normalized.length > 0 ? alphaCount / normalized.length : 0;
  if (alphaRatio < 0.45) {
    return 'low';
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return wordCount >= 70 ? 'high' : 'low';
}

function extractClaimsFromNarrativeText(text: string): string[] {
  const claims: string[] = [];
  const chargePatterns = [
    /has been charged with\s+([^.\n]{6,220})/gi,
    /charged with\s+([^.\n]{6,220})/gi,
    /indict(?:ed|ment)[^.\n]*for\s+([^.\n]{6,220})/gi,
  ];

  chargePatterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const value = cleanListLine(match[1] || '');
      if (value) {
        const parsed = splitTitleAndDetails(value);
        claims.push(parsed.title ? `Charge: ${parsed.title}` : value);
      }
    }
  });

  if (claims.length === 0) {
    const firstDegreeMatch = text.match(/first[- ]degree murder/i);
    if (firstDegreeMatch) {
      claims.push('Charge: First-degree murder');
    }
  }

  return dedupeNormalizedLines(claims).slice(0, 6);
}

function extractEvidenceFromNarrativeText(text: string): string[] {
  const evidence: string[] = [];

  for (const match of text.matchAll(/exhibit[s]?\s+([a-z0-9-]{1,8})\s*(?:is|:|-)?\s*([^\n.]{0,200})/gi)) {
    const exhibitId = cleanListLine(match[1] || '');
    const description = cleanListLine(match[2] || '');
    if (!exhibitId) {
      continue;
    }
    evidence.push(description ? `Exhibit ${exhibitId}: ${description}` : `Exhibit ${exhibitId}`);
  }

  return dedupeNormalizedLines(evidence).slice(0, 16);
}

function extractWitnessesFromNarrativeText(text: string): string[] {
  const witnessLines: string[] = [];
  const sectionMatch = text.match(/WITNESSES[\s\S]{0,2200}/i);
  const candidateText = sectionMatch ? sectionMatch[0] : text;

  for (const match of candidateText.matchAll(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g)) {
    const name = (match[1] || '').trim();
    if (!name) {
      continue;
    }

    if (/State of|Circuit Court|Mississippi|High School|Mock Trial/i.test(name)) {
      continue;
    }

    witnessLines.push(name);
  }

  return dedupeNormalizedLines(witnessLines).slice(0, 12);
}

function extractTimelineFromNarrativeText(text: string): string[] {
  const timeline: string[] = [];
  const datePattern =
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:,\s*\d{4})?/gi;

  for (const match of text.matchAll(datePattern)) {
    if (!match.index && match.index !== 0) {
      continue;
    }
    const dateLabel = match[0];
    const snippet = text
      .slice(match.index, match.index + 180)
      .split(/[.\n]/)[0]
      ?.replace(/\s+/g, ' ')
      .trim();
    if (!dateLabel || !snippet) {
      continue;
    }
    timeline.push(`${dateLabel}: ${snippet}`);
  }

  return dedupeNormalizedLines(timeline).slice(0, 10);
}

function deriveSectionsFromNarrativeText(text: string): Partial<LitigationIntakeInput> {
  const claims = extractClaimsFromNarrativeText(text);
  const evidence = extractEvidenceFromNarrativeText(text);
  const witnesses = extractWitnessesFromNarrativeText(text);
  const timeline = extractTimelineFromNarrativeText(text);

  const summarySentence = text
    .replace(/\s+/g, ' ')
    .split(/[.!?]/)[0]
    ?.trim();

  return {
    caseSummary: summarySentence ? summarySentence.slice(0, 280) : '',
    claims: claims.join('\n'),
    evidence: evidence.join('\n'),
    witnesses: witnesses.join('\n'),
    timeline: timeline.join('\n'),
  };
}

async function mergeIntakeWithDocuments(
  input: LitigationIntakeInput,
  documents: LitigationUploadedDocumentInput[],
): Promise<MergedIntakeResult> {
  if (documents.length === 0) {
    return { input, warnings: [] };
  }

  const warnings: string[] = [];
  const parsedDocuments: ParsedDocumentText[] = [];

  for (const entry of documents) {
    const providedText = cleanExtractedText([entry.excerpt, entry.content].filter(Boolean).join('\n'));
    let combinedText = providedText;
    let source: ParsedDocumentText['source'] = 'provided';

    if (isPdfMimeType(entry.mimeType, entry.name) && entry.binaryBase64) {
      const parsedPdfText = await extractPdfTextFromBase64(entry.binaryBase64);
      if (parsedPdfText) {
        combinedText = cleanExtractedText([providedText, parsedPdfText].filter(Boolean).join('\n'));
        source = 'pdf_parse';
      }
    }

    const quality = detectExtractionQuality(combinedText);
    parsedDocuments.push({
      name: entry.name,
      text: combinedText,
      source,
      quality,
    });
  }

  const lowQualityPdfCount = parsedDocuments.filter(
    (entry, index) =>
      isPdfMimeType(documents[index]?.mimeType || '', entry.name) && entry.quality === 'low',
  ).length;
  if (lowQualityPdfCount > 0) {
    warnings.push(
      `${lowQualityPdfCount} uploaded PDF${lowQualityPdfCount === 1 ? '' : 's'} had low-confidence text extraction. OCR-processed source files will improve board quality.`,
    );
  }

  const combinedDocumentText = parsedDocuments
    .map((entry) => entry.text)
    .filter(Boolean)
    .join('\n');

  const extractedFromDocuments = extractStructuredSectionsFromText(combinedDocumentText);
  const derivedFromNarrative = deriveSectionsFromNarrativeText(combinedDocumentText);
  const mergedEvidence = dedupeNormalizedLines(
    [input.evidence, extractedFromDocuments.evidence || '', derivedFromNarrative.evidence || '']
      .filter(Boolean)
      .flatMap((entry) => parseList(entry)),
  ).join('\n');

  const mergedInput: LitigationIntakeInput = {
    caseSummary:
      input.caseSummary ||
      extractedFromDocuments.caseSummary ||
      derivedFromNarrative.caseSummary ||
      '',
    claims: input.claims || extractedFromDocuments.claims || derivedFromNarrative.claims || '',
    witnesses:
      input.witnesses ||
      extractedFromDocuments.witnesses ||
      derivedFromNarrative.witnesses ||
      '',
    evidence: mergedEvidence,
    timeline:
      input.timeline ||
      extractedFromDocuments.timeline ||
      derivedFromNarrative.timeline ||
      '',
  };

  return { input: mergedInput, warnings };
}

function buildLinks(
  draft: LitigationIntakeDraft,
  objective: LitigationIntakeObjective,
): LitigationDraftLink[] {
  const firstClaim = draft.claims[0];
  if (!firstClaim) {
    return [];
  }

  const links: LitigationDraftLink[] = [];

  draft.evidence.forEach((entry) => {
    links.push({
      fromId: entry.id,
      toId: firstClaim.id,
      relation: 'supports',
      reason: 'Imported from evidence list',
    });
  });

  draft.witnesses.forEach((entry) => {
    links.push({
      fromId: entry.id,
      toId: firstClaim.id,
      relation: objective === 'contradictions' ? 'contradicts' : 'supports',
      reason:
        objective === 'contradictions'
          ? 'Witness contradiction review objective selected'
          : 'Witness statement linked during intake parsing',
    });
  });

  draft.timeline.forEach((entry) => {
    links.push({
      fromId: firstClaim.id,
      toId: entry.id,
      relation: 'depends_on',
      reason: 'Timeline event dependency',
    });
  });

  return links;
}

function parseIntakeDraft(
  input: LitigationIntakeInput,
  preferences: LitigationIntakePreferences,
): LitigationIntakeDraft {
  const usedIds = new Set<string>();
  let claims = preferences.includeClaims ? buildClaims(input, usedIds) : [];
  const evidence = preferences.includeEvidence ? buildEvidence(input, usedIds) : [];
  const witnesses = preferences.includeWitnesses ? buildWitnesses(input, usedIds) : [];
  const timeline = preferences.includeTimeline ? buildTimeline(input, usedIds) : [];

  if (preferences.includeClaims && claims.length === 0 && evidence.length > 0) {
    claims = buildFallbackClaimFromEvidence(evidence, usedIds);
  }

  const draft: LitigationIntakeDraft = {
    claims,
    evidence,
    witnesses,
    timeline,
    links: [],
  };
  draft.links = buildLinks(draft, preferences.objective);
  return draft;
}

function normalizeInput(raw: unknown): LitigationIntakeInput {
  const record =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    caseSummary: asString(record.caseSummary).trim(),
    claims: asString(record.claims).trim(),
    witnesses: asString(record.witnesses).trim(),
    evidence: asString(record.evidence).trim(),
    timeline: asString(record.timeline).trim(),
  };
}

function normalizePreferences(raw: unknown): LitigationIntakePreferences {
  const record =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const objectiveRaw = asString(record.objective).trim();
  const objective: LitigationIntakeObjective =
    objectiveRaw === 'chronology' ||
    objectiveRaw === 'contradictions' ||
    objectiveRaw === 'witness_prep'
      ? objectiveRaw
      : 'board_overview';

  const includeClaims =
    typeof record.includeClaims === 'boolean'
      ? record.includeClaims
      : DEFAULT_PREFERENCES.includeClaims;
  const includeEvidence =
    typeof record.includeEvidence === 'boolean'
      ? record.includeEvidence
      : DEFAULT_PREFERENCES.includeEvidence;
  const includeWitnesses =
    typeof record.includeWitnesses === 'boolean'
      ? record.includeWitnesses
      : DEFAULT_PREFERENCES.includeWitnesses;
  const includeTimeline =
    typeof record.includeTimeline === 'boolean'
      ? record.includeTimeline
      : DEFAULT_PREFERENCES.includeTimeline;

  const hasAnySection = includeClaims || includeEvidence || includeWitnesses || includeTimeline;
  if (!hasAnySection) {
    return {
      objective,
      includeClaims: true,
      includeEvidence: true,
      includeWitnesses: true,
      includeTimeline: true,
    };
  }

  return {
    objective,
    includeClaims,
    includeEvidence,
    includeWitnesses,
    includeTimeline,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bodyRecord =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const boardIdRaw = bodyRecord.boardId;
  const boardId = typeof boardIdRaw === 'string' ? boardIdRaw.trim() : '';
  if (!boardId) {
    return res.status(400).json({ error: 'Missing or invalid boardId' });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  let actorUserId = '';
  try {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    actorUserId = decoded.uid;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Firebase Admin is not configured')) {
      return res.status(500).json({ error: 'Auth service not configured' });
    }
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }

  let boardData: BoardDocData | null = null;
  let memberRole: ReturnType<typeof normalizeBoardRole> = null;
  try {
    const firestore = getFirestore();
    const boardSnapshot = await firestore.collection('boards').doc(boardId).get();
    if (!boardSnapshot.exists) {
      return res.status(404).json({ error: 'Board not found' });
    }

    boardData = (boardSnapshot.data() || {}) as BoardDocData;
    const memberSnapshot = await firestore
      .collection('boardMembers')
      .doc(`${boardId}_${actorUserId}`)
      .get();
    memberRole = memberSnapshot.exists ? normalizeBoardRole(memberSnapshot.data()?.role) : null;
  } catch {
    return res.status(500).json({ error: 'Unable to validate board access' });
  }

  const access = resolveBoardAccess({
    ownerId: boardData?.ownerId || boardData?.createdBy || null,
    userId: actorUserId,
    isAuthenticated: true,
    explicitMemberRole: memberRole,
    sharing: boardData?.sharing ?? null,
  });

  if (!access.canEdit) {
    return res.status(403).json({ error: 'You do not have editor access for this board.' });
  }

  const intake = normalizeInput(bodyRecord.intake);
  const documents = normalizeDocuments(bodyRecord.documents);
  const mergedResult = await mergeIntakeWithDocuments(intake, documents);
  const preferences = normalizePreferences(bodyRecord.preferences);
  const draft = parseIntakeDraft(mergedResult.input, preferences);

  const warningSuffix =
    mergedResult.warnings.length > 0
      ? ` ${mergedResult.warnings.join(' ')}`
      : '';

  return res.status(200).json({
    message: `Parsed intake for ${preferences.objective} into ${draft.claims.length} claims, ${draft.evidence.length} evidence items, ${draft.witnesses.length} witnesses, and ${draft.timeline.length} timeline events.${warningSuffix}`,
    draft,
  });
}
