import Konva from 'konva';
import type { BoardObject } from '../types';

/**
 * Viewport culling — hide off-screen objects for performance.
 * Per vite-react-konva skill: node.visible(false) for off-screen.
 */
export function updateVisibility(
  stage: Konva.Stage,
  objectsRef: React.MutableRefObject<Map<string, BoardObject>>,
) {
  const scale = stage.scaleX();
  const pos = stage.position();
  const margin = 200; // Extra margin to prevent pop-in

  const viewBounds = {
    x: -pos.x / scale - margin,
    y: -pos.y / scale - margin,
    width: stage.width() / scale + margin * 2,
    height: stage.height() / scale + margin * 2,
  };

  objectsRef.current.forEach((obj, id) => {
    const node = stage.findOne(`#${id}`);
    if (node) {
      const visible =
        obj.x + obj.width > viewBounds.x &&
        obj.x < viewBounds.x + viewBounds.width &&
        obj.y + obj.height > viewBounds.y &&
        obj.y < viewBounds.y + viewBounds.height;
      node.visible(visible);
    }
  });
}
