interface BoardQuickActionsPanelProps {
  canEditBoard: boolean;
  selectedCount: number;
  canLinkSupports: boolean;
  onTagAsClaim: () => void;
  onTagAsEvidence: () => void;
  onTagAsWitness: () => void;
  onTagAsTimeline: () => void;
  onLinkSupports: () => void;
  onAutoLayout: () => void;
}

export function BoardQuickActionsPanel({
  canEditBoard,
  selectedCount,
  canLinkSupports,
  onTagAsClaim,
  onTagAsEvidence,
  onTagAsWitness,
  onTagAsTimeline,
  onLinkSupports,
  onAutoLayout,
}: BoardQuickActionsPanelProps) {
  const disableTagActions = !canEditBoard || selectedCount === 0;

  return (
    <section className="board-quick-actions-panel properties-panel">
      <div className="board-quick-actions-header">
        <h3>Board quick actions</h3>
        <p>Fast role-tagging and lane-ready board cleanup for demos.</p>
      </div>

      <div className="board-quick-actions-grid">
        <button
          className="secondary-btn"
          type="button"
          onClick={onTagAsClaim}
          disabled={disableTagActions}
          aria-label="Tag selected as claim"
        >
          Tag as Claim
        </button>
        <button
          className="secondary-btn"
          type="button"
          onClick={onTagAsEvidence}
          disabled={disableTagActions}
          aria-label="Tag selected as evidence"
        >
          Tag as Evidence
        </button>
        <button
          className="secondary-btn"
          type="button"
          onClick={onTagAsWitness}
          disabled={disableTagActions}
          aria-label="Tag selected as witness"
        >
          Tag as Witness
        </button>
        <button
          className="secondary-btn"
          type="button"
          onClick={onTagAsTimeline}
          disabled={disableTagActions}
          aria-label="Tag selected as timeline event"
        >
          Tag as Timeline
        </button>
      </div>

      <div className="board-quick-actions-row">
        <button
          className="secondary-btn"
          type="button"
          onClick={onLinkSupports}
          disabled={!canEditBoard || !canLinkSupports}
          aria-label="Link selected sources to selected claim"
        >
          Link Supports
        </button>
        <button
          className="secondary-btn"
          type="button"
          onClick={onAutoLayout}
          disabled={!canEditBoard}
          aria-label="Auto-layout by role lane"
        >
          Auto-layout by role lane
        </button>
      </div>
    </section>
  );
}

