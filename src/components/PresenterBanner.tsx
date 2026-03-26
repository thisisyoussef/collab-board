interface PresenterBannerProps {
  presenterName: string | null;
  canStartPresenting: boolean;
  isPresenting: boolean;
  isFollowing: boolean;
  canFollow: boolean;
  onStartPresenting: () => void;
  onStopPresenting: () => void;
  onStartFollowing: () => void;
  onStopFollowing: () => void;
}

export function PresenterBanner({
  presenterName,
  canStartPresenting,
  isPresenting,
  isFollowing,
  canFollow,
  onStartPresenting,
  onStopPresenting,
  onStartFollowing,
  onStopFollowing,
}: PresenterBannerProps) {
  if (isPresenting) {
    return (
      <div className="presenter-banner" role="status" aria-live="polite">
        <span className="presenter-banner-copy">You are presenting</span>
        <button type="button" className="secondary-btn" onClick={onStopPresenting}>
          Stop presenter mode
        </button>
      </div>
    );
  }

  if (canFollow && presenterName) {
    return (
      <div className="presenter-banner" role="status" aria-live="polite">
        <span className="presenter-banner-copy">{presenterName} is presenting</span>
        {isFollowing ? (
          <button type="button" className="secondary-btn" onClick={onStopFollowing}>
            Stop following
          </button>
        ) : (
          <button type="button" className="primary-btn" onClick={onStartFollowing}>
            Follow
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="presenter-banner">
      <button
        type="button"
        className="secondary-btn"
        onClick={onStartPresenting}
        disabled={!canStartPresenting}
      >
        Start presenter mode
      </button>
    </div>
  );
}
