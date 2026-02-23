import type { User } from 'firebase/auth';
import { useCallback, useMemo, useRef, useState } from 'react';
import { logger } from '../lib/logger';
import type { BoardObjectsRecord } from '../types/board';
import type {
  AIActionPreview,
  AIApplyMode,
  AIConversationMessage,
  AIGenerateResponse,
  AIGenerateToolCall,
} from '../types/ai';

const AI_MODE_STORAGE_KEY = 'collab-board-ai-apply-mode';

interface UseAICommandCenterOptions {
  boardId?: string;
  user?: User | null;
  getBoardState?: () => BoardObjectsRecord;
  endpoint?: string;
}

interface UseAICommandCenterResult {
  prompt: string;
  mode: AIApplyMode;
  loading: boolean;
  error: string | null;
  message: string | null;
  actions: AIActionPreview[];
  quickActions: string[];
  quickActionsLoading: boolean;
  quickActionsError: string | null;
  conversation: AIConversationMessage[];
  lastRequestLatencyMs: number | null;
  averageRequestLatencyMs: number;
  setPrompt: (value: string) => void;
  setMode: (mode: AIApplyMode) => void;
  submitPrompt: () => Promise<AICommandRunResult | null>;
  submitPromptWithText: (value: string) => Promise<AICommandRunResult | null>;
  refreshQuickActions: (seedPrompt?: string) => Promise<string[]>;
  retryLast: () => Promise<AICommandRunResult | null>;
  clearResult: () => void;
}

export interface AICommandRunResult {
  message: string | null;
  actions: AIActionPreview[];
}

function readStoredMode(): AIApplyMode {
  if (typeof window === 'undefined') {
    return 'auto';
  }

  const value = window.localStorage.getItem(AI_MODE_STORAGE_KEY);
  return value === 'auto' ? 'auto' : 'auto';
}

function persistMode(mode: AIApplyMode) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedMode = mode === 'auto' ? 'auto' : 'auto';
  window.localStorage.setItem(AI_MODE_STORAGE_KEY, normalizedMode);
}

function parseApiError(status: number, payloadError: string | undefined): string {
  const message = payloadError?.trim();
  if (message) {
    return message;
  }

  if (status === 401) {
    return 'You must be signed in to use AI on this board.';
  }

  if (status === 429) {
    return 'AI is rate-limited. Please retry in a moment.';
  }

  return 'Unable to generate right now.';
}

function summarizeToolInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input).slice(0, 3);
  if (entries.length === 0) {
    return 'No parameters provided.';
  }

  return entries
    .map(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return `${key}=${value}`;
      }

      if (value === null || value === undefined) {
        return `${key}=null`;
      }

      if (Array.isArray(value)) {
        return `${key}=[${value.length}]`;
      }

      return `${key}={...}`;
    })
    .join(' · ');
}

function normalizeToolCalls(toolCalls: AIGenerateToolCall[] | undefined): AIActionPreview[] {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  return toolCalls
    .map((call, index) => {
      const name = typeof call?.name === 'string' && call.name.trim() ? call.name.trim() : 'unknown_action';
      const input =
        call?.input && typeof call.input === 'object' && !Array.isArray(call.input)
          ? (call.input as Record<string, unknown>)
          : {};

      return {
        id: typeof call?.id === 'string' && call.id.trim() ? call.id : `${name}-${index}`,
        name,
        summary: summarizeToolInput(input),
        input,
      };
    })
    .filter((entry) => entry.name !== 'unknown_action' || Object.keys(entry.input).length > 0);
}

function normalizeQuickActions(quickActions: string[] | undefined): string[] {
  if (!Array.isArray(quickActions)) {
    return [];
  }

  const deduped = new Set<string>();
  quickActions.forEach((action) => {
    if (typeof action !== 'string') {
      return;
    }

    const normalized = action.trim();
    if (!normalized || normalized.length > 96) {
      return;
    }
    deduped.add(normalized);
  });

  return Array.from(deduped).slice(0, 4);
}

function createConversationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildConversationSeed(): AIConversationMessage[] {
  return [
    {
      id: 'assistant-welcome',
      role: 'assistant',
      text: 'I can help you generate a litigation board, map contradictions, and organize evidence chains.',
      createdAt: Date.now(),
    },
  ];
}

function normalizeConversationPayload(conversation: AIConversationMessage[]): Array<{
  role: 'user' | 'assistant';
  text: string;
}> {
  return conversation
    .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
    .map((entry) => ({
      role: entry.role,
      text: entry.text,
    }))
    .filter((entry) => entry.text.trim().length > 0)
    .slice(-12);
}

async function parseJsonPayload(response: Response): Promise<AIGenerateResponse> {
  try {
    const payload = (await response.json()) as AIGenerateResponse;
    if (payload && typeof payload === 'object') {
      return payload;
    }
  } catch {
    // no-op
  }

  return {};
}

export function useAICommandCenter({
  boardId,
  user,
  getBoardState,
  endpoint = '/api/ai/generate',
}: UseAICommandCenterOptions): UseAICommandCenterResult {
  const [prompt, setPrompt] = useState('');
  const [mode, setModeState] = useState<AIApplyMode>(() => readStoredMode());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actions, setActions] = useState<AIActionPreview[]>([]);
  const [quickActions, setQuickActions] = useState<string[]>([]);
  const [quickActionsLoading, setQuickActionsLoading] = useState(false);
  const [quickActionsError, setQuickActionsError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<AIConversationMessage[]>(() => buildConversationSeed());
  const loadingRef = useRef(false);
  const quickActionsLoadingRef = useRef(false);
  const lastPromptRef = useRef('');
  const conversationRef = useRef<AIConversationMessage[]>(buildConversationSeed());
  const [lastRequestLatencyMs, setLastRequestLatencyMs] = useState<number | null>(null);
  const latencyHistoryRef = useRef<number[]>([]);

  const appendConversation = useCallback((entry: AIConversationMessage) => {
    setConversation((previous) => {
      const next = [...previous, entry].slice(-20);
      conversationRef.current = next;
      return next;
    });
  }, []);

  const setMode = useCallback((nextMode: AIApplyMode) => {
    const normalizedMode = nextMode === 'auto' ? 'auto' : 'auto';
    setModeState(normalizedMode);
    persistMode(normalizedMode);
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (user && typeof user.getIdToken === 'function') {
      try {
        const token = await user.getIdToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        logger.warn('AI', 'Could not retrieve auth token for AI request, continuing without auth');
      }
    }

    return headers;
  }, [user]);

  const refreshQuickActions = useCallback(
    async (seedPrompt?: string): Promise<string[]> => {
      if (quickActionsLoadingRef.current) {
        return quickActions;
      }

      if (!boardId) {
        setQuickActionsError('Board is unavailable. Reload and try again.');
        return [];
      }

      const basePrompt =
        (typeof seedPrompt === 'string' && seedPrompt.trim()) ||
        prompt.trim() ||
        lastPromptRef.current ||
        'Suggest next litigation board actions based on the current case map.';

      quickActionsLoadingRef.current = true;
      setQuickActionsLoading(true);
      setQuickActionsError(null);

      try {
        const headers = await getAuthHeaders();
        const requestBody: {
          intent: 'quick_actions';
          prompt: string;
          boardId: string;
          conversation?: Array<{ role: 'user' | 'assistant'; text: string }>;
          boardState?: BoardObjectsRecord;
        } = {
          intent: 'quick_actions',
          prompt: basePrompt,
          boardId,
          conversation: normalizeConversationPayload(conversationRef.current),
        };

        if (getBoardState) {
          try {
            requestBody.boardState = getBoardState();
          } catch {
            requestBody.boardState = undefined;
          }
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
        const payload = await parseJsonPayload(response);

        if (!response.ok) {
          const errMsg = parseApiError(response.status, payload.error);
          setQuickActionsError(errMsg);
          return [];
        }

        const nextQuickActions = normalizeQuickActions(payload.quickActions);
        setQuickActions(nextQuickActions);
        return nextQuickActions;
      } catch {
        setQuickActionsError('Unable to generate quick actions right now.');
        return [];
      } finally {
        quickActionsLoadingRef.current = false;
        setQuickActionsLoading(false);
      }
    },
    [boardId, endpoint, getAuthHeaders, getBoardState, prompt, quickActions],
  );

  const runPrompt = useCallback(
    async (nextPrompt: string): Promise<AICommandRunResult | null> => {
      if (loadingRef.current) {
        return null;
      }

      const trimmedPrompt = nextPrompt.trim();
      if (!trimmedPrompt) {
        setError('Enter a message before generating.');
        return null;
      }

      if (!boardId) {
        setError('Board is unavailable. Reload and try again.');
        return null;
      }

      loadingRef.current = true;
      setLoading(true);
      setError(null);
      appendConversation({
        id: createConversationId('user'),
        role: 'user',
        text: trimmedPrompt,
        createdAt: Date.now(),
      });

      logger.info('AI', `Sending AI prompt: '${trimmedPrompt.slice(0, 60)}${trimmedPrompt.length > 60 ? '...' : ''}' (${trimmedPrompt.length} chars)`, {
        boardId,
        promptLength: trimmedPrompt.length,
      });

      const requestStartMs = Date.now();

      try {
        const headers = await getAuthHeaders();

        const requestBody: {
          prompt: string;
          boardId: string;
          conversation?: Array<{ role: 'user' | 'assistant'; text: string }>;
          boardState?: BoardObjectsRecord;
        } = {
          prompt: trimmedPrompt,
          boardId,
          conversation: normalizeConversationPayload(conversationRef.current),
        };

        if (getBoardState) {
          try {
            requestBody.boardState = getBoardState();
          } catch {
            requestBody.boardState = undefined;
          }
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        const payload = await parseJsonPayload(response);
        const requestLatencyMs = Date.now() - requestStartMs;
        setLastRequestLatencyMs(requestLatencyMs);
        latencyHistoryRef.current.push(requestLatencyMs);
        if (latencyHistoryRef.current.length > 10) {
          latencyHistoryRef.current.shift();
        }
        logger.info('AI', `AI request completed in ${requestLatencyMs}ms`, { requestLatencyMs, boardId });

        if (!response.ok) {
          const errMsg = parseApiError(response.status, payload.error);
          logger.error('AI', `AI request failed (HTTP ${response.status}): ${errMsg}`, {
            status: response.status,
            boardId,
          });
          setError(errMsg);
          setMessage(null);
          setActions([]);
          return null;
        }

        const nextActions = normalizeToolCalls(payload.toolCalls);
        const nextQuickActions = normalizeQuickActions(payload.quickActions);
        const nextMessage =
          typeof payload.message === 'string' && payload.message.trim()
            ? payload.message.trim()
            : nextActions.length === 0
              ? 'No actionable changes were suggested.'
              : `Prepared ${nextActions.length} action${nextActions.length === 1 ? '' : 's'}.`;

        if (nextActions.length === 0) {
          logger.warn('AI', 'AI returned no actionable changes', { message: nextMessage });
        } else {
          logger.info('AI', `AI response received: ${nextActions.length} action(s)`, {
            actionCount: nextActions.length,
            actionNames: nextActions.map((a) => a.name),
            message: nextMessage,
          });
        }

        setActions(nextActions);
        if (nextQuickActions.length > 0) {
          setQuickActions(nextQuickActions);
          setQuickActionsError(null);
        }
        setMessage(nextMessage);
        lastPromptRef.current = trimmedPrompt;
        appendConversation({
          id: createConversationId('assistant'),
          role: 'assistant',
          text: nextMessage,
          actionCount: nextActions.length,
          createdAt: Date.now(),
        });
        return {
          message: nextMessage,
          actions: nextActions,
        };
      } catch {
        logger.error('AI', 'AI request failed: network error', { boardId });
        const failureMessage = 'Unable to generate right now. Please retry.';
        setError(failureMessage);
        appendConversation({
          id: createConversationId('assistant'),
          role: 'assistant',
          text: failureMessage,
          createdAt: Date.now(),
        });
        setMessage(null);
        setActions([]);
        return null;
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [appendConversation, boardId, endpoint, getAuthHeaders, getBoardState],
  );

  const submitPrompt = useCallback(async () => {
    return runPrompt(prompt);
  }, [prompt, runPrompt]);

  const submitPromptWithText = useCallback(
    async (value: string) => {
      const nextValue = value.trim();
      if (!nextValue) {
        setError('Enter a message before generating.');
        return null;
      }
      setPrompt(nextValue);
      return runPrompt(nextValue);
    },
    [runPrompt],
  );

  const retryLast = useCallback(async () => {
    const fallbackPrompt = prompt.trim() || lastPromptRef.current;
    if (!fallbackPrompt) {
      setError('Enter a message before retrying.');
      return null;
    }

    return runPrompt(fallbackPrompt);
  }, [prompt, runPrompt]);

  const clearResult = useCallback(() => {
    setPrompt('');
    setError(null);
    setMessage(null);
    setActions([]);
    setQuickActions([]);
    setQuickActionsError(null);
    const seed = buildConversationSeed();
    setConversation(seed);
    conversationRef.current = seed;
  }, []);

  const averageRequestLatencyMs = useMemo(() => {
    const history = latencyHistoryRef.current;
    if (history.length === 0) return 0;
    return Math.round(history.reduce((sum, v) => sum + v, 0) / history.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRequestLatencyMs]);

  return {
    prompt,
    mode,
    loading,
    error,
    message,
    actions,
    quickActions,
    quickActionsLoading,
    quickActionsError,
    conversation,
    lastRequestLatencyMs,
    averageRequestLatencyMs,
    setPrompt,
    setMode,
    submitPrompt,
    submitPromptWithText,
    refreshQuickActions,
    retryLast,
    clearResult,
  };
}
