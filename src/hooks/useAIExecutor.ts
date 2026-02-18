import { useCallback, useRef, useState } from 'react';
import { buildAIActionPlanFromPreviews, executeAIActionPlan } from '../lib/ai-executor';
import type {
  AIActionPreview,
  AIExecutionDiff,
  AITransaction,
} from '../types/ai';
import type { BoardObjectsRecord } from '../types/board';

export interface AICommitMeta {
  txId: string;
  source: 'ai' | 'undo';
  diff: AIExecutionDiff;
  actionCount: number;
}

interface UseAIExecutorOptions {
  actorUserId: string;
  getBoardState: () => BoardObjectsRecord;
  commitBoardState: (nextBoardState: BoardObjectsRecord, meta: AICommitMeta) => void;
}

interface UseAIExecutorResult {
  applying: boolean;
  error: string | null;
  message: string | null;
  canUndo: boolean;
  lastTransactionId: string | null;
  applyPreviewActions: (previews: AIActionPreview[], message?: string | null) => Promise<boolean>;
  undoLast: () => Promise<boolean>;
  invalidateUndo: () => void;
}

export function useAIExecutor({
  actorUserId,
  getBoardState,
  commitBoardState,
}: UseAIExecutorOptions): UseAIExecutorResult {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<AITransaction | null>(null);
  const applyingRef = useRef(false);

  const applyPreviewActions = useCallback(
    async (previews: AIActionPreview[], planMessage?: string | null) => {
      if (applyingRef.current) {
        return false;
      }
      if (!Array.isArray(previews) || previews.length === 0) {
        setError('No AI actions are available to apply.');
        return false;
      }

      applyingRef.current = true;
      setApplying(true);
      setError(null);
      setMessage(null);

      try {
        const current = getBoardState();
        const plan = buildAIActionPlanFromPreviews({
          previews,
          context: {
            currentObjects: current,
            actorUserId,
          },
          message: planMessage ?? null,
        });
        const result = executeAIActionPlan({
          plan,
          currentObjects: current,
          actorUserId,
        });

        if (!result.ok) {
          setError(`AI apply failed: ${result.error}`);
          return false;
        }

        commitBoardState(result.nextObjects, {
          txId: result.transaction.txId,
          source: 'ai',
          diff: result.diff,
          actionCount: result.transaction.actions.length,
        });
        setLastTransaction(result.transaction);
        setMessage(
          `Applied ${result.transaction.actions.length} AI action${
            result.transaction.actions.length === 1 ? '' : 's'
          }.`,
        );
        return true;
      } catch (executionError) {
        const details = executionError instanceof Error ? executionError.message : 'Unknown error';
        setError(`AI apply failed: ${details}`);
        return false;
      } finally {
        applyingRef.current = false;
        setApplying(false);
      }
    },
    [actorUserId, commitBoardState, getBoardState],
  );

  const undoLast = useCallback(async () => {
    if (applyingRef.current) {
      return false;
    }
    if (!lastTransaction) {
      return false;
    }

    applyingRef.current = true;
    setApplying(true);
    setError(null);

    try {
      const current = getBoardState();
      const undoResult = executeAIActionPlan({
        plan: {
          planId: `undo-${lastTransaction.txId}`,
          actions: lastTransaction.inverseActions,
          message: null,
        },
        currentObjects: current,
        actorUserId,
      });

      if (!undoResult.ok) {
        setError(`Undo failed: ${undoResult.error}`);
        return false;
      }

      commitBoardState(undoResult.nextObjects, {
        txId: undoResult.transaction.txId,
        source: 'undo',
        diff: undoResult.diff,
        actionCount: lastTransaction.inverseActions.length,
      });
      setLastTransaction(null);
      setMessage('Undid last AI apply.');
      return true;
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }, [actorUserId, commitBoardState, getBoardState, lastTransaction]);

  const invalidateUndo = useCallback(() => {
    setLastTransaction(null);
    setError(null);
    setMessage(null);
  }, []);

  return {
    applying,
    error,
    message,
    canUndo: Boolean(lastTransaction) && !applying,
    lastTransactionId: lastTransaction?.txId ?? null,
    applyPreviewActions,
    undoLast,
    invalidateUndo,
  };
}
