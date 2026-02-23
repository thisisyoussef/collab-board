import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContradictionRadarPanel } from './ContradictionRadarPanel';
import type { ContradictionCandidate } from '../hooks/useContradictionRadar';

function makeCandidate(overrides: Partial<ContradictionCandidate> = {}): ContradictionCandidate {
  return {
    id: 'contra-1',
    topic: 'Timeline discrepancy',
    confidence: 0.85,
    rationale: 'Witness A says March, Exhibit B says June.',
    sourceA: {
      objectId: 'node-a',
      label: 'Witness A',
      quote: 'The meeting was in March 2025.',
      citation: { page: '12', ref: 'Deposition A' },
    },
    sourceB: {
      objectId: 'node-b',
      label: 'Exhibit B',
      quote: 'Per our June 2025 meeting.',
      citation: { ref: 'Email chain B' },
    },
    ...overrides,
  };
}

describe('ContradictionRadarPanel', () => {
  it('renders empty state when no candidates', () => {
    render(
      <ContradictionRadarPanel
        candidates={[]}
        filteredCandidates={[]}
        decisions={new Map()}
        confidenceThreshold={0.7}
        loading={false}
        error={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onThresholdChange={vi.fn()}
        onApply={vi.fn()}
        acceptedCount={0}
      />,
    );

    expect(screen.getByText('Contradiction Radar')).toBeInTheDocument();
    expect(screen.getByText(/no contradictions/i)).toBeInTheDocument();
  });

  it('renders candidate cards with topic, quotes, citations, and confidence', () => {
    const candidate = makeCandidate();
    render(
      <ContradictionRadarPanel
        candidates={[candidate]}
        filteredCandidates={[candidate]}
        decisions={new Map()}
        confidenceThreshold={0.7}
        loading={false}
        error={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onThresholdChange={vi.fn()}
        onApply={vi.fn()}
        acceptedCount={0}
      />,
    );

    expect(screen.getByText('Timeline discrepancy')).toBeInTheDocument();
    expect(screen.getByText(/March 2025/)).toBeInTheDocument();
    expect(screen.getByText(/June 2025/)).toBeInTheDocument();
    expect(screen.getByText(/Deposition A/)).toBeInTheDocument();
    expect(screen.getByText(/Email chain B/)).toBeInTheDocument();
    expect(screen.getByText(/0\.85/)).toBeInTheDocument();
  });

  it('calls onAccept and onReject when buttons are clicked', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const candidate = makeCandidate();

    render(
      <ContradictionRadarPanel
        candidates={[candidate]}
        filteredCandidates={[candidate]}
        decisions={new Map()}
        confidenceThreshold={0.7}
        loading={false}
        error={null}
        onAccept={onAccept}
        onReject={onReject}
        onThresholdChange={vi.fn()}
        onApply={vi.fn()}
        acceptedCount={0}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /accept contradiction/i }));
    expect(onAccept).toHaveBeenCalledWith('contra-1');

    fireEvent.click(screen.getByRole('button', { name: /reject contradiction/i }));
    expect(onReject).toHaveBeenCalledWith('contra-1');
  });

  it('disables Apply button when no accepted items', () => {
    const candidate = makeCandidate();
    render(
      <ContradictionRadarPanel
        candidates={[candidate]}
        filteredCandidates={[candidate]}
        decisions={new Map()}
        confidenceThreshold={0.7}
        loading={false}
        error={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onThresholdChange={vi.fn()}
        onApply={vi.fn()}
        acceptedCount={0}
      />,
    );

    const applyButton = screen.getByRole('button', { name: /apply/i });
    expect(applyButton).toBeDisabled();
  });

  it('enables Apply button when accepted items exist', () => {
    const candidate = makeCandidate();
    render(
      <ContradictionRadarPanel
        candidates={[candidate]}
        filteredCandidates={[candidate]}
        decisions={new Map([['contra-1', 'accepted']])}
        confidenceThreshold={0.7}
        loading={false}
        error={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onThresholdChange={vi.fn()}
        onApply={vi.fn()}
        acceptedCount={1}
      />,
    );

    const applyButton = screen.getByRole('button', { name: /apply/i });
    expect(applyButton).not.toBeDisabled();
  });

  it('shows loading spinner during analysis', () => {
    render(
      <ContradictionRadarPanel
        candidates={[]}
        filteredCandidates={[]}
        decisions={new Map()}
        confidenceThreshold={0.7}
        loading={true}
        error={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onThresholdChange={vi.fn()}
        onApply={vi.fn()}
        acceptedCount={0}
      />,
    );

    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(
      <ContradictionRadarPanel
        candidates={[]}
        filteredCandidates={[]}
        decisions={new Map()}
        confidenceThreshold={0.7}
        loading={false}
        error="AI analysis failed"
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onThresholdChange={vi.fn()}
        onApply={vi.fn()}
        acceptedCount={0}
      />,
    );

    expect(screen.getByText('AI analysis failed')).toBeInTheDocument();
  });

  it('calls onApply when apply button is clicked', () => {
    const onApply = vi.fn();
    const candidate = makeCandidate();

    render(
      <ContradictionRadarPanel
        candidates={[candidate]}
        filteredCandidates={[candidate]}
        decisions={new Map([['contra-1', 'accepted']])}
        confidenceThreshold={0.7}
        loading={false}
        error={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onThresholdChange={vi.fn()}
        onApply={onApply}
        acceptedCount={1}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalled();
  });
});
