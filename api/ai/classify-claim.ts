import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const MODEL = process.env.CLAIM_CLASSIFY_MODEL || 'claude-3-5-haiku-latest';

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
  let prompt = `Classify the following legal claim as "weak", "moderate", or "strong" based on its supporting and contradicting evidence.\n\n`;
  prompt += `## Claim\n"${claimText}"\n\n`;

  if (nodes.length > 0) {
    prompt += `## Connected Nodes\n`;
    for (const node of nodes) {
      prompt += `- [${node.role}] (${node.relationToClaim}): "${node.text}"\n`;
    }
    prompt += '\n';
  } else {
    prompt += `No connected evidence, witnesses, or timeline events.\n\n`;
  }

  prompt += `Respond with ONLY a JSON object: {"level": "weak"|"moderate"|"strong", "reason": "<1-2 sentence explanation>"}`;
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
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: 'You are a litigation analysis assistant. Classify claim strength based on available evidence. Always respond with valid JSON only.',
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
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 500) : 'No explanation provided.';

    res.status(200).json({ level, reason });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Classification failed: ${message}` });
  }
}
