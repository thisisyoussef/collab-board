import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  getAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: mockFirestoreCollection }),
}));

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer token-123' },
    body: {
      boardId: 'board-1',
      claimIds: ['claim-weak-1', 'claim-weak-2', 'claim-weak-3'],
      maxRecommendations: 3,
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

describe('AI Claim Strength Recommendations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApps.mockReturnValue([{}]);
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-123' });
    mockBoardGet.mockResolvedValue({
      exists: true,
      data: () => ({
        ownerId: 'user-123',
        sharing: { visibility: 'private' },
        objects: {
          'claim-weak-1': {
            id: 'claim-weak-1',
            type: 'sticky',
            text: 'Claim: Failure to warn',
            nodeRole: 'claim',
            x: 100,
            y: 100,
            width: 220,
            height: 130,
            rotation: 0,
            color: '#DCE8FF',
            zIndex: 1,
            createdBy: 'user-123',
            updatedAt: '2026-02-23T00:00:00.000Z',
          },
          'evidence-1': {
            id: 'evidence-1',
            type: 'sticky',
            text: 'Evidence: Label revision log Ex.12',
            nodeRole: 'evidence',
            x: 500,
            y: 100,
            width: 220,
            height: 130,
            rotation: 0,
            color: '#E1F4E5',
            zIndex: 2,
            createdBy: 'user-123',
            updatedAt: '2026-02-23T00:00:00.000Z',
          },
        },
      }),
    });
    mockMemberGet.mockResolvedValue({ exists: false, data: () => ({}) });
    mockFirestoreCollection.mockImplementation((name: string) => {
      if (name === 'boards') {
        return { doc: () => ({ get: mockBoardGet }) };
      }
      if (name === 'boardMembers') {
        return { doc: () => ({ get: mockMemberGet }) };
      }
      return { doc: () => ({ get: vi.fn() }) };
    });
  });

  it('returns 405 for non-POST requests', async () => {
    const handler = (await import('../../api/ai/claim-strength-recommendations')).default;
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 401 when authorization is missing', async () => {
    const handler = (await import('../../api/ai/claim-strength-recommendations')).default;
    const req = createMockReq({ headers: {} });
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for viewer role access', async () => {
    mockBoardGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ ownerId: 'owner-123', sharing: { visibility: 'private' }, objects: {} }),
    });
    mockMemberGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'viewer' }),
    });

    const handler = (await import('../../api/ai/claim-strength-recommendations')).default;
    const req = createMockReq();
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns recommendation payload with constrained tool calls', async () => {
    const handler = (await import('../../api/ai/claim-strength-recommendations')).default;
    const req = createMockReq();
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(payload.message).toContain('Generated recommendations');
    expect(Array.isArray(payload.recommendations)).toBe(true);
    expect(payload.recommendations.length).toBeGreaterThan(0);
    expect(payload.recommendations[0].claimId).toBe('claim-weak-1');
    expect(Array.isArray(payload.recommendations[0].toolCalls)).toBe(true);
    expect(payload.recommendations[0].toolCalls.length).toBeGreaterThan(0);
  });
});

