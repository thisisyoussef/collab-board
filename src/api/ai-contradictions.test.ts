import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

const mockVerifyIdToken = vi.fn();
const mockGetApps = vi.fn();
const mockBoardGet = vi.fn();
const mockMemberGet = vi.fn();
const mockFirestoreCollection = vi.fn();

vi.mock('firebase-admin/app', () => ({
  cert: vi.fn((value) => value),
  getApps: () => mockGetApps(),
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: mockFirestoreCollection,
  }),
}));

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: {
      boardId: 'board-1',
      selectedNodeIds: ['node-a', 'node-b'],
    },
    ...overrides,
  };
}

function createMockRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

function makeValidCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contra-1',
    topic: 'Timeline discrepancy',
    confidence: 0.85,
    rationale: 'Witness A says event occurred in March, while Exhibit B dates it to June.',
    sourceA: {
      objectId: 'node-a',
      label: 'Witness A deposition',
      quote: 'The meeting took place in early March 2025.',
      citation: { page: '12', line: '5', ref: 'Deposition Transcript A' },
    },
    sourceB: {
      objectId: 'node-b',
      label: 'Exhibit B email',
      quote: 'Per our June 2025 meeting discussions...',
      citation: { page: '1', ref: 'Exhibit B email chain' },
    },
    ...overrides,
  };
}

// Lazy-import to allow mocks to register first
let handler: (req: unknown, res: unknown) => Promise<unknown>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockGetApps.mockReturnValue([{ name: 'app' }]);
  mockVerifyIdToken.mockResolvedValue({ uid: 'user-123' });

  mockFirestoreCollection.mockImplementation((name: string) => {
    if (name === 'boards') {
      return {
        doc: () => ({ get: mockBoardGet }),
      };
    }
    if (name === 'boardMembers') {
      return {
        doc: () => ({ get: mockMemberGet }),
      };
    }
    return { doc: () => ({ get: vi.fn().mockResolvedValue({ exists: false }) }) };
  });

  mockBoardGet.mockResolvedValue({
    exists: true,
    data: () => ({
      ownerId: 'user-123',
      objects: {
        'node-a': {
          id: 'node-a',
          type: 'sticky',
          text: 'Witness A says meeting was in March.',
          nodeRole: 'witness',
          x: 0, y: 0, width: 150, height: 100, rotation: 0, color: '#FFEB3B', zIndex: 1,
          createdBy: 'user-123', updatedAt: new Date().toISOString(),
        },
        'node-b': {
          id: 'node-b',
          type: 'sticky',
          text: 'Exhibit B email references June meeting.',
          nodeRole: 'evidence',
          x: 200, y: 0, width: 150, height: 100, rotation: 0, color: '#64B5F6', zIndex: 2,
          createdBy: 'user-123', updatedAt: new Date().toISOString(),
        },
      },
    }),
  });
  mockMemberGet.mockResolvedValue({ exists: false });

  const module = await import('../../api/ai/contradictions');
  handler = module.default;
});

describe('AI Contradictions API Endpoint', () => {
  it('rejects requests without Authorization header (401)', async () => {
    const req = createMockReq({ headers: {} });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects requests with invalid auth token (401)', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects viewer role users (403)', async () => {
    mockBoardGet.mockResolvedValue({
      exists: true,
      data: () => ({
        ownerId: 'other-user',
        sharing: { visibility: 'private' },
        objects: {},
      }),
    });
    mockMemberGet.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'viewer' }),
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects missing boardId (400)', async () => {
    const req = createMockReq({ body: { selectedNodeIds: ['a'] } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects missing selectedNodeIds (400)', async () => {
    const req = createMockReq({ body: { boardId: 'board-1' } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects selectedNodeIds exceeding max (400)', async () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => `node-${i}`);
    const req = createMockReq({ body: { boardId: 'board-1', selectedNodeIds: tooMany } });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns validated contradiction candidates on success', async () => {
    const candidate = makeValidCandidate();
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify([candidate]),
        },
      ],
      stop_reason: 'end_turn',
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(responseBody.candidates).toHaveLength(1);
    expect(responseBody.candidates[0].topic).toBe('Timeline discrepancy');
    expect(responseBody.candidates[0].confidence).toBe(0.85);
  });

  it('filters out candidates with missing citation ref', async () => {
    const badCandidate = makeValidCandidate({
      sourceA: {
        objectId: 'node-a',
        label: 'Witness A',
        quote: 'Some testimony about the event.',
        citation: { page: '12', ref: '' },
      },
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify([badCandidate]) }],
      stop_reason: 'end_turn',
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(responseBody.candidates).toHaveLength(0);
  });

  it('filters out candidates where sourceA and sourceB have same objectId', async () => {
    const sameSource = makeValidCandidate({
      sourceB: {
        objectId: 'node-a',
        label: 'Same source',
        quote: 'A conflicting statement from same source.',
        citation: { ref: 'Ref B' },
      },
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify([sameSource]) }],
      stop_reason: 'end_turn',
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(responseBody.candidates).toHaveLength(0);
  });

  it('filters out candidates with quote too short', async () => {
    const shortQuote = makeValidCandidate({
      sourceA: {
        objectId: 'node-a',
        label: 'Short',
        quote: 'Hi',
        citation: { ref: 'Ref A' },
      },
    });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify([shortQuote]) }],
      stop_reason: 'end_turn',
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(responseBody.candidates).toHaveLength(0);
  });

  it('clamps confidence to 0..1 range', async () => {
    const overConfident = makeValidCandidate({ confidence: 1.5 });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify([overConfident]) }],
      stop_reason: 'end_turn',
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(responseBody.candidates[0].confidence).toBeLessThanOrEqual(1);
  });

  it('caps candidates at max 20', async () => {
    const candidates = Array.from({ length: 25 }, (_, i) =>
      makeValidCandidate({
        id: `contra-${i}`,
        sourceA: {
          objectId: 'node-a',
          label: `Source A ${i}`,
          quote: `Testimony about event variant ${i} from witness.`,
          citation: { ref: `Ref A-${i}` },
        },
        sourceB: {
          objectId: 'node-b',
          label: `Source B ${i}`,
          quote: `Contradicting testimony about event variant ${i}.`,
          citation: { ref: `Ref B-${i}` },
        },
      }),
    );
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(candidates) }],
      stop_reason: 'end_turn',
    });

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(responseBody.candidates.length).toBeLessThanOrEqual(20);
  });

  it('returns clean error on AI failure (500)', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('API timeout'));
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(responseBody.error).toBeTruthy();
  });

  it('handles OPTIONS for CORS preflight', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects non-POST methods (405)', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});
