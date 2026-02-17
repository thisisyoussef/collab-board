import { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import Konva from 'konva';

interface SelectionManagerProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  selectedIds: string[];
}

/**
 * Konva Transformer for resize/rotate handles.
 * Per vite-react-konva skill: attach to selected nodes via stageRef.findOne.
 */
export function SelectionManager({ stageRef, selectedIds }: SelectionManagerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    const nodes = selectedIds
      .map((id) => stageRef.current!.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];

    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, stageRef]);

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        // Minimum size constraint
        if (newBox.width < 20 || newBox.height < 20) return oldBox;
        return newBox;
      }}
      rotateEnabled
      enabledAnchors={[
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'middle-left',
        'middle-right',
        'top-center',
        'bottom-center',
      ]}
    />
  );
}
