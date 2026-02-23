import { useCallback, useRef, useState } from 'react';
import type { AIActionPreview, AIGenerateToolCall } from '../types/ai';
import type {
  ClaimStrengthRecommendation,
  ClaimStrengthRecommendationResponse,
} from '../types/claim-strength-tools';
import type { User } from 'firebase/auth';

interface UseClaimStrengthRecommendationsOptions {
  boardId?: string;
  user?: User | null;
  endpoint?: string;
}

interface UseClaimStrengthRecommendationsResult {
  loading: boolean;
  error: string | null;
  message: string | null;
  recommendations: ClaimStrengthRecommendation[];
  requestRecommendations: (claimIds: string[], maxRecommendations?: number) => Promise<boolean>;
  buildPreviewActions: () => AIActionPreview[];
  clear: () => void;
}

function parseToolCalls(toolCalls: AIGenerateToolCall[], recommendationId: string): AIActionPreview[] {
  return toolCalls
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      if (!name) {
        return null;
      }
      const input =
        entry.input && typeof entry.input === 'object' && !Array.isArray(entry.input)
          ? (entry.input as Record<string, unknown>)
          : {};
      return {
        id:
          typeof entry.id === 'string' && entry.id.trim()
            ? entry.id
            : `recommend-${recommendationId}-${name}-${index}`,
        name,
        summary: `Recommendation action: ${name}`,
        input,
      } satisfies AIActionPreview;
    })
    .filter((entry): entry is AIActionPreview => Boolean(entry));
}

function normalizeResponsePayload(value: unknown): ClaimStrengthRecommendationResponse {
  if (!value || typeof value !== 'object') {
    return { message: '', recommendations: [] };
  }
  const record = value as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message : '';
  const recommendations = Array.isArray(record.recommendations)
    ? (record.recommendations as ClaimStrengthRecommendation[])
    : [];
  return { message, recommendations };
}

export function useClaimStrengthRecommendations({
  boardId,
  user,
  endpoint = '/api/ai/claim-strength-recommendations',
}: UseClaimStrengthRecommendationsOptions): UseClaimStrengthRecommendationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ClaimStrengthRecommendation[]>([]);
  const loadingRef = useRef(false);

  const requestRecommendations = useCallback(
    async (claimIds: string[], maxRecommendations = 3): Promise<boolean> => {
      if (loadingRef.current) {
        return false;
      }
      if (!boardId) {
        setError('Board is unavailable. Reload and try again.');
        return false;
      }

      const sanitizedClaimIds = Array.from(
        new Set(claimIds.map((entry) => entry.trim()).filter(Boolean)),
      ).slice(0, 8);
      if (sanitizedClaimIds.length === 0) {
        setError('Select at least one claim before requesting recommendations.');
        return false;
      }

      loadingRef.current = true;
      setLoading(true);
      setError(null);
      setMessage(null);

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
            // no-op: endpoint still decides auth outcome.
          }
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            boardId,
            claimIds: sanitizedClaimIds,
            maxRecommendations,
          }),
        });
        const payload = normalizeResponsePayload(await response.json().catch(() => null));

        if (!response.ok) {
          setRecommendations([]);
          setError('Unable to generate claim-strength recommendations right now.');
          return false;
        }

        setRecommendations(payload.recommendations);
        setMessage(payload.message || `Generated ${payload.recommendations.length} recommendations.`);
        return true;
      } catch {
        setRecommendations([]);
        setError('Unable to generate claim-strength recommendations right now.');
        return false;
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [boardId, endpoint, user],
  );

  const buildPreviewActions = useCallback((): AIActionPreview[] => {
    const actions: AIActionPreview[] = [];
    recommendations.forEach((recommendation, recommendationIndex) => {
      const key = recommendation.claimId || `claim-${recommendationIndex}`;
      const normalized = parseToolCalls(recommendation.toolCalls || [], key);
      actions.push(...normalized);
    });
    return actions;
  }, [recommendations]);

  const clear = useCallback(() => {
    setError(null);
    setMessage(null);
    setRecommendations([]);
    setLoading(false);
    loadingRef.current = false;
  }, []);

  return {
    loading,
    error,
    message,
    recommendations,
    requestRecommendations,
    buildPreviewActions,
    clear,
  };
}

