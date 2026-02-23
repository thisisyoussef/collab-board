import type { BoardObject, BoardObjectType, BoardObjectsRecord } from './board';

export type AIApplyMode = 'preview' | 'auto';

export interface AIActionPreview {
  id: string;
  name: string;
  summary: string;
  input: Record<string, unknown>;
}

export interface AIConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  actionCount?: number;
}

export interface AIPanelState {
  prompt: string;
  mode: AIApplyMode;
  loading: boolean;
  error: string | null;
  message: string | null;
  actions: AIActionPreview[];
  conversation?: AIConversationMessage[];
  applying?: boolean;
  applyDisabled?: boolean;
  canUndo?: boolean;
  executionError?: string | null;
  executionMessage?: string | null;
}

export interface AIGenerateToolCall {
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface AIGenerateResponse {
  toolCalls?: AIGenerateToolCall[];
  message?: string | null;
  stopReason?: string | null;
  error?: string;
}

export type ExecutableAIAction =
  | { kind: 'create'; object: BoardObject }
  | { kind: 'update'; objectId: string; patch: Partial<BoardObject> }
  | { kind: 'delete'; objectId: string };

export interface AIActionPlan {
  planId: string;
  actions: ExecutableAIAction[];
  message: string | null;
}

export interface AITransaction {
  txId: string;
  actions: ExecutableAIAction[];
  inverseActions: ExecutableAIAction[];
  createdAt: number;
  actorUserId: string;
}

export interface AIExecutionDiff {
  createdIds: string[];
  updatedIds: string[];
  deletedIds: string[];
}

export interface AIExecutionSuccess {
  ok: true;
  nextObjects: BoardObjectsRecord;
  transaction: AITransaction;
  diff: AIExecutionDiff;
}

export interface AIExecutionFailure {
  ok: false;
  error: string;
  failedActionIndex?: number;
}

export type AIExecutionResult = AIExecutionSuccess | AIExecutionFailure;

export interface ToolCallToActionContext {
  currentObjects: BoardObjectsRecord;
  actorUserId: string;
}

export interface ToolCallToActionDependencies {
  createId?: () => string;
  nowMs?: () => number;
}

export type AIObjectCreateInput = {
  type: BoardObjectType;
} & Partial<BoardObject>;
