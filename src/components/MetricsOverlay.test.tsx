import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricsOverlay } from './MetricsOverlay';

describe('MetricsOverlay', () => {
  it('renders cursor latency and user count metrics', () => {
    render(
      <MetricsOverlay
        averageCursorLatencyMs={24}
        averageObjectLatencyMs={42}
        userCount={3}
        objectCount={5}
        reconnectCount={2}
        connectionStatus="connected"
        connectedSinceMs={Date.now() - 5_000}
      />,
    );

    expect(screen.getByLabelText('Realtime metrics overlay')).toBeInTheDocument();
    expect(screen.getByText(/Cursor avg: 24ms/)).toBeInTheDocument();
    expect(screen.getByText(/Object avg: 42ms/)).toBeInTheDocument();
    expect(screen.getByText('Reconnects: 2')).toBeInTheDocument();
    expect(screen.getByText('Users: 3 | Objects: 5')).toBeInTheDocument();
    expect(screen.getByText(/Status: Connected/)).toBeInTheDocument();
  });
});
