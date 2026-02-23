import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIPanelState } from '../types/ai';

const { AIAssistantFab } = await import('./AIAssistantFab');

const baseState: AIPanelState = {
  prompt: '',
  mode: 'auto',
  loading: false,
  error: null,
  message: null,
  actions: [],
  conversation: [
    {
      id: 'assistant-welcome',
      role: 'assistant',
      text: 'I can help map claims, evidence, witnesses, and chronology.',
      createdAt: 1,
    },
  ],
  canUndo: false,
  applyDisabled: true,
};

describe('AIAssistantFab', () => {
  const handlers = {
    onPromptChange: vi.fn(),
    onSubmit: vi.fn(),
    onApply: vi.fn(),
    onUndo: vi.fn(),
    onRetry: vi.fn(),
    onClear: vi.fn(),
    onRefreshQuickActions: vi.fn(),
    onQuickActionSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collapsed FAB by default and opens chat shell on click', () => {
    render(
      <AIAssistantFab
        state={baseState}
        quickActions={[]}
        quickActionsLoading={false}
        quickActionsError={null}
        {...handlers}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open AI assistant' })).toBeInTheDocument();
    expect(screen.queryByText('AI Case Assistant')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open AI assistant' }));

    expect(screen.getByText('AI Case Assistant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close AI assistant' })).toBeInTheDocument();
    expect(handlers.onRefreshQuickActions).toHaveBeenCalledTimes(1);
  });

  it('renders quick action chips and handles chip selection', () => {
    render(
      <AIAssistantFab
        state={baseState}
        quickActions={[
          'Map witness contradictions with source citations',
          'Build a trial-ready chronology with exhibit links',
        ]}
        quickActionsLoading={false}
        quickActionsError={null}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open AI assistant' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Quick action: Map witness contradictions with source citations',
      }),
    );

    expect(handlers.onQuickActionSelect).toHaveBeenCalledWith(
      'Map witness contradictions with source citations',
    );
  });

  it('submits prompt from floating chat shell', () => {
    render(
      <AIAssistantFab
        state={{
          ...baseState,
          prompt: 'Create a claims evidence witness timeline board',
        }}
        quickActions={[]}
        quickActionsLoading={false}
        quickActionsError={null}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open AI assistant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(handlers.onSubmit).toHaveBeenCalledTimes(1);
  });
});
