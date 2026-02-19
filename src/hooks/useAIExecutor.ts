import { useCallback, useRef, useState } from 'react';
import { buildAIActionPlanFromPreviews, executeAIActionPlan } from '../lib/ai-executor';
import { logger } from '../lib/logger';
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

      logger.info('AI', `Applying ${previews.length} AI action(s) to board`, {
        actionCount: previews.length,
        actionNames: previews.map((p) => p.name),
      });
      const applyStartMs = Date.now();

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
          logger.error('AI', `AI action execution failed: ${result.error}`);
          setError(`AI apply failed: ${result.error}`);
          return false;
        }

        const applyTimeMs = Date.now() - applyStartMs;
        logger.info('AI', `AI actions applied successfully: ${result.diff.createdIds.length} created, ${result.diff.updatedIds.length} updated, ${result.diff.deletedIds.length} deleted`, {
          txId: result.transaction.txId,
          createdCount: result.diff.createdIds.length,
          updatedCount: result.diff.updatedIds.length,
          deletedCount: result.diff.deletedIds.length,
          applyTimeMs,
        });
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
        logger.error('AI', `AI action execution failed: ${details}`);
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

    logger.info('AI', `Undoing AI transaction ${lastTransaction.txId} (${lastTransaction.inverseActions.length} inverse actions)`, {
      txId: lastTransaction.txId,
      actionCount: lastTransaction.inverseActions.length,
    });

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
        logger.error('AI', `AI undo failed: ${undoResult.error}`);
        setError(`Undo failed: ${undoResult.error}`);
        return false;
      }

      logger.info('AI', 'AI undo completed successfully', { txId: undoResult.transaction.txId });
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
