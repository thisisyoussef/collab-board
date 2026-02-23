import type { FormEvent, KeyboardEvent } from 'react';
import type { AIApplyMode, AIPanelState } from '../types/ai';

interface AICommandCenterProps {
  state: AIPanelState;
  disabled?: boolean;
  disabledReason?: string;
  onPromptChange: (nextValue: string) => void;
  onSubmit: () => void;
  onModeChange?: (nextMode: AIApplyMode) => void;
  onApply: () => void;
  onUndo: () => void;
  onRetry: () => void;
  onClear: () => void;
}

export function AICommandCenter({
  state,
  disabled = false,
  disabledReason,
  onPromptChange,
  onSubmit,
  onApply,
  onUndo,
  onRetry,
  onClear,
}: AICommandCenterProps) {
  const conversation = state.conversation || [];
  const latestAssistantMessage = [...conversation]
    .reverse()
    .find((entry) => entry.role === 'assistant' && entry.text.trim().length > 0)?.text;
  const feedbackMessage =
    state.message && state.message !== latestAssistantMessage ? state.message : null;
  const applyHint =
    state.actions.length === 0
      ? 'No executable case actions generated yet.'
      : 'Generated actions are ready to apply or review.';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <section className="ai-command-center">
      <div className="ai-panel-header">
        <h3>AI Case Assistant</h3>
        <span className="ai-kbd-hint">Ctrl/Cmd + Enter</span>
      </div>

      <div className="ai-chat-header">
        <strong>Conversation</strong>
        <p>Ask for board generation, evidence linking, witness prep, or contradiction review.</p>
      </div>

      <ol className="ai-chat-thread" aria-label="Conversation">
        {conversation.map((entry) => (
          <li
            key={entry.id}
            className={`ai-chat-bubble ${entry.role === 'user' ? 'user' : 'assistant'}`}
          >
            <span className="ai-chat-role">{entry.role === 'user' ? 'You' : 'AI'}</span>
            <p>{entry.text}</p>
          </li>
        ))}
      </ol>

      <form className="ai-form" onSubmit={handleSubmit}>
        <label htmlFor="ai-prompt-input">Case AI prompt</label>
        <textarea
          id="ai-prompt-input"
          className="ai-prompt-input"
          value={state.prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handlePromptKeyDown}
          placeholder="Generate a witness contradiction map with cited testimony and linked exhibits."
          rows={4}
          disabled={state.loading || disabled}
        />
        <div className="ai-form-actions">
          <button className="primary-btn" type="submit" disabled={state.loading || disabled}>
            {state.loading ? 'Thinking...' : 'Generate'}
          </button>
          <button
            className="secondary-btn"
            type="button"
            onClick={onClear}
            disabled={state.loading || disabled}
          >
            Clear
          </button>
        </div>
      </form>

      {disabled && disabledReason ? (
        <div className="ai-feedback error" role="note">
          <p>{disabledReason}</p>
        </div>
      ) : null}

      {state.error ? (
        <div className="ai-feedback error" role="alert">
          <p>{state.error}</p>
          <button className="secondary-btn" type="button" onClick={onRetry} disabled={state.loading}>
            Retry
          </button>
        </div>
      ) : null}

      {feedbackMessage || state.actions.length > 0 ? (
        <div className="ai-feedback success">
          {feedbackMessage ? <p>{feedbackMessage}</p> : null}
          {state.actions.length > 0 ? (
            <ol className="ai-action-list">
              {state.actions.map((action) => (
                <li key={action.id} className="ai-action-item">
                  <strong>{action.name}</strong>
                  <span>{action.summary}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {state.executionError ? (
        <div className="ai-feedback error" role="alert">
          <p>{state.executionError}</p>
        </div>
      ) : null}

      {state.executionMessage ? (
        <div className="ai-feedback success">
          <p>{state.executionMessage}</p>
        </div>
      ) : null}

      <div className="ai-apply-shell">
        <button
          className="secondary-btn"
          type="button"
          onClick={onApply}
          disabled={disabled || Boolean(state.applyDisabled) || state.applying}
          aria-label="Apply changes"
        >
          {state.applying ? 'Applying...' : 'Apply changes'}
        </button>
        <button
          className="secondary-btn"
          type="button"
          onClick={onUndo}
          disabled={disabled || state.applying || !state.canUndo}
          aria-label="Undo last change"
        >
          Undo last change
        </button>
        <p>
          {applyHint}
        </p>
      </div>
    </section>
  );
}
