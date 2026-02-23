import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeBoardRole, resolveBoardAccess } from '../../src/lib/access.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContradictionSource {
  objectId: string;
  label: string;
  quote: string;
  citation: { page?: string; line?: string; ref: string };
}

interface ContradictionCandidate {
  id: string;
  topic: string;
  confidence: number;
  rationale: string;
  sourceA: ContradictionSource;
  sourceB: ContradictionSource;
}

interface BoardDocData {
  ownerId?: string;
  createdBy?: string;
  sharing?: {
    visibility?: string;
    authLinkRole?: string;
    publicLinkRole?: string;
  };
  objects?: Record<string, BoardNodeData>;
  uploadedDocuments?: UploadedDocumentData[];
}

interface BoardNodeData {
  id: string;
  type: string;
  text?: string;
  title?: string;
  nodeRole?: string;
  fromId?: string;
  toId?: string;
  relationType?: string;
  label?: string;
  [key: string]: unknown;
}

interface UploadedDocumentData {
  name: string;
  excerpt?: string;
  content?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SELECTED_NODES = 30;
const MAX_CANDIDATES = 20;
const MIN_QUOTE_LENGTH = 10;
const MAX_DOCUMENT_CONTEXT_LENGTH = 50_000;
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// ---------------------------------------------------------------------------
// Firebase Admin helpers (same pattern as generate.ts / intake-to-board.ts)
// ---------------------------------------------------------------------------

function getFirebasePrivateKey(): string | null {
  const value = process.env.FIREBASE_PRIVATE_KEY;
  if (!value || typeof value !== 'string') return null;
  return value.replace(/\\n/g, '\n');
}

function ensureFirebaseAdmin() {
  if (getApps().length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured');
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function extractBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return null;
  return match[1].trim() || null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidSource(source: unknown): source is ContradictionSource {
  if (!source || typeof source !== 'object') return false;
  const s = source as Record<string, unknown>;
  if (typeof s.objectId !== 'string' || !s.objectId.trim()) return false;
  if (typeof s.quote !== 'string' || s.quote.trim().length < MIN_QUOTE_LENGTH) return false;
  if (!s.citation || typeof s.citation !== 'object') return false;
  const citation = s.citation as Record<string, unknown>;
  if (typeof citation.ref !== 'string' || !citation.ref.trim()) return false;
  return true;
}

function clampConfidence(value: unknown): number {
  const num = typeof value === 'number' ? value : 0;
  return Math.max(0, Math.min(1, num));
}

function validateCandidate(
  raw: unknown,
  selectedNodeIds: Set<string>,
  index: number,
): ContradictionCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;

  if (typeof entry.topic !== 'string' || !entry.topic.trim()) return null;
  if (typeof entry.rationale !== 'string') return null;
  if (!isValidSource(entry.sourceA)) return null;
  if (!isValidSource(entry.sourceB)) return null;

  const sourceA = entry.sourceA as ContradictionSource;
  const sourceB = entry.sourceB as ContradictionSource;

  // Reject same-source contradictions
  if (sourceA.objectId === sourceB.objectId) return null;

  // Reject if objectIds are not in selected nodes
  if (!selectedNodeIds.has(sourceA.objectId) || !selectedNodeIds.has(sourceB.objectId)) return null;

  return {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : `contradiction-${index}`,
    topic: entry.topic as string,
    confidence: clampConfidence(entry.confidence),
    rationale: entry.rationale as string,
    sourceA,
    sourceB,
  };
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

function buildPrompt(
  nodes: BoardNodeData[],
  edges: BoardNodeData[],
  documents: UploadedDocumentData[],
): string {
  const nodeDescriptions = nodes.map((n) => {
    const text = n.text || n.title || '';
    return `- [${n.id}] (${n.nodeRole || n.type}): ${text.slice(0, 500)}`;
  }).join('\n');

  const edgeDescriptions = edges.length > 0
    ? '\n\nExisting relationships:\n' + edges.map((e) => {
        return `- ${e.fromId} --${e.relationType || e.label || 'related'}--> ${e.toId}`;
      }).join('\n')
    : '';

  let documentContext = '';
  if (documents.length > 0) {
    let totalChars = 0;
    const docParts: string[] = [];
    for (const doc of documents) {
      const content = doc.content || doc.excerpt || '';
      if (!content) continue;
      const truncated = content.slice(0, Math.min(content.length, MAX_DOCUMENT_CONTEXT_LENGTH - totalChars));
      if (truncated.length === 0) break;
      docParts.push(`--- Document: ${doc.name} ---\n${truncated}`);
      totalChars += truncated.length;
      if (totalChars >= MAX_DOCUMENT_CONTEXT_LENGTH) break;
    }
    if (docParts.length > 0) {
      documentContext = '\n\nUploaded source documents:\n' + docParts.join('\n\n');
    }
  }

  return `Selected board nodes:\n${nodeDescriptions}${edgeDescriptions}${documentContext}

Analyze these sources for factual contradictions. For each contradiction found, identify the specific conflicting claims with direct quotes and source citations.

Return a JSON array of contradiction candidates. Each must have:
- id: unique string
- topic: short description of what is contradicted
- confidence: number 0-1 (how certain)
- rationale: explanation of the contradiction
- sourceA: { objectId, label, quote, citation: { page?, line?, ref } }
- sourceB: { objectId, label, quote, citation: { page?, line?, ref } }

Rules:
- sourceA.objectId and sourceB.objectId MUST be different and MUST match one of the provided node IDs
- Quotes must be direct text from the sources (minimum 10 characters)
- citation.ref is REQUIRED (the source document or node reference)
- Only report genuine factual contradictions, not differences in perspective or opinion
- Return empty array [] if no contradictions found

Return ONLY the JSON array, no other text.`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { boardId, selectedNodeIds } = req.body ?? {};

  if (!boardId || typeof boardId !== 'string' || !boardId.trim()) {
    return res.status(400).json({ error: 'Missing or invalid boardId' });
  }

  if (!Array.isArray(selectedNodeIds) || selectedNodeIds.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid selectedNodeIds' });
  }

  if (selectedNodeIds.length > MAX_SELECTED_NODES) {
    return res.status(400).json({ error: `Too many selected nodes (max ${MAX_SELECTED_NODES})` });
  }

  const trimmedBoardId = boardId.trim();

  // Auth
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

  // Fetch board and check access
  let boardData: BoardDocData;
  try {
    const firestore = getFirestore();
    const boardSnapshot = await firestore.collection('boards').doc(trimmedBoardId).get();
    if (!boardSnapshot.exists) {
      return res.status(404).json({ error: 'Board not found' });
    }

    boardData = (boardSnapshot.data() || {}) as BoardDocData;
    const membershipSnapshot = await firestore
      .collection('boardMembers')
      .doc(`${trimmedBoardId}_${actorUserId}`)
      .get();
    const memberRole = membershipSnapshot.exists
      ? normalizeBoardRole(membershipSnapshot.data()?.role)
      : null;

    const access = resolveBoardAccess({
      ownerId: boardData.ownerId || boardData.createdBy || null,
      userId: actorUserId,
      isAuthenticated: true,
      explicitMemberRole: memberRole,
      sharing: boardData.sharing ?? null,
    });

    if (!access.canApplyAI) {
      return res.status(403).json({ error: 'You do not have editor access for AI on this board.' });
    }
  } catch {
    return res.status(500).json({ error: 'Unable to validate board access' });
  }

  // Extract relevant data
  const objects = boardData.objects || {};
  const selectedSet = new Set(selectedNodeIds as string[]);
  const selectedNodes: BoardNodeData[] = [];
  const connectorEdges: BoardNodeData[] = [];

  for (const [id, obj] of Object.entries(objects)) {
    if (selectedSet.has(id)) {
      selectedNodes.push(obj);
    }
    if (obj.type === 'connector' && obj.fromId && obj.toId) {
      if (selectedSet.has(obj.fromId) || selectedSet.has(obj.toId)) {
        connectorEdges.push(obj);
      }
    }
  }

  const documents: UploadedDocumentData[] = Array.isArray(boardData.uploadedDocuments)
    ? boardData.uploadedDocuments
    : [];

  // Build prompt and call Claude
  const prompt = buildPrompt(selectedNodes, connectorEdges, documents);

  try {
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: 'You are a legal contradiction analyst. Your task is to find factual contradictions between sources. You must return ONLY valid JSON arrays. Be precise and cite exact quotes.',
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse response
    const textContent = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let rawCandidates: unknown[];
    try {
      const parsed = JSON.parse(textContent.trim());
      rawCandidates = Array.isArray(parsed) ? parsed : [];
    } catch {
      rawCandidates = [];
    }

    // Validate and filter
    const validated = rawCandidates
      .map((raw, i) => validateCandidate(raw, selectedSet, i))
      .filter((c): c is ContradictionCandidate => c !== null)
      .slice(0, MAX_CANDIDATES);

    return res.status(200).json({
      candidates: validated,
      message: validated.length === 0
        ? 'No contradictions found in the selected sources.'
        : `Found ${validated.length} potential contradiction${validated.length === 1 ? '' : 's'}.`,
    });
  } catch {
    return res.status(500).json({ error: 'Contradiction analysis failed' });
  }
}
