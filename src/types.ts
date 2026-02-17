export interface BoardObject {
  id: string;
  type: 'sticky' | 'rect' | 'circle' | 'text' | 'frame' | 'connector';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text?: string;
  color: string;
  fontSize?: number;
  zIndex: number;
  createdBy: string;
  updatedAt: string; // ISO string for last-write-wins
  fromId?: string;
  toId?: string;
  connectorStyle?: 'arrow' | 'line';
}

export interface CursorData {
  userId: string;
  x: number;
  y: number;
  color: string;
  name: string;
  sentAt: number; // Date.now() timestamp
}

export interface PresenceMember {
  clientId: string;
  name: string;
  color: string;
}

export interface BoardDocument {
  ownerId: string;
  title: string;
  createdAt: unknown; // serverTimestamp
  updatedAt: unknown; // serverTimestamp
  objects: Record<string, BoardObject>;
}
