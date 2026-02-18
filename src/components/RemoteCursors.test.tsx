import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteCursors } from './RemoteCursors';

vi.mock('react-konva', () => ({
  Layer: ({ children, name }: { children?: ReactNode; name?: string }) => (
    <div data-testid="remote-layer" data-name={name}>
      {children}
    </div>
  ),
  Group: ({ children, x, y }: { children?: ReactNode; x?: number; y?: number }) => (
    <div data-testid="remote-group" data-x={String(x)} data-y={String(y)}>
      {children}
    </div>
  ),
  Line: () => <div data-testid="remote-line" />,
  Rect: ({ width }: { width?: number }) => <div data-testid="remote-rect" data-width={String(width)} />,
  Text: ({ text }: { text?: string }) => <span data-testid="remote-text">{text}</span>,
}));

type FrameCallback = Parameters<typeof window.requestAnimationFrame>[0];

let frameQueue: Array<{ id: number; cb: FrameCallback }> = [];
let frameId = 0;

function flushAnimationFrames(now = 16) {
  const queued = [...frameQueue];
  frameQueue = [];
  queued.forEach(({ cb }) => cb(now));
}

describe('RemoteCursors', () => {
  beforeEach(() => {
    frameQueue = [];
    frameId = 0;

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frameId += 1;
      frameQueue.push({ id: frameId, cb });
      return frameId;
    });

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      frameQueue = frameQueue.filter((entry) => entry.id !== id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders cursors and clamps long display names', async () => {
    render(
      <RemoteCursors
        cursors={[
          {
            socketId: 'socket-1',
            userId: 'user-1',
            displayName: 'VeryLongDisplayName',
            color: '#2563eb',
            x: 120,
            y: 240,
          },
        ]}
      />,
    );

    act(() => {
      flushAnimationFrames();
    });

    await waitFor(() => {
      expect(screen.getByText('VeryLongDisp…')).toBeInTheDocument();
    });

    expect(screen.getByTestId('remote-layer')).toHaveAttribute('data-name', 'remote-cursors-layer');
    expect(screen.getByTestId('remote-group')).toHaveAttribute('data-x', '120');
    expect(screen.getByTestId('remote-group')).toHaveAttribute('data-y', '240');
  });

  it('falls back to Unknown for blank display names', async () => {
    render(
      <RemoteCursors
        cursors={[
          {
            socketId: 'socket-2',
            userId: 'user-2',
            displayName: '   ',
            color: '#22c55e',
            x: 10,
            y: 20,
          },
        ]}
      />,
    );

    act(() => {
      flushAnimationFrames();
    });

    await waitFor(() => {
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  it('removes cursors when the list becomes empty', async () => {
    const { rerender } = render(
      <RemoteCursors
        cursors={[
          {
            socketId: 'socket-3',
            userId: 'user-3',
            displayName: 'Alex',
            color: '#f97316',
            x: 1,
            y: 2,
          },
        ]}
      />,
    );

    act(() => {
      flushAnimationFrames();
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('remote-group')).toHaveLength(1);
    });

    rerender(<RemoteCursors cursors={[]} />);

    act(() => {
      flushAnimationFrames();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('remote-group')).not.toBeInTheDocument();
    });
  });
});
