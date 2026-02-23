import { useCallback, useMemo, useRef, useState } from 'react';
import { logger } from '../lib/logger';
import type { ExecutableAIAction } from '../types/ai';
import type { BoardObject } from '../types/board';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContradictionCitation {
  page?: string;
  line?: string;
  ref: string;
}

export interface ContradictionSource {
  objectId: string;
  label: string;
  quote: string;
  citation: ContradictionCitation;
}

export interface ContradictionCandidate {
  id: string;
  topic: string;
  confidence: number;
  rationale: string;
  sourceA: ContradictionSource;
  sourceB: ContradictionSource;
}

export type ContradictionDecision = 'accepted' | 'rejected';

interface UseContradictionRadarOptions {
  boardId?: string;
  user?: { getIdToken: () => Promise<string> } | null;
  endpoint?: string;
}

export interface UseContradictionRadarResult {
  loading: boolean;
  error: string | null;
  candidates: ContradictionCandidate[];
  confidenceThreshold: number;
  setConfidenceThreshold: (value: number) => void;
  filteredCandidates: ContradictionCandidate[];
  decisions: Map<string, ContradictionDecision>;
  accept: (id: string) => void;
  reject: (id: string) => void;
  acceptedCandidates: ContradictionCandidate[];
  runRadar: (selectedNodeIds: string[]) => Promise<void>;
  applyAccepted: () => ExecutableAIAction[];
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContradictionRadar({
  boardId,
  user,
  endpoint = '/api/ai/contradictions',
}: UseContradictionRadarOptions): UseContradictionRadarResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ContradictionCandidate[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [decisions, setDecisions] = useState<Map<string, ContradictionDecision>>(new Map());
  const loadingRef = useRef(false);

  const filteredCandidates = useMemo(
    () => candidates.filter((c) => c.confidence >= confidenceThreshold),
    [candidates, confidenceThreshold],
  );

  const acceptedCandidates = useMemo(
    () => filteredCandidates.filter((c) => decisions.get(c.id) === 'accepted'),
    [filteredCandidates, decisions],
  );

  const runRadar = useCallback(
    async (selectedNodeIds: string[]) => {
      if (loadingRef.current) return;
      if (!boardId) {
        setError('Board is unavailable.');
        return;
      }

      loadingRef.current = true;
      setLoading(true);
      setError(null);
      setDecisions(new Map());

      logger.info('AI', `Running contradiction radar on ${selectedNodeIds.length} nodes`, {
        boardId,
        nodeCount: selectedNodeIds.length,
      });

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
            // Token retrieval failure should not block
          }
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ boardId, selectedNodeIds }),
        });

        const payload = await response.json();

        if (!response.ok) {
          const errMsg = payload?.error || 'Contradiction analysis failed.';
          setError(errMsg);
          setCandidates([]);
          return;
        }

        const nextCandidates: ContradictionCandidate[] = Array.isArray(payload.candidates)
          ? payload.candidates
          : [];

        setCandidates(nextCandidates);
        logger.info('AI', `Received ${nextCandidates.length} contradiction candidates`, {
          boardId,
          candidateCount: nextCandidates.length,
        });
      } catch {
        setError('Unable to run contradiction analysis right now.');
        setCandidates([]);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [boardId, endpoint, user],
  );

  const accept = useCallback((id: string) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(id, 'accepted');
      return next;
    });
  }, []);

  const reject = useCallback((id: string) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(id, 'rejected');
      return next;
    });
  }, []);

  const applyAccepted = useCallback((): ExecutableAIAction[] => {
    const actions: ExecutableAIAction[] = [];
    const now = new Date().toISOString();

    for (const candidate of acceptedCandidates) {
      const cardId = `contradiction-${candidate.id}-${Date.now()}`;

      // Create contradiction card (sticky note)
      const card: BoardObject = {
        id: cardId,
        type: 'sticky',
        x: 0,
        y: 0,
        width: 220,
        height: 140,
        rotation: 0,
        color: '#E57373',
        text: `${candidate.topic}\n\n${candidate.rationale}`,
        nodeRole: 'claim',
        zIndex: 1,
        createdBy: 'ai-agent',
        updatedAt: now,
      };
      actions.push({ kind: 'create', object: card });

      // Create connector from sourceA to contradiction card
      const connA: BoardObject = {
        id: `conn-${candidate.id}-a-${Date.now()}`,
        type: 'connector',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        color: '#E57373',
        fromId: candidate.sourceA.objectId,
        toId: cardId,
        relationType: 'contradicts',
        label: 'contradicts',
        zIndex: 0,
        createdBy: 'ai-agent',
        updatedAt: now,
      };
      actions.push({ kind: 'create', object: connA });

      // Create connector from sourceB to contradiction card
      const connB: BoardObject = {
        id: `conn-${candidate.id}-b-${Date.now()}`,
        type: 'connector',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        color: '#E57373',
        fromId: candidate.sourceB.objectId,
        toId: cardId,
        relationType: 'contradicts',
        label: 'contradicts',
        zIndex: 0,
        createdBy: 'ai-agent',
        updatedAt: now,
      };
      actions.push({ kind: 'create', object: connB });
    }

    return actions;
  }, [acceptedCandidates]);

  const reset = useCallback(() => {
    setCandidates([]);
    setDecisions(new Map());
    setError(null);
    setLoading(false);
    loadingRef.current = false;
  }, []);

  return {
    loading,
    error,
    candidates,
    confidenceThreshold,
    setConfidenceThreshold,
    filteredCandidates,
    decisions,
    accept,
    reject,
    acceptedCandidates,
    runRadar,
    applyAccepted,
    reset,
  };
}
