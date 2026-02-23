import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import type { AIPanelState } from '../types/ai';

interface AIAssistantFabProps {
  state: AIPanelState;
  quickActions: string[];
  quickActionsLoading?: boolean;
  quickActionsError?: string | null;
  disabled?: boolean;
  disabledReason?: string;
  onPromptChange: (nextValue: string) => void;
  onSubmit: () => void;
  onApply: () => void;
  onUndo: () => void;
  onRetry: () => void;
  onClear: () => void;
  onRefreshQuickActions: () => void;
  onQuickActionSelect: (prompt: string) => void;
}

const PANEL_TOP_GUTTER_PX = 24;
const FAB_BOTTOM_OFFSET_DESKTOP_PX = 90;
const FAB_BOTTOM_OFFSET_MOBILE_PX = 84;
const PANEL_MIN_HEIGHT_PX = 360;

function calculateViewportSafePanelHeight(): number {
  if (typeof window === 'undefined') {
    return 640;
  }

  const viewportHeight = window.innerHeight || 800;
  const isCompactLayout =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 860px)').matches;
  const reservedBottom = isCompactLayout
    ? FAB_BOTTOM_OFFSET_MOBILE_PX
    : FAB_BOTTOM_OFFSET_DESKTOP_PX;

  return Math.max(PANEL_MIN_HEIGHT_PX, Math.floor(viewportHeight - reservedBottom - PANEL_TOP_GUTTER_PX));
}

export function AIAssistantFab({
  state,
  quickActions,
  quickActionsLoading = false,
  quickActionsError = null,
  disabled = false,
  disabledReason,
  onPromptChange,
  onSubmit,
  onApply,
  onUndo,
  onRetry,
  onClear,
  onRefreshQuickActions,
  onQuickActionSelect,
}: AIAssistantFabProps) {
  const [open, setOpen] = useState(false);
  const [panelMaxHeight, setPanelMaxHeight] = useState(() => calculateViewportSafePanelHeight());
  const conversation = state.conversation || [];
  const latestAssistantMessage = [...conversation]
    .reverse()
    .find((entry) => entry.role === 'assistant' && entry.text.trim().length > 0)?.text;
  const feedbackMessage =
    state.message && state.message !== latestAssistantMessage ? state.message : null;
  const applyHint =
    state.actions.length === 0
      ? 'No executable case actions generated yet.'
      : 'Generated actions are ready to apply.';

  const handleOpen = () => {
    setOpen(true);
    onRefreshQuickActions();
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const updatePanelMaxHeight = () => {
      setPanelMaxHeight(calculateViewportSafePanelHeight());
    };

    updatePanelMaxHeight();
    window.addEventListener('resize', updatePanelMaxHeight);
    return () => {
      window.removeEventListener('resize', updatePanelMaxHeight);
    };
  }, [open]);

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
    <div className={`ai-fab-shell ${open ? 'is-open' : 'is-closed'}`}>
      {!open ? (
        <button
          className="ai-fab-trigger"
          type="button"
          aria-label="Open AI assistant"
          onClick={handleOpen}
          disabled={disabled}
          title={disabled ? disabledReason || 'AI assistant unavailable' : 'Open AI assistant'}
        >
          AI
        </button>
      ) : (
        <section
          className="ai-fab-panel"
          aria-label="AI assistant panel"
          style={{ maxHeight: `${panelMaxHeight}px` }}
        >
          <header className="ai-fab-header">
            <div>
              <h3>AI Case Assistant</h3>
              <p>Chat + quick actions for litigation workflows.</p>
            </div>
            <button
              className="ai-fab-close"
              type="button"
              aria-label="Close AI assistant"
              onClick={handleClose}
            >
              ×
            </button>
          </header>

          <div className="ai-fab-quick-actions">
            <div className="ai-fab-quick-actions-head">
              <strong>Quick actions</strong>
              <button
                className="secondary-btn"
                type="button"
                onClick={onRefreshQuickActions}
                disabled={disabled || state.loading || quickActionsLoading}
              >
                {quickActionsLoading ? 'Generating...' : 'Refresh'}
              </button>
            </div>
            {quickActionsError ? (
              <p className="ai-fab-quick-error">{quickActionsError}</p>
            ) : null}
            <div className="ai-fab-chip-list">
              {quickActions.map((action) => (
                <button
                  key={action}
                  className="ai-fab-chip"
                  type="button"
                  onClick={() => onQuickActionSelect(action)}
                  disabled={disabled || state.loading}
                  aria-label={`Quick action: ${action}`}
                >
                  {action}
                </button>
              ))}
            </div>
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
            <label htmlFor="ai-fab-prompt-input">Case AI prompt</label>
            <textarea
              id="ai-fab-prompt-input"
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
            <p>{applyHint}</p>
          </div>
        </section>
      )}
    </div>
  );
}
