import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeBoardRole, resolveBoardAccess } from '../../src/lib/access.js';
import type {
  ClaimStrengthRecommendation,
  ClaimStrengthRecommendationResponse,
} from '../../src/types/claim-strength-tools';
import type { BoardObject } from '../../src/types/board';

interface BoardDocData {
  ownerId?: string;
  createdBy?: string;
  sharing?: {
    visibility?: string;
    authLinkRole?: string;
    publicLinkRole?: string;
  };
  objects?: Record<string, Partial<BoardObject>>;
}

interface RecommendationToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

const MAX_CLAIMS = 8;
const MAX_RECOMMENDATIONS = 5;
const OPENAI_MODEL = process.env.CLAIM_STRENGTH_RECOMMENDER_MODEL || 'gpt-4o-mini';

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

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const rounded = Math.floor(parsed);
  return Math.min(max, Math.max(min, rounded));
}

function normalizeClaimIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const next: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(normalized);
  });
  return next.slice(0, MAX_CLAIMS);
}

function relationFromConnectorLabel(value: Partial<BoardObject>): string {
  if (value.relationType && typeof value.relationType === 'string') {
    return value.relationType;
  }
  const normalized = asString(value.label).trim().toLowerCase().replace(/\s+/g, '_');
  return normalized;
}

function computeClaimScore(objects: Record<string, Partial<BoardObject>>, claimId: string): number {
  const connectors = Object.values(objects).filter((entry) => entry?.type === 'connector');
  const supportCount = connectors.filter(
    (entry) => asString(entry.toId) === claimId && relationFromConnectorLabel(entry) === 'supports',
  ).length;
  const contradictionCount = connectors.filter(
    (entry) => asString(entry.toId) === claimId && relationFromConnectorLabel(entry) === 'contradicts',
  ).length;
  const dependencyEdges = connectors.filter(
    (entry) => asString(entry.fromId) === claimId && relationFromConnectorLabel(entry) === 'depends_on',
  );
  const unresolvedDependencyCount =
    dependencyEdges.length === 0
      ? 1
      : dependencyEdges.filter((entry) => {
          const toId = asString(entry.toId);
          const target = toId ? objects[toId] : undefined;
          return !target || target.type === 'connector' || typeof target.nodeRole !== 'string';
        }).length;

  const supportBonus = Math.min(40, supportCount * 10);
  const contradictionPenalty = Math.min(36, contradictionCount * 12);
  const dependencyPenalty = Math.min(30, unresolvedDependencyCount * 15);
  const score = 50 + supportBonus - contradictionPenalty - dependencyPenalty;
  return Math.max(0, Math.min(100, score));
}

function buildDeterministicToolCalls(
  claim: Partial<BoardObject>,
  claimId: string,
  objects: Record<string, Partial<BoardObject>>,
): RecommendationToolCall[] {
  const connectors = Object.values(objects).filter((entry) => entry?.type === 'connector');
  const existingSupportIds = new Set(
    connectors
      .filter(
        (entry) => asString(entry.toId) === claimId && relationFromConnectorLabel(entry) === 'supports',
      )
      .map((entry) => asString(entry.fromId))
      .filter(Boolean),
  );

  const supportCandidate = Object.values(objects).find((entry) => {
    if (!entry || entry.type === 'connector' || asString(entry.id) === claimId) {
      return false;
    }
    const role = asString(entry.nodeRole);
    if (role !== 'evidence' && role !== 'witness' && role !== 'timeline_event') {
      return false;
    }
    return !existingSupportIds.has(asString(entry.id));
  });

  if (supportCandidate && supportCandidate.id) {
    return [
      {
        id: `recommend-${claimId}-link`,
        name: 'createConnector',
        input: {
          fromId: supportCandidate.id,
          toId: claimId,
          relationType: 'supports',
          label: 'supports',
          connectorType: 'curved',
        },
      },
    ];
  }

  const newEvidenceId = `recommend-evidence-${claimId}`;
  return [
    {
      id: `recommend-${claimId}-sticky`,
      name: 'createStickyNote',
      input: {
        objectId: newEvidenceId,
        x: (Number(claim.x) || 0) + 360,
        y: Number(claim.y) || 0,
        color: '#E1F4E5',
        nodeRole: 'evidence',
        text: `Potential support evidence for ${asString(claim.text || claim.title || claimId)}.`,
      },
    },
    {
      id: `recommend-${claimId}-link`,
      name: 'createConnector',
      input: {
        fromId: newEvidenceId,
        toId: claimId,
        relationType: 'supports',
        label: 'supports',
        connectorType: 'curved',
      },
    },
  ];
}

async function buildAIRationaleIfAvailable(
  claimLabel: string,
  currentScore: number,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content:
            'You are a litigation strategy assistant. Return one concise recommendation sentence.',
        },
        {
          role: 'user',
          content: `Claim: ${claimLabel}\nCurrent score: ${currentScore}\nRecommend one concrete improvement.`,
        },
      ],
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }
    return text.slice(0, 300);
  } catch {
    return null;
  }
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

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  let actorUserId = '';
  try {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    actorUserId = asString(decoded.uid);
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const boardId = asString(req.body?.boardId).trim();
  const claimIds = normalizeClaimIds(req.body?.claimIds);
  const maxRecommendations = clampInt(req.body?.maxRecommendations, 3, 1, MAX_RECOMMENDATIONS);

  if (!boardId) {
    return res.status(400).json({ error: 'Missing boardId' });
  }
  if (claimIds.length === 0) {
    return res.status(400).json({ error: 'Missing claimIds' });
  }

  try {
    const firestore = getFirestore();
    const boardSnapshot = await firestore.collection('boards').doc(boardId).get();
    if (!boardSnapshot.exists) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const boardData = boardSnapshot.data() as BoardDocData;
    const ownerId = boardData.ownerId || boardData.createdBy || null;
    const memberSnapshot = await firestore
      .collection('boardMembers')
      .doc(`${boardId}_${actorUserId}`)
      .get();
    const memberRoleRaw = memberSnapshot.exists
      ? (memberSnapshot.data() as { role?: unknown }).role
      : null;
    const memberRole = normalizeBoardRole(memberRoleRaw);

    const access = resolveBoardAccess({
      ownerId,
      userId: actorUserId,
      isAuthenticated: true,
      explicitMemberRole: memberRole,
      sharing: boardData.sharing ?? null,
    });
    if (!access.canApplyAI) {
      return res.status(403).json({ error: 'You do not have editor access for AI on this board.' });
    }

    const objects = boardData.objects || {};
    const recommendations: ClaimStrengthRecommendation[] = [];

    for (const claimId of claimIds.slice(0, maxRecommendations)) {
      const claim = objects[claimId];
      if (!claim || claim.type === 'connector') {
        continue;
      }
      const claimLabel = asString(claim.text || claim.title).trim() || claimId;
      const currentScore = computeClaimScore(objects, claimId);
      const toolCalls = buildDeterministicToolCalls(claim, claimId, objects);
      const aiRationale = await buildAIRationaleIfAvailable(claimLabel, currentScore);
      const rationale =
        aiRationale ||
        `Increase support coverage for "${claimLabel}" by adding at least one direct supporting link.`;

      recommendations.push({
        claimId,
        claimLabel,
        currentScore,
        rationale,
        toolCalls,
      });
    }

    const payload: ClaimStrengthRecommendationResponse = {
      message: `Generated recommendations for ${recommendations.length} weak claim${recommendations.length === 1 ? '' : 's'}.`,
      recommendations,
    };
    return res.status(200).json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to generate recommendations: ${message}` });
  }
}

