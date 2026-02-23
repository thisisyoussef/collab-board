import type { ClaimStrengthResult } from '../lib/litigation-graph';

interface ClaimStrengthPanelProps {
  results: ClaimStrengthResult[];
  onFocusClaim: (claimId: string) => void;
  onFocusWeakest?: () => void;
  onRecommendFixes?: () => void;
  onApplyRecommendedFixes?: () => void;
  recommendationLoading?: boolean;
  recommendationError?: string | null;
  recommendationCount?: number;
  canRecommend?: boolean;
}

export function ClaimStrengthPanel({
  results,
  onFocusClaim,
  onFocusWeakest,
  onRecommendFixes,
  onApplyRecommendedFixes,
  recommendationLoading = false,
  recommendationError = null,
  recommendationCount = 0,
  canRecommend = false,
}: ClaimStrengthPanelProps) {
  const weakestClaim = [...results].sort((a, b) => a.score - b.score)[0] || null;
  const handleFocusWeakest = () => {
    if (!weakestClaim) {
      return;
    }
    if (onFocusWeakest) {
      onFocusWeakest();
      return;
    }
    onFocusClaim(weakestClaim.claimId);
  };

  return (
    <section className="claim-strength-panel properties-panel">
      <div className="claim-strength-panel-header">
        <h3>Claim strength heatmap</h3>
        <p>AI-powered classification with manual override support.</p>
      </div>

      <div className="claim-strength-quick-actions">
        <button
          className="secondary-btn"
          type="button"
          onClick={handleFocusWeakest}
          disabled={!weakestClaim}
          aria-label="Focus weakest claim"
        >
          Focus weakest
        </button>
        <button
          className="secondary-btn"
          type="button"
          onClick={() => onRecommendFixes?.()}
          disabled={!canRecommend || recommendationLoading || results.length === 0}
          aria-label="Recommend fixes (AI)"
        >
          {recommendationLoading ? 'Recommending...' : 'Recommend fixes (AI)'}
        </button>
        <button
          className="secondary-btn"
          type="button"
          onClick={() => onApplyRecommendedFixes?.()}
          disabled={!canRecommend || recommendationLoading || recommendationCount === 0}
          aria-label="Apply recommended fixes"
        >
          Apply recommended fixes
        </button>
      </div>

      {recommendationError ? (
        <div className="claim-strength-feedback error" role="alert">
          {recommendationError}
        </div>
      ) : null}

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
