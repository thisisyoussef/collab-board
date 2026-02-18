import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricsOverlay } from './MetricsOverlay';

describe('MetricsOverlay', () => {
  it('renders cursor latency and user count metrics', () => {
    render(<MetricsOverlay averageCursorLatencyMs={24} userCount={3} objectCount={5} />);

    expect(screen.getByLabelText('Realtime metrics overlay')).toBeInTheDocument();
    expect(screen.getByText(/Cursor avg: 24ms/)).toBeInTheDocument();
    expect(screen.getByText('Users: 3 | Objects: 5')).toBeInTheDocument();
  });
});
