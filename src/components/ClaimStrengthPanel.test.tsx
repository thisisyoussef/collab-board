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
            effectiveLevel: 'strong',
            isOverridden: false,
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

  it('renders quick controls and AI recommendation actions', () => {
    const onFocusWeakest = vi.fn();
    const onRecommendFixes = vi.fn();
    const onApplyRecommendedFixes = vi.fn();

    render(
      <ClaimStrengthPanel
        results={[
          {
            claimId: 'claim-weak',
            claimLabel: 'Weak Claim',
            score: 23,
            level: 'weak',
            supportCount: 0,
            contradictionCount: 1,
            dependencyGapCount: 1,
            reasons: ['No support links found.'],
            effectiveLevel: 'weak',
            isOverridden: false,
          },
        ]}
        onFocusClaim={vi.fn()}
        onFocusWeakest={onFocusWeakest}
        onRecommendFixes={onRecommendFixes}
        onApplyRecommendedFixes={onApplyRecommendedFixes}
        recommendationLoading={false}
        recommendationError={null}
        recommendationCount={2}
        canRecommend={true}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Focus weakest claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recommend fixes (AI)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply recommended fixes' }));

    expect(onFocusWeakest).toHaveBeenCalledTimes(1);
    expect(onRecommendFixes).toHaveBeenCalledTimes(1);
    expect(onApplyRecommendedFixes).toHaveBeenCalledTimes(1);
  });
});
