import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReplayCheckpoint } from '../hooks/useSessionReplay';
import { SessionReplayPanel, type SessionReplayPanelProps } from './SessionReplayPanel';

/* ────── helpers ────── */

function makeCheckpoint(overrides: Partial<ReplayCheckpoint> = {}): ReplayCheckpoint {
  return {
    id: `cp-${Math.random().toString(16).slice(2, 8)}`,
    atMs: Date.now(),
    source: 'manual',
    boardState: {},
    ...overrides,
  };
}

function renderPanel(overrides: Partial<SessionReplayPanelProps> = {}) {
  const defaults: SessionReplayPanelProps = {
    checkpoints: [],
    currentIndex: 0,
    playing: false,
    active: true,
    onGoTo: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onRestore: vi.fn(),
    onExit: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<SessionReplayPanel {...props} />), props };
}

/* ────── tests ────── */

describe('SessionReplayPanel', () => {
  it('renders header with title and close button', () => {
    renderPanel({ active: true, checkpoints: [makeCheckpoint()] });
    expect(screen.getByText('Session Time Machine')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('renders empty state when active with no checkpoints', () => {
    renderPanel({ active: true, checkpoints: [] });
    expect(screen.getByText(/no history yet/i)).toBeInTheDocument();
  });

  it('renders timeline scrubber with correct min/max/value', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-0' }),
      makeCheckpoint({ id: 'cp-1' }),
      makeCheckpoint({ id: 'cp-2' }),
      makeCheckpoint({ id: 'cp-3' }),
      makeCheckpoint({ id: 'cp-4' }),
    ];
    renderPanel({ active: true, checkpoints, currentIndex: 2 });

    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('4');
    expect(slider.value).toBe('2');
  });

  it('calls onGoTo when scrubber value changes', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-0' }),
      makeCheckpoint({ id: 'cp-1' }),
      makeCheckpoint({ id: 'cp-2' }),
    ];
    const { props } = renderPanel({ active: true, checkpoints, currentIndex: 0 });

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '2' } });

    expect(props.onGoTo).toHaveBeenCalledWith(2);
  });

  it('renders Play button when not playing, calls onPlay on click', () => {
    const checkpoints = [makeCheckpoint()];
    const { props } = renderPanel({ active: true, checkpoints, playing: false });

    const playBtn = screen.getByRole('button', { name: /play/i });
    expect(playBtn).toBeInTheDocument();
    fireEvent.click(playBtn);

    expect(props.onPlay).toHaveBeenCalledTimes(1);
  });

  it('renders Pause button when playing, calls onPause on click', () => {
    const checkpoints = [makeCheckpoint(), makeCheckpoint()];
    const { props } = renderPanel({ active: true, checkpoints, playing: true });

    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    expect(pauseBtn).toBeInTheDocument();
    fireEvent.click(pauseBtn);

    expect(props.onPause).toHaveBeenCalledTimes(1);
  });

  it('renders step-back and step-forward buttons', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-0' }),
      makeCheckpoint({ id: 'cp-1' }),
      makeCheckpoint({ id: 'cp-2' }),
    ];
    const { props } = renderPanel({ active: true, checkpoints, currentIndex: 1 });

    const stepBack = screen.getByRole('button', { name: /step back/i });
    const stepForward = screen.getByRole('button', { name: /step forward/i });
    expect(stepBack).toBeInTheDocument();
    expect(stepForward).toBeInTheDocument();

    fireEvent.click(stepBack);
    expect(props.onGoTo).toHaveBeenCalledWith(0);

    fireEvent.click(stepForward);
    expect(props.onGoTo).toHaveBeenCalledWith(2);
  });

  it('disables step-back at index 0 and step-forward at last index', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-0' }),
      makeCheckpoint({ id: 'cp-1' }),
      makeCheckpoint({ id: 'cp-2' }),
    ];

    // At first index — step-back should be disabled
    const { unmount } = render(
      <SessionReplayPanel
        checkpoints={checkpoints}
        currentIndex={0}
        playing={false}
        active={true}
        onGoTo={vi.fn()}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onRestore={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const stepBack = screen.getByRole('button', { name: /step back/i });
    expect(stepBack).toBeDisabled();

    unmount();

    // At last index — step-forward should be disabled
    render(
      <SessionReplayPanel
        checkpoints={checkpoints}
        currentIndex={2}
        playing={false}
        active={true}
        onGoTo={vi.fn()}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onRestore={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const stepForward = screen.getByRole('button', { name: /step forward/i });
    expect(stepForward).toBeDisabled();
  });

  it('renders checkpoint list with timestamps and source labels', () => {
    const now = Date.now();
    const checkpoints = [
      makeCheckpoint({ id: 'cp-0', atMs: now - 300000, source: 'manual' }),
      makeCheckpoint({ id: 'cp-1', atMs: now - 120000, source: 'ai' }),
    ];
    renderPanel({ active: true, checkpoints, currentIndex: 0 });

    // Should show source labels
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('ai')).toBeInTheDocument();
  });

  it('highlights the current checkpoint with aria-current', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-0' }),
      makeCheckpoint({ id: 'cp-1' }),
      makeCheckpoint({ id: 'cp-2' }),
    ];
    renderPanel({ active: true, checkpoints, currentIndex: 1 });

    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).not.toHaveAttribute('aria-current');
    expect(listItems[1]).toHaveAttribute('aria-current', 'step');
    expect(listItems[2]).not.toHaveAttribute('aria-current');
  });

  it('calls onRestore when restore button is clicked', () => {
    const checkpoints = [makeCheckpoint()];
    const { props } = renderPanel({ active: true, checkpoints });

    const restoreBtn = screen.getByRole('button', { name: /restore this state/i });
    fireEvent.click(restoreBtn);

    expect(props.onRestore).toHaveBeenCalledTimes(1);
  });

  it('calls onExit when close button is clicked', () => {
    const checkpoints = [makeCheckpoint()];
    const { props } = renderPanel({ active: true, checkpoints });

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  it('returns null when not active', () => {
    const { container } = render(
      <SessionReplayPanel
        checkpoints={[]}
        currentIndex={0}
        playing={false}
        active={false}
        onGoTo={vi.fn()}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onRestore={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });
});
