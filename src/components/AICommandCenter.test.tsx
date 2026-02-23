import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIPanelState } from '../types/ai';

const { AICommandCenter } = await import('./AICommandCenter');

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
};

describe('AICommandCenter', () => {
  const handlers = {
    onPromptChange: vi.fn(),
    onSubmit: vi.fn(),
    onModeChange: vi.fn(),
    onApply: vi.fn(),
    onUndo: vi.fn(),
    onRetry: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat UI with prompt input and generate action', () => {
    render(<AICommandCenter state={baseState} {...handlers} />);

    expect(screen.getByText('AI Case Assistant')).toBeInTheDocument();
    expect(screen.getByLabelText('Case AI prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(screen.getByText('I can help map claims, evidence, witnesses, and chronology.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview mode' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Auto mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo last change' })).toBeInTheDocument();
  });

  it('disables submit while loading', () => {
    render(
      <AICommandCenter
        state={{
          ...baseState,
          loading: true,
        }}
        {...handlers}
      />,
    );

    expect(screen.getByRole('button', { name: 'Thinking...' })).toBeDisabled();
  });

  it('renders success message and action list', () => {
    render(
      <AICommandCenter
        state={{
          ...baseState,
          message: 'Here is a suggested plan.',
          conversation: [
            ...baseState.conversation,
            {
              id: 'user-1',
              role: 'user',
              text: 'Generate a kickoff note.',
              createdAt: 2,
            },
            {
              id: 'assistant-1',
              role: 'assistant',
              text: 'Here is a suggested plan.',
              createdAt: 3,
            },
          ],
          actions: [
            {
              id: 'a-1',
              name: 'createStickyNote',
              summary: 'text=Kickoff · x=100 · y=140',
              input: { text: 'Kickoff', x: 100, y: 140 },
            },
          ],
        }}
        {...handlers}
      />,
    );

    expect(screen.getAllByText('Here is a suggested plan.')).toHaveLength(1);
    expect(screen.getByText('Generate a kickoff note.')).toBeInTheDocument();
    expect(screen.getByText('createStickyNote')).toBeInTheDocument();
    expect(screen.getByText('text=Kickoff · x=100 · y=140')).toBeInTheDocument();
  });

  it('renders error state and triggers retry callback', () => {
    render(
      <AICommandCenter
        state={{
          ...baseState,
          error: 'AI request failed.',
        }}
        {...handlers}
      />,
    );

    expect(screen.getByText('AI request failed.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it('triggers apply and undo callbacks when enabled', () => {
    render(
      <AICommandCenter
        state={{
          ...baseState,
          actions: [
            {
              id: 'a-1',
              name: 'createStickyNote',
              summary: 'text=Kickoff',
              input: { text: 'Kickoff' },
            },
          ],
          applyDisabled: false,
          canUndo: true,
        }}
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo last change' }));

    expect(handlers.onApply).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
  });

  it('disables undo button when no transaction is available', () => {
    render(
      <AICommandCenter
        state={{
          ...baseState,
          canUndo: false,
          applyDisabled: true,
        }}
        {...handlers}
      />,
    );

    expect(screen.getByRole('button', { name: 'Undo last change' })).toBeDisabled();
  });

  it('shows explicit hint when no executable actions are available', () => {
    render(<AICommandCenter state={baseState} {...handlers} />);

    expect(screen.getByText('No executable case actions generated yet.')).toBeInTheDocument();
  });

  it('disables controls and renders reason when AI access is blocked', () => {
    render(
      <AICommandCenter
        state={{
          ...baseState,
          canUndo: true,
          applyDisabled: false,
          actions: [
            {
              id: 'a-1',
              name: 'createStickyNote',
              summary: 'text=Kickoff',
              input: { text: 'Kickoff' },
            },
          ],
        }}
        disabled
        disabledReason="AI requires signed-in editor access."
        {...handlers}
      />,
    );

    expect(screen.getByLabelText('Case AI prompt')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo last change' })).toBeDisabled();
    expect(screen.getByText('AI requires signed-in editor access.')).toBeInTheDocument();
  });
});
