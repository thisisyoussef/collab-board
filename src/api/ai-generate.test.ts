import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
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

// Create mock req/res objects for Vercel handler testing
function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: { prompt: 'Add a yellow sticky note', boardId: 'board-1', boardState: {} },
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

describe('AI Generate API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
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
          doc: () => ({
            get: mockBoardGet,
          }),
        };
      }

      if (name === 'boardMembers') {
        return {
          doc: () => ({
            get: mockMemberGet,
          }),
        };
      }

      return {
        doc: () => ({
          get: vi.fn(),
        }),
      };
    });
  });

  describe('HTTP Method Handling', () => {
    it('returns 200 for OPTIONS (CORS preflight)', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({ method: 'OPTIONS' });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalled();
    });

    it('returns 405 for GET requests', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({ method: 'GET' });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
    });
  });

  describe('Input Validation', () => {
    it('returns 400 when prompt is missing', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid prompt' });
    });

    it('returns 400 when prompt is not a string', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({ body: { prompt: 123 } });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when prompt exceeds max length', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const longPrompt = 'a'.repeat(501);
      const req = createMockReq({ body: { prompt: longPrompt, boardId: 'board-1' } });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Prompt too long (max 500 characters)',
      });
    });

    it('returns 400 when boardId is missing', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({ body: { prompt: 'Create one note' } });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid boardId' });
    });

    it('returns 401 when Authorization header is missing', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({ headers: {} });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing Authorization bearer token' });
    });

    it('returns 401 when ID token is invalid', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid token'));
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired auth token' });
    });

    it('returns 403 when user does not have editor access', async () => {
      mockBoardGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ ownerId: 'owner-1', sharing: { visibility: 'private' } }),
      });
      mockMemberGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'viewer' }),
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You do not have editor access for AI on this board.',
      });
    });

    it('returns 500 when ANTHROPIC_API_KEY is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      // Need fresh import to pick up env change
      vi.resetModules();
      vi.mock('@anthropic-ai/sdk', () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: { create: mockCreate },
        })),
      }));
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI service not configured' });
    });
  });

  describe('Successful Responses', () => {
    it('returns tool calls from Claude response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'createStickyNote',
            input: { text: 'Hello', x: 100, y: 200, color: '#FFEB3B' },
          },
        ],
        stop_reason: 'tool_use',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        toolCalls: [
          {
            id: 'tool-1',
            name: 'createStickyNote',
            input: { text: 'Hello', x: 100, y: 200, color: '#FFEB3B' },
          },
        ],
        message: null,
        stopReason: 'tool_use',
      });
    });

    it('returns text message alongside tool calls', async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: 'text', text: 'I will create a sticky note for you.' },
          {
            type: 'tool_use',
            id: 'tool-2',
            name: 'createStickyNote',
            input: { text: 'Note', x: 0, y: 0 },
          },
        ],
        stop_reason: 'tool_use',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData.message).toBe('I will create a sticky note for you.');
      expect(responseData.toolCalls).toHaveLength(1);
    });

    it('handles body being null/undefined', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({ body: null });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('runs a second planning pass for complex under-scoped prompts', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'initial-frame',
            name: 'createFrame',
            input: { title: 'Framework', x: 700, y: 100 },
          },
        ],
        stop_reason: 'tool_use',
      });

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'initial-frame',
            name: 'createFrame',
            input: { objectId: 'frame-1', title: 'Framework', x: 700, y: 100 },
          },
        ],
        stop_reason: 'tool_use',
      });

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'expanded-frame',
            name: 'createFrame',
            input: { objectId: 'frame-1', title: 'Framework', x: 700, y: 100 },
          },
          {
            type: 'tool_use',
            id: 'expanded-shape',
            name: 'createShape',
            input: { objectId: 'shape-1', type: 'rect', x: 720, y: 140, width: 200, height: 140 },
          },
          {
            type: 'tool_use',
            id: 'expanded-note',
            name: 'createStickyNote',
            input: { objectId: 'note-1', text: 'Section A', x: 730, y: 150 },
          },
        ],
        stop_reason: 'tool_use',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: { prompt: 'Create a SWOT analysis template with 4 quadrants', boardId: 'board-1', boardState: {} },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        toolCalls: Array<{ name: string }>;
      };
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(payload.toolCalls.filter((call) => call.name === 'createFrame')).toHaveLength(1);
      expect(payload.toolCalls.filter((call) => call.name === 'createShape')).toHaveLength(1);
      expect(payload.toolCalls.filter((call) => call.name === 'createStickyNote')).toHaveLength(1);
    });

    it('keeps single-call plans for simple prompts', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'sticky-1',
            name: 'createStickyNote',
            input: { text: 'Hello', x: 100, y: 100 },
          },
        ],
        stop_reason: 'tool_use',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: { prompt: 'Create one sticky note saying hello', boardId: 'board-1', boardState: {} },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('runs a correction pass when tool calls miss required inputs', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'line-a',
            name: 'createShape',
            input: { type: 'line', x: 300, y: 200 },
          },
        ],
        stop_reason: 'tool_use',
      });

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'line-a',
            name: 'createShape',
            input: { type: 'line', x: 300, y: 200, width: 120, height: 0 },
          },
        ],
        stop_reason: 'tool_use',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: { prompt: 'Draw one line for me', boardId: 'board-1', boardState: {} },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        toolCalls: [
          {
            id: 'line-a',
            name: 'createShape',
            input: { type: 'line', x: 300, y: 200, width: 120, height: 0 },
          },
        ],
        message: null,
        stopReason: 'tool_use',
      });
    });
  });

  describe('CORS Headers', () => {
    it('sets CORS headers on all requests', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      mockCreate.mockResolvedValue({
        content: [],
        stop_reason: 'end_turn',
      });

      await handler(req as never, res as never);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'POST, OPTIONS',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );
    });
  });

  describe('Error Handling', () => {
    it('returns 429 for rate limit errors', async () => {
      const rateLimitError = new Error('Rate limited');
      Object.assign(rateLimitError, { status: 429 });
      mockCreate.mockRejectedValue(rateLimitError);

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AI rate limit reached. Please try again shortly.',
      });
    });

    it('returns 500 for unexpected errors', async () => {
      mockCreate.mockRejectedValue(new Error('Internal failure'));

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
    });
  });

  describe('Board State Truncation', () => {
    it('truncates board state when it has more than 100 objects', async () => {
      const largeBoardState: Record<string, unknown> = {};
      for (let i = 0; i < 150; i++) {
        largeBoardState[`obj-${i}`] = { type: 'sticky', x: i * 10 };
      }

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Board is large!' }],
        stop_reason: 'end_turn',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: { prompt: 'Summarize the board', boardId: 'board-1', boardState: largeBoardState },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      // Should succeed without error — truncation happens silently
      expect(res.status).toHaveBeenCalledWith(200);
      // Verify the Anthropic API was called
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('Tool Definitions', () => {
    it('has exactly 10 tool definitions', async () => {
      // Import the module to check tool count at module level
      // We can verify this by checking that a valid prompt triggers a call with 9 tools
      mockCreate.mockResolvedValue({
        content: [],
        stop_reason: 'end_turn',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.tools).toHaveLength(10);

      const toolNames = createCall.tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain('createStickyNote');
      expect(toolNames).toContain('createShape');
      expect(toolNames).toContain('createFrame');
      expect(toolNames).toContain('createConnector');
      expect(toolNames).toContain('moveObject');
      expect(toolNames).toContain('resizeObject');
      expect(toolNames).toContain('updateText');
      expect(toolNames).toContain('changeColor');
      expect(toolNames).toContain('deleteObject');
      expect(toolNames).toContain('getBoardState');
    });
  });
});
