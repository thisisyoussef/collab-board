import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardQuickActionsPanel } from './BoardQuickActionsPanel';

describe('BoardQuickActionsPanel', () => {
  it('renders board quick actions and forwards callbacks', () => {
    const onTagAsClaim = vi.fn();
    const onTagAsEvidence = vi.fn();
    const onTagAsWitness = vi.fn();
    const onTagAsTimeline = vi.fn();
    const onLinkSupports = vi.fn();
    const onAutoLayout = vi.fn();

    render(
      <BoardQuickActionsPanel
        canEditBoard={true}
        selectedCount={3}
        canLinkSupports={true}
        onTagAsClaim={onTagAsClaim}
        onTagAsEvidence={onTagAsEvidence}
        onTagAsWitness={onTagAsWitness}
        onTagAsTimeline={onTagAsTimeline}
        onLinkSupports={onLinkSupports}
        onAutoLayout={onAutoLayout}
      />,
    );

    expect(screen.getByText('Board quick actions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tag selected as claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tag selected as evidence' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tag selected as witness' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tag selected as timeline event' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link selected sources to selected claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auto-layout by role lane' }));

    expect(onTagAsClaim).toHaveBeenCalledTimes(1);
    expect(onTagAsEvidence).toHaveBeenCalledTimes(1);
    expect(onTagAsWitness).toHaveBeenCalledTimes(1);
    expect(onTagAsTimeline).toHaveBeenCalledTimes(1);
    expect(onLinkSupports).toHaveBeenCalledTimes(1);
    expect(onAutoLayout).toHaveBeenCalledTimes(1);
  });

  it('disables actions when board is read-only', () => {
    render(
      <BoardQuickActionsPanel
        canEditBoard={false}
        selectedCount={0}
        canLinkSupports={false}
        onTagAsClaim={vi.fn()}
        onTagAsEvidence={vi.fn()}
        onTagAsWitness={vi.fn()}
        onTagAsTimeline={vi.fn()}
        onLinkSupports={vi.fn()}
        onAutoLayout={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tag selected as claim' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Link selected sources to selected claim' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Auto-layout by role lane' })).toBeDisabled();
  });
});

