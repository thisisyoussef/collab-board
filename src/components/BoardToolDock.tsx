import type { ReactElement } from 'react';

export type BoardTool =
  | 'select'
  | 'sticky'
  | 'legal_claim'
  | 'legal_evidence'
  | 'legal_witness'
  | 'legal_timeline'
  | 'legal_contradiction'
  | 'legal_link_supports'
  | 'legal_link_contradicts'
  | 'legal_link_depends_on'
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

type ToolGroup = 'core' | 'legal_nodes' | 'legal_links' | 'canvas';

interface ToolConfig {
  tool: BoardTool;
  label: string;
  shortLabel: string;
  description: string;
  group: ToolGroup;
  editRequired?: boolean;
}

const TOOL_GROUP_ORDER: ToolGroup[] = ['core', 'legal_nodes', 'legal_links', 'canvas'];

const TOOL_GROUP_LABELS: Record<ToolGroup, string> = {
  core: 'Core tools',
  legal_nodes: 'Legal nodes',
  legal_links: 'Legal links',
  canvas: 'Canvas tools',
};

const TOOLS: ToolConfig[] = [
  {
    tool: 'select',
    label: 'Select tool',
    shortLabel: 'Sel',
    description: 'Select, move, and inspect existing board objects.',
    group: 'core',
  },
  {
    tool: 'sticky',
    label: 'Case card tool',
    shortLabel: 'Card',
    description: 'Add a general-purpose case note card anywhere on the board.',
    group: 'core',
    editRequired: true,
  },
  {
    tool: 'legal_claim',
    label: 'Claim node tool',
    shortLabel: 'Claim',
    description: 'Add a legal claim card to anchor a theory of liability or defense.',
    group: 'legal_nodes',
    editRequired: true,
  },
  {
    tool: 'legal_evidence',
    label: 'Evidence node tool',
    shortLabel: 'Evid',
    description: 'Add an exhibit or document card with citation-ready evidence details.',
    group: 'legal_nodes',
    editRequired: true,
  },
  {
    tool: 'legal_witness',
    label: 'Witness node tool',
    shortLabel: 'Wit',
    description: 'Add a witness testimony card with quotes and source references.',
    group: 'legal_nodes',
    editRequired: true,
  },
  {
    tool: 'legal_timeline',
    label: 'Timeline event node tool',
    shortLabel: 'Time',
    description: 'Add a dated event card for chronology and sequence analysis.',
    group: 'legal_nodes',
    editRequired: true,
  },
  {
    tool: 'legal_contradiction',
    label: 'Contradiction node tool',
    shortLabel: 'Contr',
    description: 'Add a contradiction card with opposing statements and citations.',
    group: 'legal_nodes',
    editRequired: true,
  },
  {
    tool: 'legal_link_supports',
    label: 'Supports link tool',
    shortLabel: 'Supp',
    description: 'Connect evidence or testimony that supports a claim.',
    group: 'legal_links',
    editRequired: true,
  },
  {
    tool: 'legal_link_contradicts',
    label: 'Contradicts link tool',
    shortLabel: 'Xlink',
    description: 'Connect statements that directly conflict with each other.',
    group: 'legal_links',
    editRequired: true,
  },
  {
    tool: 'legal_link_depends_on',
    label: 'Dependency link tool',
    shortLabel: 'Dep',
    description: 'Connect arguments where one claim depends on another fact or element.',
    group: 'legal_links',
    editRequired: true,
  },
  {
    tool: 'rect',
    label: 'Region tool',
    shortLabel: 'Region',
    description: 'Draw a rectangular region to group related evidence or argument clusters.',
    group: 'canvas',
    editRequired: true,
  },
  {
    tool: 'circle',
    label: 'Marker tool',
    shortLabel: 'Mark',
    description: 'Draw a marker shape to call out high-risk areas.',
    group: 'canvas',
    editRequired: true,
  },
  {
    tool: 'line',
    label: 'Line tool',
    shortLabel: 'Line',
    description: 'Draw a free line for visual emphasis during strategy reviews.',
    group: 'canvas',
    editRequired: true,
  },
  {
    tool: 'text',
    label: 'Annotation tool',
    shortLabel: 'Note',
    description: 'Add plain text annotations that stay separate from legal node scoring.',
    group: 'canvas',
    editRequired: true,
  },
  {
    tool: 'frame',
    label: 'Case group tool',
    shortLabel: 'Group',
    description: 'Add a frame to section the board by issue, witness, or motion.',
    group: 'canvas',
    editRequired: true,
  },
  {
    tool: 'connector',
    label: 'Relationship tool',
    shortLabel: 'Link',
    description: 'Draw a general connector when a legal relation type is not needed.',
    group: 'canvas',
    editRequired: true,
  },
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

  if (tool === 'legal_claim') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M7 9h10M7 13h7" />
      </svg>
    );
  }

  if (tool === 'legal_evidence') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="4" width="14" height="16" rx="1.8" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }

  if (tool === 'legal_witness') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8.5" r="3.2" />
        <path d="M5.5 19c1.6-3 3.6-4.5 6.5-4.5s4.9 1.5 6.5 4.5" />
      </svg>
    );
  }

  if (tool === 'legal_timeline') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h16" />
        <circle cx="8" cy="12" r="2" />
        <circle cx="16" cy="12" r="2" />
      </svg>
    );
  }

  if (tool === 'legal_contradiction') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
        <circle cx="6" cy="6" r="1.6" />
        <circle cx="18" cy="18" r="1.6" />
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

  if (tool === 'legal_link_supports') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="12" r="2" />
        <path d="M8 12h8M13 9l3 3-3 3" />
        <path d="M12 5v4M10 7h4" />
      </svg>
    );
  }

  if (tool === 'legal_link_contradicts') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="12" r="2" />
        <path d="M8 12h8" />
        <path d="M11 9l2 2-2 2M13 9l-2 2 2 2" />
      </svg>
    );
  }

  if (tool === 'legal_link_depends_on') {
    return (
      <svg data-testid={testId} className="dock-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="12" r="2" />
        <path d="M8 12h8M12 8v8" />
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
  const activeConfig = TOOLS.find((tool) => tool.tool === activeTool);
  return (
    <div className="board-tool-dock-wrap board-tool-dock-wrap--expanded">
      <section
        className="board-tool-dock board-tool-dock--wide board-tool-dock--edge-to-edge"
        role="toolbar"
        aria-label="Board tools"
      >
        {TOOL_GROUP_ORDER.map((group) => (
          <div key={group} className="dock-group" role="group" aria-label={TOOL_GROUP_LABELS[group]}>
            <span className="dock-group-label" aria-hidden="true">
              {TOOL_GROUP_LABELS[group]}
            </span>
            <div className="dock-group-tools">
              {TOOLS.filter((tool) => tool.group === group).map((tool) => (
                <button
                  key={tool.tool}
                  type="button"
                  className={`dock-btn ${activeTool === tool.tool ? 'active' : ''}`}
                  aria-label={tool.label}
                  title={`${tool.label}: ${tool.description}`}
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
            </div>
          </div>
        ))}
      </section>
      {activeConfig ? (
        <p className="board-tool-hint" role="status" aria-live="polite">
          {activeConfig.description}
        </p>
      ) : null}
    </div>
  );
}
