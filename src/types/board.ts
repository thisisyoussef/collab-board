export type BoardObjectType =
  | 'sticky'
  | 'rect'
  | 'circle'
  | 'line'
  | 'text'
  | 'frame'
  | 'connector';

export type BoardObjectStyle = 'arrow' | 'line' | 'dashed';

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
  style?: BoardObjectStyle;
  zIndex: number;
  createdBy: string;
  updatedAt: string;
}

export type BoardObjectsRecord = Record<string, BoardObject>;
