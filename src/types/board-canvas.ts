// Canvas-specific types used by Board.tsx and its helper modules.
// Includes Konva stage refs, selection state, connector interaction state,
// and various callback signatures for the canvas event system.
import type Konva from 'konva';
import type { BoardObjectsRecord } from './board';
import type { ObjectCreatePayload, ObjectDeletePayload, ObjectUpdatePayload } from './realtime';

export interface EditingTextState {
  id: string;
  value: string;
}

export interface ShapeDraftState {
  id: string;
  startX: number;
  startY: number;
  type: 'rect' | 'circle' | 'line';
  hasMoved: boolean;
  historyBefore: BoardObjectsRecord;
}

export interface ConnectorDraftState {
  id: string;
  startX: number;
  startY: number;
  historyBefore: BoardObjectsRecord;
}

export interface SelectionDraftState {
  startX: number;
  startY: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoardCanvasNode = Konva.Group | Konva.Shape;
export type ConnectorEndpoint = 'from' | 'to';

export interface ConnectorAttachmentResult {
  objectId: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  attachmentMode: 'side-center' | 'arbitrary';
}

export interface ConnectorAttachmentCandidate extends ConnectorAttachmentResult {
  distance: number;
}

export interface ConnectorShapeAnchorMarker {
  key: string;
  objectId: string;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  endpoint: ConnectorEndpoint | null;
}

export interface ConnectorAnchorIgnore {
  objectId: string;
  anchorX: number;
  anchorY: number;
}

export interface ConnectorHoverLockState {
  connectorId: string;
  endpoint: ConnectorEndpoint;
  objectId: string;
  startedAt: number;
  pointer: { x: number; y: number };
}

export interface BoardDocData {
  ownerId?: string;
  createdBy?: string;
  title?: string;
  objects?: BoardObjectsRecord;
  sharing?: {
    visibility?: string;
    authLinkRole?: string;
    publicLinkRole?: string;
  };
}

export type PendingRemoteObjectEvent =
  | { kind: 'create'; payload: ObjectCreatePayload }
  | { kind: 'update'; payload: ObjectUpdatePayload }
  | { kind: 'delete'; payload: ObjectDeletePayload };
