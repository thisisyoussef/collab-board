import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardToolDock } from './BoardToolDock';

describe('BoardToolDock', () => {
  it('renders all board tools and highlights the active tool', () => {
    render(<BoardToolDock activeTool="rect" canEditBoard onSelectTool={vi.fn()} />);

    expect(screen.getByRole('toolbar', { name: 'Board tools' })).toBeInTheDocument();
    expect(screen.getByLabelText('Select tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Sticky note tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Rectangle tool')).toHaveClass('active');
    expect(screen.getByLabelText('Connector tool')).toBeInTheDocument();
  });

  it('emits tool selection when a dock button is clicked', () => {
    const onSelectTool = vi.fn();
    render(<BoardToolDock activeTool="select" canEditBoard onSelectTool={onSelectTool} />);

    fireEvent.click(screen.getByLabelText('Text tool'));
    expect(onSelectTool).toHaveBeenCalledWith('text');
  });

  it('keeps editing tools disabled in read-only mode but select remains available', () => {
    render(<BoardToolDock activeTool="select" canEditBoard={false} onSelectTool={vi.fn()} />);

    expect(screen.getByLabelText('Select tool')).toBeEnabled();
    expect(screen.getByLabelText('Sticky note tool')).toBeDisabled();
    expect(screen.getByLabelText('Connector tool')).toBeDisabled();
  });
});

