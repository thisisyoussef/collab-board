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
  excerpt: string;
  content: string;
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
      return {
        name: asString(record.name).trim(),
        excerpt: asString(record.excerpt).slice(0, MAX_DOCUMENT_TEXT_LENGTH),
        content: asString(record.content).slice(0, MAX_DOCUMENT_TEXT_LENGTH),
      };
    })
    .filter((entry) => entry.name || entry.excerpt || entry.content);
}

function mergeIntakeWithDocuments(
  input: LitigationIntakeInput,
  documents: LitigationUploadedDocumentInput[],
): LitigationIntakeInput {
  if (documents.length === 0) {
    return input;
  }

  const extractedFromDocuments = extractStructuredSectionsFromText(
    documents
      .map((entry) => [entry.excerpt, entry.content].filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n'),
  );

  return {
    caseSummary: input.caseSummary || extractedFromDocuments.caseSummary || '',
    claims: input.claims || extractedFromDocuments.claims || '',
    witnesses: input.witnesses || extractedFromDocuments.witnesses || '',
    evidence: [input.evidence, extractedFromDocuments.evidence || ''].filter(Boolean).join('\n'),
    timeline: input.timeline || extractedFromDocuments.timeline || '',
  };
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
  const mergedInput = mergeIntakeWithDocuments(intake, documents);
  const preferences = normalizePreferences(bodyRecord.preferences);
  const draft = parseIntakeDraft(mergedInput, preferences);

  return res.status(200).json({
    message: `Parsed intake for ${preferences.objective} into ${draft.claims.length} claims, ${draft.evidence.length} evidence items, ${draft.witnesses.length} witnesses, and ${draft.timeline.length} timeline events.`,
    draft,
  });
}
