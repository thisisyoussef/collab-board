import type { ClaimStrengthResult } from '../lib/litigation-graph';

interface ClaimStrengthPanelProps {
  results: ClaimStrengthResult[];
  onFocusClaim: (claimId: string) => void;
}

export function ClaimStrengthPanel({ results, onFocusClaim }: ClaimStrengthPanelProps) {
  return (
    <section className="claim-strength-panel properties-panel">
      <div className="claim-strength-panel-header">
        <h3>Claim strength heatmap</h3>
        <p>AI-powered classification with manual override support.</p>
      </div>

      {results.length === 0 ? (
        <p className="claim-strength-empty">Tag at least one claim node to compute strength.</p>
      ) : (
        <ul className="claim-strength-list" aria-label="Claim strength list">
          {results.map((result) => (
            <li key={result.claimId} className={`claim-strength-item level-${result.effectiveLevel}`}>
              <button
                type="button"
                className="claim-strength-focus"
                onClick={() => onFocusClaim(result.claimId)}
                aria-label={`Focus claim ${result.claimLabel}`}
              >
                <span className="claim-strength-label">{result.claimLabel}</span>
                <span className="claim-strength-score">{result.score}</span>
              </button>
              <div className="claim-strength-meta">
                <span
                  className={`claim-strength-level is-${result.effectiveLevel}`}
                  style={result.isOverridden ? { borderStyle: 'dotted' } : undefined}
                >
                  {result.effectiveLevel}{result.isOverridden ? '*' : ''}
                </span>
                <span>
                  S:{result.supportCount} C:{result.contradictionCount} D:{result.dependencyGapCount}
                </span>
              </div>
              {result.isOverridden && result.aiStrengthLevel ? (
                <div className="claim-strength-ai-suggestion">
                  AI suggested: {result.aiStrengthLevel}
                </div>
              ) : null}
              {result.aiStrengthReason ? (
                <div className="claim-strength-ai-reason">{result.aiStrengthReason}</div>
              ) : null}
              <ul className="claim-strength-reasons">
                {result.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
