import type { ContradictionCandidate, ContradictionDecision } from '../hooks/useContradictionRadar';

interface ContradictionRadarPanelProps {
  candidates: ContradictionCandidate[];
  filteredCandidates: ContradictionCandidate[];
  decisions: Map<string, ContradictionDecision>;
  confidenceThreshold: number;
  loading: boolean;
  error: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onThresholdChange: (value: number) => void;
  onApply: () => void;
  acceptedCount: number;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#1f8f5b';
  if (confidence >= 0.6) return '#b9811b';
  return '#c4453e';
}

export function ContradictionRadarPanel({
  filteredCandidates,
  decisions,
  confidenceThreshold,
  loading,
  error,
  onAccept,
  onReject,
  onThresholdChange,
  onApply,
  acceptedCount,
}: ContradictionRadarPanelProps) {
  return (
    <section className="contradiction-radar-panel properties-panel">
      <div className="contradiction-radar-header">
        <h3>Contradiction Radar</h3>
        <p>AI-detected contradictions between selected sources.</p>
      </div>

      {error && (
        <div className="contradiction-radar-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="contradiction-radar-loading">
          Analyzing sources for contradictions...
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="contradiction-radar-threshold">
            <label htmlFor="confidence-threshold">
              Confidence threshold: {confidenceThreshold.toFixed(2)}
            </label>
            <input
              id="confidence-threshold"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
            />
          </div>

          {filteredCandidates.length === 0 ? (
            <p className="contradiction-radar-empty">No contradictions found above threshold.</p>
          ) : (
            <ul className="contradiction-radar-list" aria-label="Contradiction candidates">
              {filteredCandidates.map((candidate) => {
                const decision = decisions.get(candidate.id);
                return (
                  <li key={candidate.id} className={`contradiction-card decision-${decision || 'pending'}`}>
                    <div className="contradiction-topic">
                      <strong>{candidate.topic}</strong>
                      <span
                        className="contradiction-confidence"
                        style={{ color: confidenceColor(candidate.confidence) }}
                      >
                        {candidate.confidence.toFixed(2)}
                      </span>
                    </div>

                    <div className="contradiction-sources">
                      <div className="contradiction-source">
                        <span className="source-label">{candidate.sourceA.label}</span>
                        <blockquote className="source-quote">{candidate.sourceA.quote}</blockquote>
                        <cite className="source-citation">
                          {candidate.sourceA.citation.ref}
                          {candidate.sourceA.citation.page && `, p. ${candidate.sourceA.citation.page}`}
                        </cite>
                      </div>

                      <div className="contradiction-vs">vs</div>

                      <div className="contradiction-source">
                        <span className="source-label">{candidate.sourceB.label}</span>
                        <blockquote className="source-quote">{candidate.sourceB.quote}</blockquote>
                        <cite className="source-citation">
                          {candidate.sourceB.citation.ref}
                          {candidate.sourceB.citation.page && `, p. ${candidate.sourceB.citation.page}`}
                        </cite>
                      </div>
                    </div>

                    <p className="contradiction-rationale">{candidate.rationale}</p>

                    <div className="contradiction-actions">
                      <button
                        type="button"
                        className={`btn-accept ${decision === 'accepted' ? 'active' : ''}`}
                        onClick={() => onAccept(candidate.id)}
                        aria-label={`Accept contradiction: ${candidate.topic}`}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className={`btn-reject ${decision === 'rejected' ? 'active' : ''}`}
                        onClick={() => onReject(candidate.id)}
                        aria-label={`Reject contradiction: ${candidate.topic}`}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="contradiction-radar-footer">
            <button
              type="button"
              className="btn-apply-contradictions"
              disabled={acceptedCount === 0}
              onClick={onApply}
              aria-label={`Apply ${acceptedCount} accepted contradiction${acceptedCount === 1 ? '' : 's'}`}
            >
              Apply {acceptedCount} accepted
            </button>
          </div>
        </>
      )}
    </section>
  );
}
