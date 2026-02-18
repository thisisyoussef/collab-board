import type { User } from 'firebase/auth';
import { useCallback, useRef, useState } from 'react';
import type { BoardObjectsRecord } from '../types/board';
import type {
  AIActionPreview,
  AIApplyMode,
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
  setPrompt: (value: string) => void;
  setMode: (mode: AIApplyMode) => void;
  submitPrompt: () => Promise<AICommandRunResult | null>;
  retryLast: () => Promise<AICommandRunResult | null>;
  clearResult: () => void;
}

export interface AICommandRunResult {
  message: string | null;
  actions: AIActionPreview[];
}

function readStoredMode(): AIApplyMode {
  if (typeof window === 'undefined') {
    return 'preview';
  }

  const value = window.localStorage.getItem(AI_MODE_STORAGE_KEY);
  return value === 'auto' ? 'auto' : 'preview';
}

function persistMode(mode: AIApplyMode) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AI_MODE_STORAGE_KEY, mode);
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

  return 'Unable to generate an AI plan right now.';
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
  const loadingRef = useRef(false);
  const lastPromptRef = useRef('');

  const setMode = useCallback((nextMode: AIApplyMode) => {
    setModeState(nextMode);
    persistMode(nextMode);
  }, []);

  const runPrompt = useCallback(
    async (nextPrompt: string): Promise<AICommandRunResult | null> => {
      if (loadingRef.current) {
        return null;
      }

      const trimmedPrompt = nextPrompt.trim();
      if (!trimmedPrompt) {
        setError('Enter a prompt before generating a plan.');
        return null;
      }

      if (!boardId) {
        setError('Board is unavailable. Reload and try again.');
        return null;
      }

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
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
            // Token retrieval failures should not block preview-only UX.
          }
        }

        const requestBody: {
          prompt: string;
          boardId: string;
          boardState?: BoardObjectsRecord;
        } = {
          prompt: trimmedPrompt,
          boardId,
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
          setError(parseApiError(response.status, payload.error));
          setMessage(null);
          setActions([]);
          return null;
        }

        const nextActions = normalizeToolCalls(payload.toolCalls);
        const nextMessage =
          typeof payload.message === 'string' && payload.message.trim()
            ? payload.message.trim()
            : nextActions.length === 0
              ? 'No actionable changes were suggested.'
              : `Prepared ${nextActions.length} action${nextActions.length === 1 ? '' : 's'}.`;

        setActions(nextActions);
        setMessage(nextMessage);
        lastPromptRef.current = trimmedPrompt;
        return {
          message: nextMessage,
          actions: nextActions,
        };
      } catch {
        setError('Unable to generate an AI plan right now.');
        setMessage(null);
        setActions([]);
        return null;
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [boardId, endpoint, getBoardState, user],
  );

  const submitPrompt = useCallback(async () => {
    return runPrompt(prompt);
  }, [prompt, runPrompt]);

  const retryLast = useCallback(async () => {
    const fallbackPrompt = prompt.trim() || lastPromptRef.current;
    if (!fallbackPrompt) {
      setError('Enter a prompt before retrying.');
      return null;
    }

    return runPrompt(fallbackPrompt);
  }, [prompt, runPrompt]);

  const clearResult = useCallback(() => {
    setPrompt('');
    setError(null);
    setMessage(null);
    setActions([]);
  }, []);

  return {
    prompt,
    mode,
    loading,
    error,
    message,
    actions,
    setPrompt,
    setMode,
    submitPrompt,
    retryLast,
    clearResult,
  };
}
