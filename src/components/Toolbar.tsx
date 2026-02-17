import type { BoardObject } from '../types';
import {
  DEFAULT_STICKY_WIDTH,
  DEFAULT_STICKY_HEIGHT,
  DEFAULT_RECT_WIDTH,
  DEFAULT_RECT_HEIGHT,
  DEFAULT_STICKY_COLOR,
  DEFAULT_SHAPE_COLOR,
} from '../constants';

export type ToolType = 'select' | 'sticky' | 'rect';

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onCreateObject?: (obj: BoardObject) => void;
}

/**
 * Minimal toolbar — Select, Sticky, Rectangle.
 * Expanded in Phase 5 with color picker, delete, more shapes.
 */
export function Toolbar({ activeTool, onToolChange }: ToolbarProps) {
  const tools: { id: ToolType; label: string; icon: string }[] = [
    { id: 'select', label: 'Select', icon: '🔲' },
    { id: 'sticky', label: 'Sticky Note', icon: '📝' },
    { id: 'rect', label: 'Rectangle', icon: '⬜' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        background: '#fff',
        padding: '6px 8px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
      }}
    >
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={tool.label}
          style={{
            padding: '8px 12px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            background: activeTool === tool.id ? '#e3f2fd' : 'transparent',
            fontWeight: activeTool === tool.id ? 700 : 400,
          }}
        >
          {tool.icon} {tool.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Create a BoardObject template for the given tool type at position.
 */
export function createObjectForTool(
  tool: ToolType,
  position: { x: number; y: number },
  userId: string,
): BoardObject | null {
  const now = new Date().toISOString();
  const base = {
    id: crypto.randomUUID(),
    x: position.x,
    y: position.y,
    rotation: 0,
    zIndex: 0,
    createdBy: userId,
    updatedAt: now,
  };

  switch (tool) {
    case 'sticky':
      return {
        ...base,
        type: 'sticky',
        width: DEFAULT_STICKY_WIDTH,
        height: DEFAULT_STICKY_HEIGHT,
        color: DEFAULT_STICKY_COLOR,
        text: '',
        fontSize: 14,
      };
    case 'rect':
      return {
        ...base,
        type: 'rect',
        width: DEFAULT_RECT_WIDTH,
        height: DEFAULT_RECT_HEIGHT,
        color: DEFAULT_SHAPE_COLOR,
      };
    default:
      return null;
  }
}
