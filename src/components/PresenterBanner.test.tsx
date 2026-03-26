import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PresenterBanner } from './PresenterBanner';

describe('PresenterBanner', () => {
  it('renders follow call-to-action for participants', () => {
    const onFollow = vi.fn();

    render(
      <PresenterBanner
        presenterName="Alex"
        canStartPresenting={true}
        isPresenting={false}
        isFollowing={false}
        canFollow={true}
        onStartPresenting={vi.fn()}
        onStopPresenting={vi.fn()}
        onStartFollowing={onFollow}
        onStopFollowing={vi.fn()}
      />,
    );

    expect(screen.getByText(/Alex is presenting/i)).toBeInTheDocument();
    const followButton = screen.getByRole('button', { name: 'Follow' });
    fireEvent.click(followButton);
    expect(onFollow).toHaveBeenCalledTimes(1);
  });

  it('renders stop presenting control for presenter', () => {
    const onStopPresenting = vi.fn();

    render(
      <PresenterBanner
        presenterName="Alex"
        canStartPresenting={true}
        isPresenting={true}
        isFollowing={false}
        canFollow={false}
        onStartPresenting={vi.fn()}
        onStopPresenting={onStopPresenting}
        onStartFollowing={vi.fn()}
        onStopFollowing={vi.fn()}
      />,
    );

    const stopButton = screen.getByRole('button', { name: 'Stop presenter mode' });
    fireEvent.click(stopButton);
    expect(onStopPresenting).toHaveBeenCalledTimes(1);
  });

  it('renders start presenter mode when no presenter is active', () => {
    const onStartPresenting = vi.fn();

    render(
      <PresenterBanner
        presenterName={null}
        canStartPresenting={true}
        isPresenting={false}
        isFollowing={false}
        canFollow={false}
        onStartPresenting={onStartPresenting}
        onStopPresenting={vi.fn()}
        onStartFollowing={vi.fn()}
        onStopFollowing={vi.fn()}
      />,
    );

    const startButton = screen.getByRole('button', { name: 'Start presenter mode' });
    fireEvent.click(startButton);
    expect(onStartPresenting).toHaveBeenCalledTimes(1);
  });
});
