import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));
const mockOpenAIChatCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: { create: mockOpenAIChatCreate },
    },
  })),
}));
const mockWrapAnthropic = vi.fn((client) => client);
const mockTraceable = vi.fn((fn) => fn);
const mockAwaitPendingTraceBatches = vi.fn().mockResolvedValue(undefined);
vi.mock('langsmith', () => ({
  Client: vi.fn().mockImplementation(() => ({
    awaitPendingTraceBatches: mockAwaitPendingTraceBatches,
  })),
}));
vi.mock('langsmith/wrappers/anthropic', () => ({
  wrapAnthropic: mockWrapAnthropic,
}));
const mockWrapOpenAI = vi.fn((client) => client);
vi.mock('langsmith/wrappers/openai', () => ({
  wrapOpenAI: mockWrapOpenAI,
}));
vi.mock('langsmith/traceable', () => ({
  traceable: mockTraceable,
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
    mockAwaitPendingTraceBatches.mockResolvedValue(undefined);
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.LANGCHAIN_TRACING_V2;
    delete process.env.LANGCHAIN_API_KEY;
    delete process.env.LANGCHAIN_PROJECT;
    process.env.AI_PROVIDER_MODE = 'anthropic';
    delete process.env.AI_OPENAI_PERCENT;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_MODEL_SIMPLE;
    delete process.env.ANTHROPIC_MODEL_COMPLEX;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL_SIMPLE;
    delete process.env.OPENAI_MODEL_COMPLEX;
    delete process.env.AI_MAX_TOKENS_SIMPLE;
    delete process.env.AI_MAX_TOKENS_COMPLEX;
    delete process.env.AI_ALLOW_EXPERIMENT_OVERRIDES;
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

    it('returns 500 when no AI provider keys are configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
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
        provider: 'anthropic',
        model: 'claude-3-5-haiku-latest',
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

    it('returns AI-generated quick action chips when intent is quick_actions', async () => {
      process.env.AI_PROVIDER_MODE = 'openai';
      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                quickActions: [
                  'Map contradictions between key witness statements',
                  'Build a claim-evidence chain with weak-link flags',
                  'Generate a chronology from exhibits and testimony',
                  'Draft witness prep questions with citation anchors',
                  'Highlight weak links across claim dependency chains',
                  'Prepare opposing counsel counter-argument map',
                ],
              }),
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Suggest what to do next',
          boardId: 'board-1',
          boardState: {},
          intent: 'quick_actions',
          conversation: [
            { role: 'user', text: 'We need to prepare witness prep.' },
            { role: 'assistant', text: 'Understood.' },
          ],
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        quickActions: [
          'Map contradictions between key witness statements',
          'Build a claim-evidence chain with weak-link flags',
          'Generate a chronology from exhibits and testimony',
          'Draft witness prep questions with citation anchors',
        ],
        provider: 'openai',
        model: 'gpt-4o-mini',
        usedFallback: false,
      });
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
        provider: 'anthropic',
        model: 'claude-3-5-haiku-latest',
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
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Expose-Headers',
        'X-AI-Provider, X-AI-Model',
      );
    });
  });

  describe('Provider Routing', () => {
    it('uses OpenAI when AI_PROVIDER_MODE is openai', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'openai-1',
                  type: 'function',
                  function: {
                    name: 'createStickyNote',
                    arguments: JSON.stringify({ text: 'From OpenAI', x: 40, y: 50 }),
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockOpenAIChatCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        toolCalls: [
          {
            id: 'openai-1',
            name: 'createStickyNote',
            input: { text: 'From OpenAI', x: 40, y: 50 },
          },
        ],
        message: null,
        stopReason: 'tool_calls',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });
    });

    it('ignores non-function OpenAI tool calls and extracts array text content', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: [{ type: 'output_text', text: 'Plan drafted successfully.' }],
              tool_calls: [
                {
                  id: 'custom-1',
                  type: 'custom',
                  custom: { name: 'noop', input: '{}' },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        toolCalls: [],
        message: 'Plan drafted successfully.',
        stopReason: 'stop',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });
    });

    it('falls back to empty tool input when OpenAI function arguments are invalid JSON', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: 'getBoardState',
                    arguments: '{not valid json',
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        toolCalls: [
          {
            id: 'openai-tool-1',
            name: 'getBoardState',
            input: {},
          },
        ],
        message: null,
        stopReason: 'tool_calls',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });
    });

    it('uses OPENAI_MODEL_SIMPLE for non-complex prompts and OPENAI_MODEL_COMPLEX for complex prompts', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';
      process.env.OPENAI_MODEL_SIMPLE = 'gpt-4.1-nano';
      process.env.OPENAI_MODEL_COMPLEX = 'gpt-4.1';

      mockOpenAIChatCreate.mockResolvedValue({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'openai-tool',
                  type: 'function',
                  function: {
                    name: 'createStickyNote',
                    arguments: JSON.stringify({ text: 'From OpenAI', x: 40, y: 50 }),
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;

      const simpleReq = createMockReq({
        body: {
          prompt: 'Add one sticky note',
          boardId: 'board-1',
          boardState: {},
        },
      });
      const simpleRes = createMockRes();
      await handler(simpleReq as never, simpleRes as never);
      expect(simpleRes.status).toHaveBeenCalledWith(200);
      const simplePayload = mockOpenAIChatCreate.mock.calls[0][0] as { model: string };
      expect(simplePayload.model).toBe('gpt-4.1-nano');

      const complexReq = createMockReq({
        body: {
          prompt: 'Create a SWOT analysis template with 4 quadrants',
          boardId: 'board-1',
          boardState: {},
        },
      });
      const complexRes = createMockRes();
      await handler(complexReq as never, complexRes as never);
      expect(complexRes.status).toHaveBeenCalledWith(200);
      const complexPayload = mockOpenAIChatCreate.mock.calls[1][0] as { model: string };
      expect(complexPayload.model).toBe('gpt-4.1');
    });

    it('uses a lightweight token budget and prompt profile for simple OpenAI prompts', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'openai-simple-1',
                  type: 'function',
                  function: {
                    name: 'createShape',
                    arguments: JSON.stringify({ type: 'rect', x: 20, y: 30, width: 120, height: 80 }),
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Create one rectangle',
          boardId: 'board-1',
          boardState: {},
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = mockOpenAIChatCreate.mock.calls[0][0] as {
        max_tokens: number;
        messages: Array<{ role: string; content: string }>;
        tool_choice: unknown;
      };
      expect(payload.max_tokens).toBe(2048);
      expect(payload.messages[0].content).not.toContain('Template Instructions');
      expect(payload.tool_choice).toBe('auto');
    });

    it('always includes board-state context even for simple create prompts', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'openai-simple-2',
                  type: 'function',
                  function: {
                    name: 'createStickyNote',
                    arguments: JSON.stringify({ text: 'Fast', x: 20, y: 30 }),
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Add one sticky note saying hello',
          boardId: 'board-1',
          boardState: {
            'obj-1': { id: 'obj-1', type: 'sticky', text: 'Existing', x: 10, y: 10 },
          },
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = mockOpenAIChatCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
        tool_choice: unknown;
      };
      // Board state is now always included so the model can avoid overlaps
      expect(payload.messages[1].content).toContain('Current board objects:');
      expect(payload.tool_choice).toBe('auto');
    });

    it('keeps board-state context for simple prompts that target existing objects', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'openai-simple-3',
                  type: 'function',
                  function: {
                    name: 'moveObject',
                    arguments: JSON.stringify({ objectId: 'obj-1', x: 200, y: 220 }),
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Move the sticky note to x 200 y 220',
          boardId: 'board-1',
          boardState: {
            'obj-1': { id: 'obj-1', type: 'sticky', text: 'Existing', x: 10, y: 10 },
          },
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = mockOpenAIChatCreate.mock.calls[0][0] as {
        messages: Array<{ role: string; content: string }>;
        tool_choice: unknown;
      };
      expect(payload.messages[1].content).toContain('Current board objects:');
      expect(payload.messages[1].content).toContain('Move the sticky note to x 200 y 220');
      expect(payload.tool_choice).toBe('auto');
    });

    it('uses the complex token budget and template prompt profile for complex OpenAI prompts', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_PROVIDER_MODE = 'openai';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'openai-complex-1',
                  type: 'function',
                  function: {
                    name: 'createFrame',
                    arguments: JSON.stringify({
                      title: 'Strengths',
                      x: 100,
                      y: 100,
                      width: 400,
                      height: 300,
                    }),
                  },
                },
                {
                  id: 'openai-complex-2',
                  type: 'function',
                  function: {
                    name: 'createFrame',
                    arguments: JSON.stringify({
                      title: 'Weaknesses',
                      x: 550,
                      y: 100,
                      width: 400,
                      height: 300,
                    }),
                  },
                },
                {
                  id: 'openai-complex-3',
                  type: 'function',
                  function: {
                    name: 'createFrame',
                    arguments: JSON.stringify({
                      title: 'Opportunities',
                      x: 100,
                      y: 450,
                      width: 400,
                      height: 300,
                    }),
                  },
                },
                {
                  id: 'openai-complex-4',
                  type: 'function',
                  function: {
                    name: 'createFrame',
                    arguments: JSON.stringify({
                      title: 'Threats',
                      x: 550,
                      y: 450,
                      width: 400,
                      height: 300,
                    }),
                  },
                },
                {
                  id: 'openai-complex-5',
                  type: 'function',
                  function: {
                    name: 'createStickyNote',
                    arguments: JSON.stringify({
                      objectId: 'note-1',
                      text: 'Sample',
                      x: 150,
                      y: 150,
                    }),
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Create a SWOT analysis template with 4 quadrants',
          boardId: 'board-1',
          boardState: {},
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = mockOpenAIChatCreate.mock.calls[0][0] as {
        max_tokens: number;
        messages: Array<{ role: string; content: string }>;
      };
      expect(payload.max_tokens).toBe(4096);
      expect(payload.messages[0].content).toContain('Template Instructions');
    });

    it('allows provider and model overrides when experiments are enabled', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_ALLOW_EXPERIMENT_OVERRIDES = 'true';

      mockOpenAIChatCreate.mockResolvedValueOnce({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'openai-override-1',
                  type: 'function',
                  function: {
                    name: 'createShape',
                    arguments: JSON.stringify({ type: 'rect', x: 10, y: 20, width: 100, height: 80 }),
                  },
                },
              ],
            },
          },
        ],
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Create one rectangle',
          boardId: 'board-1',
          boardState: {},
          providerOverride: 'openai',
          modelOverride: 'gpt-4.1',
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockOpenAIChatCreate).toHaveBeenCalledTimes(1);
      const createPayload = mockOpenAIChatCreate.mock.calls[0][0] as { model: string };
      expect(createPayload.model).toBe('gpt-4.1');
      expect(res.setHeader).toHaveBeenCalledWith('X-AI-Provider', 'openai');
      expect(res.setHeader).toHaveBeenCalledWith('X-AI-Model', 'gpt-4.1');
    });

    it('rejects provider/model overrides when experiments are disabled', async () => {
      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Create one rectangle',
          boardId: 'board-1',
          boardState: {},
          providerOverride: 'openai',
          modelOverride: 'gpt-4.1',
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error:
          'Model/provider overrides are disabled. Set AI_ALLOW_EXPERIMENT_OVERRIDES=true to enable benchmarking overrides.',
      });
    });

    it('falls back to anthropic when openai mode is enabled but OPENAI_API_KEY is missing', async () => {
      vi.resetModules();
      process.env.ANTHROPIC_API_KEY = 'test-key';
      delete process.env.OPENAI_API_KEY;
      process.env.AI_PROVIDER_MODE = 'openai';

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'fallback-1',
            name: 'createStickyNote',
            input: { text: 'Fallback', x: 10, y: 20 },
          },
        ],
        stop_reason: 'tool_use',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockOpenAIChatCreate).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-AI-Provider', 'anthropic');
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

    it('returns 500 for unexpected errors when both providers fail', async () => {
      mockCreate.mockRejectedValue(new Error('Anthropic failure'));
      mockOpenAIChatCreate.mockRejectedValue(new Error('OpenAI failure'));

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

    it('exposes litigation node and relation fields for AI tool planning', async () => {
      mockCreate.mockResolvedValue({
        content: [],
        stop_reason: 'end_turn',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq({
        body: {
          prompt: 'Add evidence and link it to the claim',
          boardId: 'board-1',
          boardState: {},
        },
      });
      const res = createMockRes();

      await handler(req as never, res as never);

      const createCall = mockCreate.mock.calls[0][0];
      const stickyTool = createCall.tools.find((tool: { name: string }) => tool.name === 'createStickyNote');
      const connectorTool = createCall.tools.find((tool: { name: string }) => tool.name === 'createConnector');

      expect(stickyTool?.input_schema?.properties?.nodeRole?.enum).toEqual([
        'claim',
        'evidence',
        'witness',
        'timeline_event',
        'contradiction',
      ]);
      expect(connectorTool?.input_schema?.properties?.relationType?.enum).toEqual([
        'supports',
        'contradicts',
        'depends_on',
      ]);
    });
  });

  describe('LangSmith Tracing Wiring', () => {
    it('wraps anthropic and traceable pipeline when tracing env is enabled', async () => {
      vi.resetModules();
      mockWrapAnthropic.mockClear();
      mockWrapOpenAI.mockClear();
      mockTraceable.mockClear();

      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.LANGCHAIN_TRACING_V2 = 'true';
      process.env.LANGCHAIN_API_KEY = 'ls-test-key';
      process.env.LANGCHAIN_PROJECT = 'collab-board-test';

      mockCreate.mockResolvedValue({
        content: [],
        stop_reason: 'end_turn',
      });

      const handler = (await import('../../api/ai/generate')).default;
      const req = createMockReq();
      const res = createMockRes();

      await handler(req as never, res as never);

      expect(mockWrapAnthropic).toHaveBeenCalledTimes(1);
      expect(mockWrapOpenAI).toHaveBeenCalledTimes(1);
      expect(mockTraceable).toHaveBeenCalled();
      expect(mockAwaitPendingTraceBatches).toHaveBeenCalled();
    });
  });

  describe('Plan expansion logic (exported helpers)', () => {
    it('detects SWOT prompts as complex', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Create a SWOT analysis')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Make a swot template')).toBe(true);
    });

    it('detects retrospective prompts as complex', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Set up a retrospective board')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Create a retro with 3 columns')).toBe(true);
    });

    it('detects journey map prompts as complex', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Build a user journey map')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Create a journey with 5 stages')).toBe(true);
    });

    it('detects grid and layout prompts as complex', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Arrange in a grid')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Create 3 columns of stickies')).toBe(true);
    });

    it('detects numeric patterns as complex', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Create a board with 5 sections')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Include 3 sticky notes')).toBe(true);
    });

    it('does not flag explicit single-object commands as complex', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Add a sticky note')).toBe(false);
      expect(isLikelyComplexPlanPrompt('Create a rectangle')).toBe(false);
      expect(isLikelyComplexPlanPrompt('Add a circle')).toBe(false);
    });

    it('flags creative and open-ended prompts as complex', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Make a cat')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Draw a house with a garden')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Create a project plan')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Organize these by priority')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Change the color to green')).toBe(true);
    });

    it('treats single-primitive manipulation as simple', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      expect(isLikelyComplexPlanPrompt('Move the rectangle')).toBe(false);
      expect(isLikelyComplexPlanPrompt('Delete the connector')).toBe(false);
      expect(isLikelyComplexPlanPrompt('Resize the frame')).toBe(false);
    });

    it('routes all evaluation prompts correctly', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      // Simple evaluation prompts
      expect(isLikelyComplexPlanPrompt("Add a yellow sticky note that says 'User Research'")).toBe(false);
      expect(isLikelyComplexPlanPrompt('Create a blue rectangle at position 100, 200')).toBe(false);
      expect(isLikelyComplexPlanPrompt("Add a frame called 'Sprint Planning'")).toBe(false);
      expect(isLikelyComplexPlanPrompt('Change the sticky note color to green')).toBe(false);

      // Complex evaluation prompts
      expect(isLikelyComplexPlanPrompt('Move all the pink sticky notes to the right side')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Resize the frame to fit its contents')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Arrange these sticky notes in a grid')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Create a 2x3 grid of sticky notes for pros and cons')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Space these elements evenly')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Create a SWOT analysis template with four quadrants')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Build a user journey map with 5 stages')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Set up a retrospective board with What Went Well, What Didn\'t, and Action Items columns')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Draw a cat')).toBe(true);
    });

    it('uses exact-match cache for known prompts (case-insensitive)', async () => {
      const { isLikelyComplexPlanPrompt } = await import('../../api/ai/generate');
      // Cache should match regardless of case
      expect(isLikelyComplexPlanPrompt('CREATE A SWOT ANALYSIS')).toBe(true);
      expect(isLikelyComplexPlanPrompt('Add A Yellow Sticky Note That Says \'User Research\'')).toBe(false);
      expect(isLikelyComplexPlanPrompt('DRAW A CAT')).toBe(true);
      expect(isLikelyComplexPlanPrompt('  Create a SWOT analysis  ')).toBe(true);
      expect(isLikelyComplexPlanPrompt('ARRANGE THESE STICKY NOTES IN A GRID')).toBe(true);
      expect(isLikelyComplexPlanPrompt('ADD A STICKY NOTE')).toBe(false);
    });

    it('returns correct minimum tool calls for SWOT', async () => {
      const { getMinimumToolCallsForPrompt } = await import('../../api/ai/generate');
      expect(getMinimumToolCallsForPrompt('Create a SWOT analysis')).toBe(5);
    });

    it('returns correct minimum tool calls for retro', async () => {
      const { getMinimumToolCallsForPrompt } = await import('../../api/ai/generate');
      expect(getMinimumToolCallsForPrompt('Set up a retrospective board')).toBe(4);
    });

    it('returns correct minimum for NxM grid patterns', async () => {
      const { getMinimumToolCallsForPrompt } = await import('../../api/ai/generate');
      expect(getMinimumToolCallsForPrompt('Create a 2x3 grid of notes')).toBe(6);
      expect(getMinimumToolCallsForPrompt('Make a 3x3 matrix')).toBe(9);
    });

    it('returns correct minimum for N stages', async () => {
      const { getMinimumToolCallsForPrompt } = await import('../../api/ai/generate');
      expect(getMinimumToolCallsForPrompt('Build a journey with 5 stages')).toBe(5);
    });

    it('returns default minimum for generic complex prompts', async () => {
      const { getMinimumToolCallsForPrompt } = await import('../../api/ai/generate');
      expect(getMinimumToolCallsForPrompt('Create a workflow diagram')).toBe(2);
    });
  });
});
