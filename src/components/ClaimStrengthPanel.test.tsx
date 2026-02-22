import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClaimStrengthPanel } from './ClaimStrengthPanel';

describe('ClaimStrengthPanel', () => {
  it('renders empty state when no claims are scored', () => {
    render(<ClaimStrengthPanel results={[]} onFocusClaim={vi.fn()} />);

    expect(screen.getByText('Claim strength heatmap')).toBeInTheDocument();
    expect(screen.getByText('Tag at least one claim node to compute strength.')).toBeInTheDocument();
  });

  it('renders claim scores and supports click-to-focus', () => {
    const onFocusClaim = vi.fn();

    render(
      <ClaimStrengthPanel
        results={[
          {
            claimId: 'claim-1',
            claimLabel: 'Claim A',
            score: 78,
            level: 'strong',
            supportCount: 3,
            contradictionCount: 0,
            dependencyGapCount: 0,
            reasons: ['3 supporting links found.'],
          },
        ]}
        onFocusClaim={onFocusClaim}
      />,
    );

    expect(screen.getByText('Claim A')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('strong')).toBeInTheDocument();
    expect(screen.getByText('3 supporting links found.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Focus claim Claim A' }));
    expect(onFocusClaim).toHaveBeenCalledWith('claim-1');
  });
});
