import { useCallback, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { logger } from '../lib/logger';
import type { BoardObject, ClaimStrengthLevel } from '../types/board';

const DEBOUNCE_MS = 3000;
const ENDPOINT = '/api/ai/classify-claim';

export interface ClaimSubgraph {
  claimId: string;
  claimText: string;
  connectedNodes: Array<{
    id: string;
    role: string;
    text: string;
    relationToClaim: string;
  }>;
}

/**
 * Extract the claim's text and all directly connected nodes with their relations.
 * Returns null if the objectId is not a claim.
 */
export function buildClaimSubgraph(
  claimId: string,
  objects: Map<string, BoardObject>,
): ClaimSubgraph | null {
  const claim = objects.get(claimId);
  if (!claim || claim.type === 'connector' || claim.nodeRole !== 'claim') {
    return null;
  }

  const connectedNodes: ClaimSubgraph['connectedNodes'] = [];

  objects.forEach((obj) => {
    if (obj.type !== 'connector' || !obj.relationType) return;

    // Connector points TO this claim: the source node is connected
    if (obj.toId === claimId && obj.fromId) {
      const source = objects.get(obj.fromId);
      if (source && source.type !== 'connector' && source.nodeRole) {
        connectedNodes.push({
          id: source.id,
          role: source.nodeRole,
          text: source.text || source.title || '',
          relationToClaim: obj.relationType,
        });
      }
    }

    // Connector points FROM this claim (e.g., depends_on)
    if (obj.fromId === claimId && obj.toId) {
      const target = objects.get(obj.toId);
      if (target && target.type !== 'connector' && target.nodeRole) {
        connectedNodes.push({
          id: target.id,
          role: target.nodeRole,
          text: target.text || target.title || '',
          relationToClaim: obj.relationType,
        });
      }
    }
  });

  return {
    claimId,
    claimText: claim.text || claim.title || '',
    connectedNodes,
  };
}

/**
 * Hash a subgraph to detect meaningful changes (avoids re-classifying identical state).
 */
function hashSubgraph(subgraph: ClaimSubgraph): string {
  const parts = [subgraph.claimText];
  for (const node of subgraph.connectedNodes) {
    parts.push(`${node.id}:${node.role}:${node.relationToClaim}:${node.text}`);
  }
  return parts.join('|');
}

interface UseClaimClassificationOptions {
  boardId?: string;
  user?: User | null;
  objectsRef: React.RefObject<Map<string, BoardObject>>;
  boardRevision: number;
  onClassified: (claimId: string, level: ClaimStrengthLevel, reason: string) => void;
}

/**
 * Reactively classifies claims via LLM when their subgraph changes.
 * Debounces 3s after the last relevant change.
 */
export function useClaimClassification({
  boardId,
  user,
  objectsRef,
  boardRevision,
  onClassified,
}: UseClaimClassificationOptions) {
  const pendingRef = useRef(new Set<string>());
  const hashCacheRef = useRef(new Map<string, string>());
  const debounceTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const classifyClaim = useCallback(
    async (claimId: string) => {
      if (!boardId || !user || !objectsRef.current) return;

      const subgraph = buildClaimSubgraph(claimId, objectsRef.current);
      if (!subgraph) return;

      // Skip if subgraph hasn't changed since last classification
      const hash = hashSubgraph(subgraph);
      if (hashCacheRef.current.get(claimId) === hash) return;

      pendingRef.current.add(claimId);

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          const token = await user.getIdToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {
          logger.warn('AI', 'Could not retrieve auth token for claim classification');
        }

        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            boardId,
            claimId: subgraph.claimId,
            claimText: subgraph.claimText,
            connectedNodes: subgraph.connectedNodes,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          logger.warn('AI', `Claim classification failed: ${res.status}`, err);
          return;
        }

        const data = await res.json();
        if (data.level && typeof data.reason === 'string') {
          hashCacheRef.current.set(claimId, hash);
          onClassified(claimId, data.level, data.reason);
        }
      } catch (err) {
        logger.warn('AI', 'Network error during claim classification', { error: String(err) });
      } finally {
        pendingRef.current.delete(claimId);
      }
    },
    [boardId, user, objectsRef, onClassified],
  );

  // On every board revision, scan for claims whose subgraph changed and schedule classification
  useEffect(() => {
    if (!objectsRef.current) return;

    const claimIds: string[] = [];
    objectsRef.current.forEach((obj) => {
      if (obj.type !== 'connector' && obj.nodeRole === 'claim') {
        claimIds.push(obj.id);
      }
    });

    for (const claimId of claimIds) {
      const subgraph = buildClaimSubgraph(claimId, objectsRef.current);
      if (!subgraph) continue;

      const hash = hashSubgraph(subgraph);
      if (hashCacheRef.current.get(claimId) === hash) continue;

      // Clear existing timer for this claim and set a new debounced one
      const existing = debounceTimersRef.current.get(claimId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(claimId);
        void classifyClaim(claimId);
      }, DEBOUNCE_MS);

      debounceTimersRef.current.set(claimId, timer);
    }

    return () => {
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, [boardRevision, classifyClaim, objectsRef]);

  return { pendingClaimIds: pendingRef };
}
