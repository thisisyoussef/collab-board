import Konva from 'konva';
import type { BoardObject } from '../types';

/**
 * Factory: creates a Konva Group from a BoardObject.
 * Used for imperative adds from remote sync and board loading.
 */
export function createKonvaShape(obj: BoardObject): Konva.Group {
  const group = new Konva.Group({
    id: obj.id,
    x: obj.x,
    y: obj.y,
    rotation: obj.rotation,
    draggable: true,
  });

  switch (obj.type) {
    case 'sticky': {
      const rect = new Konva.Rect({
        width: obj.width,
        height: obj.height,
        fill: obj.color,
        cornerRadius: 4,
        shadowBlur: 4,
        shadowOpacity: 0.2,
        shadowColor: '#000',
        shadowOffsetY: 2,
      });
      const text = new Konva.Text({
        text: obj.text || '',
        width: obj.width,
        height: obj.height,
        padding: 8,
        fontSize: obj.fontSize || 14,
        fill: '#333',
        align: 'left',
        verticalAlign: 'top',
      });
      group.add(rect);
      group.add(text);
      break;
    }

    case 'rect': {
      const rect = new Konva.Rect({
        width: obj.width,
        height: obj.height,
        fill: obj.color,
        stroke: '#bbb',
        strokeWidth: 1,
        cornerRadius: 2,
      });
      group.add(rect);
      break;
    }

    case 'circle': {
      const circle = new Konva.Ellipse({
        radiusX: obj.width / 2,
        radiusY: obj.height / 2,
        offsetX: -obj.width / 2,
        offsetY: -obj.height / 2,
        fill: obj.color,
        stroke: '#bbb',
        strokeWidth: 1,
      });
      group.add(circle);
      break;
    }

    case 'text': {
      const text = new Konva.Text({
        text: obj.text || 'Text',
        fontSize: obj.fontSize || 16,
        fill: obj.color,
        width: obj.width,
      });
      group.add(text);
      break;
    }

    default: {
      // Fallback: basic rect
      const rect = new Konva.Rect({
        width: obj.width,
        height: obj.height,
        fill: obj.color || '#ccc',
        stroke: '#999',
        strokeWidth: 1,
      });
      group.add(rect);
      break;
    }
  }

  return group;
}

/**
 * Serialize all objects from the ref Map to a plain Record (for Firestore).
 */
export function serializeObjects(
  objectsRef: React.MutableRefObject<Map<string, BoardObject>>,
): Record<string, BoardObject> {
  const result: Record<string, BoardObject> = {};
  objectsRef.current.forEach((obj, id) => {
    result[id] = obj;
  });
  return result;
}
