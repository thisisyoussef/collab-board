export type BoardObjectType = 'sticky' | 'rect';

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
  zIndex: number;
  createdBy: string;
  updatedAt: string;
}

export type BoardObjectsRecord = Record<string, BoardObject>;
