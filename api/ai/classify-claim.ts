import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const CLAIM_CLASSIFY_MODEL_FALLBACK = 'claude-sonnet-4-20250514';
const CLAIM_CLASSIFY_MODEL_LEGACY_FALLBACK = 'claude-3-5-haiku-latest';

function getFirebasePrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return undefined;
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

function ensureFirebaseAdmin(): void {
  if (getApps().length > 0) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKey();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured');
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

function extractBearerToken(req: VercelRequest): string | null {
  const value = req.headers.authorization;
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function sanitizeModelName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getModelCandidates(): string[] {
  const values = [
    process.env.CLAIM_CLASSIFY_MODEL,
    process.env.ANTHROPIC_MODEL_SIMPLE,
    process.env.ANTHROPIC_MODEL,
    process.env.ANTHROPIC_MODEL_COMPLEX,
    CLAIM_CLASSIFY_MODEL_FALLBACK,
    CLAIM_CLASSIFY_MODEL_LEGACY_FALLBACK,
  ];

  const unique = new Set<string>();
  for (const value of values) {
    const model = sanitizeModelName(value);
    if (model) unique.add(model);
  }
  return Array.from(unique);
}

function isModelNotFoundError(err: unknown): boolean {
  const candidate = err as { status?: unknown; message?: unknown; error?: { type?: unknown } };
  if (candidate?.status === 404) {
    return true;
  }
  if (candidate?.error?.type === 'not_found_error') {
    return true;
  }
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  return message.includes('not_found_error') && message.includes('model');
}

interface ConnectedNode {
  id: string;
  role: string;
  text: string;
  relationToClaim: string;
}

interface ClassifyRequest {
  boardId: string;
  claimId: string;
  claimText: string;
  connectedNodes: ConnectedNode[];
}

type ClaimLevel = 'weak' | 'moderate' | 'strong';

function isValidLevel(value: unknown): value is ClaimLevel {
  return value === 'weak' || value === 'moderate' || value === 'strong';
}

function buildPrompt(claimText: string, nodes: ConnectedNode[]): string {
  let prompt = `You are an expert litigation analyst. Classify the strength of the following legal claim as "weak", "moderate", or "strong".\n\n`;
  prompt += `## Claim\n"${claimText}"\n\n`;

  if (nodes.length > 0) {
    prompt += `## Connected Evidence & Context\n`;
    for (const node of nodes) {
      prompt += `- [${node.role}] (${node.relationToClaim}): "${node.text}"\n`;
    }
    prompt += '\n';
  } else {
    prompt += `No connected evidence, witnesses, or timeline events.\n\n`;
  }

  prompt += `## Instructions\n`;
  prompt += `Evaluate the claim holistically — don't just count links. Consider:\n`;
  prompt += `- **Quality of support**: Is the evidence specific, credible, and directly relevant? A single strong piece of evidence (e.g., a signed contract) can outweigh multiple weak ones.\n`;
  prompt += `- **Severity of contradictions**: A vague or tangential contradiction barely weakens the claim, while a direct factual rebuttal with evidence is devastating. Judge the actual substance.\n`;
  prompt += `- **Dependency gaps**: Are there critical elements the claim relies on that haven't been established?\n`;
  prompt += `- **Logical coherence**: Does the claim and its evidence tell a consistent, compelling story?\n\n`;
  prompt += `Respond with ONLY a JSON object: {"level": "weak"|"moderate"|"strong", "reason": "<1-2 sentence explanation referencing the specific evidence>"}`;
  return prompt;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).json({});
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return;
  }

  try {
    ensureFirebaseAdmin();
    await getAuth().verifyIdToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid auth token' });
    return;
  }

  const body = req.body as Partial<ClassifyRequest>;
  if (!body.claimText || typeof body.claimText !== 'string' || !body.claimId) {
    res.status(400).json({ error: 'Missing required fields: claimId, claimText' });
    return;
  }

  const connectedNodes: ConnectedNode[] = Array.isArray(body.connectedNodes) ? body.connectedNodes : [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'AI provider not configured' });
    return;
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const models = getModelCandidates();

    let lastError: unknown = null;
    for (const model of models) {
      try {
        const message = await anthropic.messages.create({
          model,
          max_tokens: 400,
          system: 'You are an expert litigation analyst. Evaluate claim strength by reading and reasoning about the actual substance of evidence and contradictions — not just counting links. A weak contradiction with no backing should barely affect strength, while a direct rebuttal with documentary proof is significant. Always respond with valid JSON only.',
          messages: [{ role: 'user', content: buildPrompt(body.claimText, connectedNodes) }],
        });

        const textBlock = message.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          res.status(500).json({ error: 'No text response from AI' });
          return;
        }

        let jsonText = textBlock.text.trim();
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1].trim();
        }

        const parsed = JSON.parse(jsonText);
        const level = isValidLevel(parsed.level) ? parsed.level : 'moderate';
        const reason =
          typeof parsed.reason === 'string'
            ? parsed.reason.slice(0, 500)
            : 'No explanation provided.';

        res.status(200).json({ level, reason });
        return;
      } catch (err) {
        lastError = err;
        if (isModelNotFoundError(err)) {
          continue;
        }
        throw err;
      }
    }

    throw lastError ?? new Error('No valid model candidates configured');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Classification failed: ${message}` });
  }
}
