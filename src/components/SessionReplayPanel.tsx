import type { ReplayCheckpoint } from '../hooks/useSessionReplay';

export interface SessionReplayPanelProps {
  checkpoints: ReplayCheckpoint[];
  currentIndex: number;
  playing: boolean;
  active: boolean;
  onGoTo: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onRestore: () => void;
  onExit: () => void;
}

function formatRelativeTime(atMs: number): string {
  const diffMs = Date.now() - atMs;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function SessionReplayPanel({
  checkpoints,
  currentIndex,
  playing,
  active,
  onGoTo,
  onPlay,
  onPause,
  onRestore,
  onExit,
}: SessionReplayPanelProps) {
  if (!active) {
    return null;
  }

  const hasCheckpoints = checkpoints.length > 0;
  const maxIndex = Math.max(0, checkpoints.length - 1);

  return (
    <section className="session-replay-panel properties-panel">
      <div className="session-replay-header">
        <h3>Session Time Machine</h3>
        <button
          type="button"
          aria-label="Close session time machine"
          className="session-replay-close-btn"
          onClick={onExit}
        >
          &times;
        </button>
      </div>

      {!hasCheckpoints ? (
        <p className="session-replay-empty">
          No history yet — make some changes to build a timeline.
        </p>
      ) : (
        <>
          {/* Timeline scrubber */}
          <div className="session-replay-scrubber">
            <input
              type="range"
              role="slider"
              min={0}
              max={maxIndex}
              value={currentIndex}
              onChange={(e) => onGoTo(Number(e.target.value))}
              className="session-replay-slider"
            />
            <span className="session-replay-position">
              {currentIndex + 1} / {checkpoints.length}
            </span>
          </div>

          {/* Playback controls */}
          <div className="session-replay-controls">
            <button
              type="button"
              aria-label="Step back"
              disabled={currentIndex <= 0}
              onClick={() => onGoTo(currentIndex - 1)}
              className="session-replay-step-btn"
            >
              &#9664;&#9664;
            </button>

            {playing ? (
              <button
                type="button"
                aria-label="Pause"
                onClick={onPause}
                className="session-replay-play-btn"
              >
                &#9646;&#9646;
              </button>
            ) : (
              <button
                type="button"
                aria-label="Play"
                onClick={onPlay}
                className="session-replay-play-btn"
              >
                &#9654;
              </button>
            )}

            <button
              type="button"
              aria-label="Step forward"
              disabled={currentIndex >= maxIndex}
              onClick={() => onGoTo(currentIndex + 1)}
              className="session-replay-step-btn"
            >
              &#9654;&#9654;
            </button>
          </div>

          {/* Checkpoint list */}
          <ul className="session-replay-checkpoint-list">
            {checkpoints.map((cp, index) => (
              <li
                key={cp.id}
                className={`session-replay-checkpoint-item${
                  index === currentIndex ? ' session-replay-checkpoint-active' : ''
                }`}
                aria-current={index === currentIndex ? 'step' : undefined}
                onClick={() => onGoTo(index)}
              >
                <span className="session-replay-cp-time">
                  {formatRelativeTime(cp.atMs)}
                </span>
                <span className="session-replay-cp-source">{cp.source}</span>
              </li>
            ))}
          </ul>

          {/* Restore button */}
          <button
            type="button"
            className="session-replay-restore-btn"
            onClick={onRestore}
          >
            Restore this state
          </button>
        </>
      )}
    </section>
  );
}
