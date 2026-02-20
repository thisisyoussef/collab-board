import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricsOverlay } from './MetricsOverlay';

/** Helper: render MetricsOverlay with sensible defaults, overriding specific props. */
function renderOverlay(overrides: Record<string, unknown> = {}) {
  const defaults = {
    averageCursorLatencyMs: 24,
    averageObjectLatencyMs: 42,
    averageAIApplyLatencyMs: 120,
    averageAIRequestLatencyMs: 1200,
    aiApplyCount: 3,
    aiDedupeDrops: 1,
    userCount: 3,
    objectCount: 5,
    reconnectCount: 2,
    connectionStatus: 'connected' as const,
    connectedSinceMs: Date.now() - 5_000,
  };

  return render(<MetricsOverlay {...defaults} {...overrides} />);
}

describe('MetricsOverlay', () => {
  it('renders all core metric fields', () => {
    renderOverlay();

    expect(screen.getByLabelText('Realtime metrics overlay')).toBeInTheDocument();
    expect(screen.getByText(/Cursor avg: 24ms/)).toBeInTheDocument();
    expect(screen.getByText(/Object avg: 42ms/)).toBeInTheDocument();
    expect(screen.getByText(/AI apply avg: 120ms/)).toBeInTheDocument();
    expect(screen.getByText(/AI request avg: 1200ms/)).toBeInTheDocument();
    expect(screen.getByText('AI applies: 3 | AI dedupe drops: 1')).toBeInTheDocument();
    expect(screen.getByText('Reconnects: 2')).toBeInTheDocument();
    expect(screen.getByText(/Users: 3 \| Objects: 5\/500 ✅/)).toBeInTheDocument();
    expect(screen.getByText(/Status: Connected/)).toBeInTheDocument();
  });

  // --- Cursor latency threshold indicators ---

  it('shows ✅ when cursor latency is below 50ms target', () => {
    renderOverlay({ averageCursorLatencyMs: 24 });
    expect(screen.getByText(/Cursor avg: 24ms ✅/)).toBeInTheDocument();
  });

  it('shows ⚠️ when cursor latency exceeds 50ms target', () => {
    renderOverlay({ averageCursorLatencyMs: 75 });
    expect(screen.getByText(/Cursor avg: 75ms ⚠️/)).toBeInTheDocument();
  });

  // --- Object sync latency threshold indicators ---

  it('shows ✅ when object latency is below 100ms target', () => {
    renderOverlay({ averageObjectLatencyMs: 42 });
    expect(screen.getByText(/Object avg: 42ms ✅/)).toBeInTheDocument();
  });

  it('shows ⚠️ when object latency exceeds 100ms target', () => {
    renderOverlay({ averageObjectLatencyMs: 150 });
    expect(screen.getByText(/Object avg: 150ms ⚠️/)).toBeInTheDocument();
  });

  // --- AI request latency indicators ---

  it('shows dash when AI request latency is zero (no requests yet)', () => {
    renderOverlay({ averageAIRequestLatencyMs: 0 });
    expect(screen.getByText(/AI request avg: 0ms —/)).toBeInTheDocument();
  });

  it('shows ✅ when AI request latency is below 2000ms', () => {
    renderOverlay({ averageAIRequestLatencyMs: 1200 });
    expect(screen.getByText(/AI request avg: 1200ms ✅/)).toBeInTheDocument();
  });

  it('shows ⚠️ when AI request latency exceeds 2000ms', () => {
    renderOverlay({ averageAIRequestLatencyMs: 3500 });
    expect(screen.getByText(/AI request avg: 3500ms ⚠️/)).toBeInTheDocument();
  });

  // --- Connection status ---

  it('shows offline status when disconnected', () => {
    renderOverlay({ connectionStatus: 'disconnected' });
    expect(screen.getByText('Status: Offline')).toBeInTheDocument();
  });
});
