import type { ReactElement } from 'react';

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
  shortLabel: string;
  editRequired?: boolean;
}

const TOOLS: ToolConfig[] = [
  { tool: 'select', label: 'Select tool', shortLabel: 'Sel' },
  { tool: 'sticky', label: 'Case card tool', shortLabel: 'Card', editRequired: true },
  { tool: 'rect', label: 'Region tool', shortLabel: 'Region', editRequired: true },
  { tool: 'circle', label: 'Marker tool', shortLabel: 'Mark', editRequired: true },
  { tool: 'line', label: 'Line tool', shortLabel: 'Line', editRequired: true },
  { tool: 'text', label: 'Annotation tool', shortLabel: 'Note', editRequired: true },
  { tool: 'frame', label: 'Case group tool', shortLabel: 'Group', editRequired: true },
  { tool: 'connector', label: 'Relationship tool', shortLabel: 'Link', editRequired: true },
];

function ToolIcon({ tool }: { tool: BoardTool }): ReactElement {
  const testId = `dock-icon-${tool}`;

  if (tool === 'select') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4v14l4-3 3 6 2-1-3-6 6-2-12-8z" />
      </svg>
    );
  }

  if (tool === 'sticky') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M14 4v4h4" />
      </svg>
    );
  }

  if (tool === 'rect') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="1.5" />
      </svg>
    );
  }

  if (tool === 'circle') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" />
      </svg>
    );
  }

  if (tool === 'line') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19 19 5" />
      </svg>
    );
  }

  if (tool === 'text') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6h12M12 6v12M8 18h8" />
      </svg>
    );
  }

  if (tool === 'frame') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
      </svg>
    );
  }

  return (
    <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M8 12h8M13 9l3 3-3 3" />
    </svg>
  );
}

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
          <span className="dock-btn-icon" aria-hidden="true">
            <ToolIcon tool={tool.tool} />
          </span>
          <span className="dock-btn-label" aria-hidden="true">
            {tool.shortLabel}
          </span>
        </button>
      ))}
    </section>
  );
}
