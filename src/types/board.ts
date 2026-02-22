export type BoardObjectType =
  | 'sticky'
  | 'rect'
  | 'circle'
  | 'line'
  | 'text'
  | 'frame'
  | 'connector';

export type BoardObjectStyle = 'arrow' | 'line' | 'dashed';
export type ConnectorStrokeStyle = 'solid' | 'dashed';
export type ConnectorPathType = 'straight' | 'bent' | 'curved';
export type ConnectorAttachmentMode = 'side-center' | 'arbitrary' | 'free';
export type ConnectorArrowHead = 'none' | 'solid' | 'line' | 'triangle' | 'diamond';
export type LitigationNodeRole = 'claim' | 'evidence' | 'witness' | 'timeline_event';
export type LitigationConnectorRelation = 'supports' | 'contradicts' | 'depends_on';

export interface BoardObject {
  id: string;
  type: BoardObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  radius?: number;
  points?: number[];
  title?: string;
  fromId?: string;
  toId?: string;
  fromAnchorX?: number;
  fromAnchorY?: number;
  toAnchorX?: number;
  toAnchorY?: number;
  fromAttachmentMode?: ConnectorAttachmentMode;
  toAttachmentMode?: ConnectorAttachmentMode;
  style?: BoardObjectStyle;
  strokeStyle?: ConnectorStrokeStyle;
  connectorType?: ConnectorPathType;
  startArrow?: ConnectorArrowHead;
  endArrow?: ConnectorArrowHead;
  label?: string;
  labelPosition?: number;
  labelBackground?: boolean;
  pathControlX?: number;
  pathControlY?: number;
  curveOffset?: number;
  nodeRole?: LitigationNodeRole;
  relationType?: LitigationConnectorRelation;
  zIndex: number;
  createdBy: string;
  updatedAt: string;
}

export type BoardObjectsRecord = Record<string, BoardObject>;
