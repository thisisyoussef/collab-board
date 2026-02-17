import { useRef, useCallback } from 'react';
import type { BoardObject } from '../types';

interface UndoAction {
  type: 'create' | 'update' | 'delete';
  objectId: string;
  /** For create: the created object; for delete: the deleted object; for update: the NEW state */
  object?: BoardObject;
  /** For update: the PREVIOUS state before the change */
  previousState?: BoardObject;
}

const MAX_HISTORY = 50;

/**
 * Undo/redo stack for board actions.
 * Stores minimal action records — actual canvas mutations happen via callbacks.
 */
export function useUndoRedo() {
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);

  const pushAction = useCallback((action: UndoAction) => {
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
    // Clear redo on new action
    redoStackRef.current = [];
  }, []);

  const canUndo = useCallback(() => undoStackRef.current.length > 0, []);
  const canRedo = useCallback(() => redoStackRef.current.length > 0, []);

  const popUndo = useCallback((): UndoAction | undefined => {
    const action = undoStackRef.current.pop();
    if (action) {
      redoStackRef.current.push(action);
    }
    return action;
  }, []);

  const popRedo = useCallback((): UndoAction | undefined => {
    const action = redoStackRef.current.pop();
    if (action) {
      undoStackRef.current.push(action);
    }
    return action;
  }, []);

  return { pushAction, popUndo, popRedo, canUndo, canRedo };
}
