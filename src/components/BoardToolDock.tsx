export type BoardTool =
  | 'select'
  | 'sticky'
  | 'rect'
  | 'circle'
  | 'line'
  | 'text'
  | 'frame'
  | 'connector';

interface BoardToolDockProps {
  activeTool: BoardTool;
  canEditBoard: boolean;
  onSelectTool: (tool: BoardTool) => void;
}

interface ToolConfig {
  tool: BoardTool;
  label: string;
  icon: string;
  editRequired?: boolean;
}

const TOOLS: ToolConfig[] = [
  { tool: 'select', label: 'Select tool', icon: '⌖' },
  { tool: 'sticky', label: 'Sticky note tool', icon: '▣', editRequired: true },
  { tool: 'rect', label: 'Rectangle tool', icon: '▭', editRequired: true },
  { tool: 'circle', label: 'Circle tool', icon: '◌', editRequired: true },
  { tool: 'line', label: 'Line tool', icon: '╱', editRequired: true },
  { tool: 'text', label: 'Text tool', icon: '𝚃', editRequired: true },
  { tool: 'frame', label: 'Frame tool', icon: '⬚', editRequired: true },
  { tool: 'connector', label: 'Connector tool', icon: '⇄', editRequired: true },
];

export function BoardToolDock({ activeTool, canEditBoard, onSelectTool }: BoardToolDockProps) {
  return (
    <section className="board-tool-dock" role="toolbar" aria-label="Board tools">
      {TOOLS.map((tool) => (
        <button
          key={tool.tool}
          className={`dock-btn ${activeTool === tool.tool ? 'active' : ''}`}
          aria-label={tool.label}
          disabled={Boolean(tool.editRequired && !canEditBoard)}
          onClick={() => onSelectTool(tool.tool)}
        >
          <span aria-hidden="true">{tool.icon}</span>
        </button>
      ))}
    </section>
  );
}
