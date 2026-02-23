import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => [{ name: 'mock' }]),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user-123' }),
  })),
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({ messages: { create: mockCreate } })),
}));

let handler: (req: VercelRequest, res: VercelResponse) => Promise<void>;

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const module = await import('../../api/ai/classify-claim');
  handler = module.default;
});

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: {
      boardId: 'board-1',
      claimId: 'claim-1',
      claimText: 'The defendant was at the scene',
      connectedNodes: [
        { id: 'ev-1', role: 'evidence', text: 'CCTV footage shows defendant', relationToClaim: 'supports' },
      ],
    },
    ...overrides,
  } as unknown as VercelRequest;
}

function makeRes(): VercelResponse & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null,
    _headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { res._headers[key] = value; return res; },
    status(code: number) { res._status = code; return res; },
    json(data: unknown) { res._json = data; return res; },
  } as unknown as VercelResponse & { _status: number; _json: unknown };
  return res;
}

describe('classify-claim endpoint', () => {
  it('returns 405 for non-POST requests', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 401 when no auth token provided', async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 400 when claimText is missing', async () => {
    const req = makeReq({ body: { boardId: 'b', claimId: 'c', connectedNodes: [] } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns classification on valid request', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"level":"strong","reason":"Supported by CCTV evidence."}' }],
    });

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json).toEqual(
      expect.objectContaining({ level: 'strong', reason: expect.any(String) }),
    );
  });
});
