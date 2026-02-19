import type { FormEvent, KeyboardEvent } from 'react';
import type { AIApplyMode, AIPanelState } from '../types/ai';

interface AICommandCenterProps {
  state: AIPanelState;
  disabled?: boolean;
  disabledReason?: string;
  onPromptChange: (nextValue: string) => void;
  onSubmit: () => void;
  onModeChange: (nextMode: AIApplyMode) => void;
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
  onModeChange,
  onApply,
  onUndo,
  onRetry,
  onClear,
}: AICommandCenterProps) {
  const applyHint =
    state.actions.length === 0
      ? 'No executable actions in this plan yet.'
      : state.mode === 'auto'
        ? 'Auto mode applies generated actions immediately.'
        : 'Preview mode requires manual Apply.';

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
        <h3>AI Command Center</h3>
        <span className="ai-kbd-hint">Ctrl/Cmd + Enter</span>
      </div>

      <div className="ai-mode-toggle" role="group" aria-label="AI apply mode">
        <button
          type="button"
          className={`ai-mode-btn ${state.mode === 'preview' ? 'active' : ''}`}
          aria-label="Preview mode"
          aria-pressed={state.mode === 'preview'}
          disabled={disabled}
          onClick={() => onModeChange('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          className={`ai-mode-btn ${state.mode === 'auto' ? 'active' : ''}`}
          aria-label="Auto mode"
          aria-pressed={state.mode === 'auto'}
          disabled={disabled}
          onClick={() => onModeChange('auto')}
        >
          Auto
        </button>
      </div>

      <form className="ai-form" onSubmit={handleSubmit}>
        <label htmlFor="ai-prompt-input">AI prompt</label>
        <textarea
          id="ai-prompt-input"
          className="ai-prompt-input"
          value={state.prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handlePromptKeyDown}
          placeholder="Create a SWOT template with four quadrants."
          rows={4}
          disabled={state.loading || disabled}
        />
        <div className="ai-form-actions">
          <button className="primary-btn" type="submit" disabled={state.loading || disabled}>
            {state.loading ? 'Thinking...' : 'Generate Plan'}
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

      {state.message || state.actions.length > 0 ? (
        <div className="ai-feedback success">
          {state.message ? <p>{state.message}</p> : null}
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
