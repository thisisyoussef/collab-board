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
    headers: { authorization: 'Bearer test-token' },
    body: {
      boardId: 'board-1',
      intake: {
        caseSummary: 'Plaintiff alleges design defect and delayed warnings.',
        claims: '- Design defect\n- Failure to warn',
        witnesses: '- Dr. Lee: Alarm frequency increased (Dep. 44:12-45:3)',
        evidence: '- Ex.12 Internal Memo at p.3',
        timeline: '- Mar 2024: Repeated alarms',
      },
      preferences: {
        objective: 'board_overview',
        includeClaims: true,
        includeEvidence: true,
        includeWitnesses: true,
        includeTimeline: true,
      },
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

describe('AI Intake-to-Board API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApps.mockReturnValue([{}]);
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-123' });
    mockBoardGet.mockResolvedValue({
      exists: true,
      data: () => ({ ownerId: 'user-123', sharing: { visibility: 'private' } }),
    });
    mockMemberGet.mockResolvedValue({
      exists: false,
      data: () => ({}),
    });
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

      return {
        doc: () => ({ get: vi.fn() }),
      };
    });
  });

  it('returns 405 for non-POST requests', async () => {
    const handler = (await import('../../api/ai/intake-to-board')).default;
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 when boardId is missing', async () => {
    const handler = (await import('../../api/ai/intake-to-board')).default;
    const req = createMockReq({ body: { intake: {} } });
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 when authorization token is missing', async () => {
    const handler = (await import('../../api/ai/intake-to-board')).default;
    const req = createMockReq({ headers: {} });
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for viewer role access', async () => {
    mockBoardGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ ownerId: 'owner-123', sharing: { visibility: 'private' } }),
    });
    mockMemberGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'viewer' }),
    });

    const handler = (await import('../../api/ai/intake-to-board')).default;
    const req = createMockReq();
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns parsed draft for valid intake input', async () => {
    const handler = (await import('../../api/ai/intake-to-board')).default;
    const req = createMockReq();
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.draft.claims.length).toBeGreaterThan(0);
    expect(payload.draft.evidence.length).toBeGreaterThan(0);
    expect(payload.draft.witnesses.length).toBeGreaterThan(0);
  });

  it('applies include-section filters from preferences', async () => {
    const handler = (await import('../../api/ai/intake-to-board')).default;
    const req = createMockReq({
      body: {
        boardId: 'board-1',
        intake: {
          caseSummary: 'Case summary for chronology lane only.',
          claims: '- Design defect',
          witnesses: '- Dr. Lee: Alarm issue',
          evidence: '- Ex.12 Internal Memo',
          timeline: '- Mar 2024: Repeated alarms',
        },
        preferences: {
          objective: 'chronology',
          includeClaims: false,
          includeEvidence: false,
          includeWitnesses: false,
          includeTimeline: true,
        },
      },
    });
    const res = createMockRes();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.draft.claims).toHaveLength(0);
    expect(payload.draft.evidence).toHaveLength(0);
    expect(payload.draft.witnesses).toHaveLength(0);
    expect(payload.draft.timeline.length).toBeGreaterThan(0);
  });
});
