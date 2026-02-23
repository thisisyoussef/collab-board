import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardToolDock } from './BoardToolDock';

describe('BoardToolDock', () => {
  it('renders all board tools and highlights the active tool', () => {
    render(<BoardToolDock activeTool="rect" canEditBoard onSelectTool={vi.fn()} />);

    const toolbar = screen.getByRole('toolbar', { name: 'Board tools' });
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveClass('board-tool-dock--wide');
    const toolbarWrap = toolbar.closest('.board-tool-dock-wrap');
    expect(toolbarWrap).not.toBeNull();
    expect(toolbarWrap).toHaveClass('board-tool-dock-wrap--expanded');
    expect(screen.getByRole('group', { name: 'Core tools' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Legal nodes' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Legal links' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Canvas tools' })).toBeInTheDocument();
    const selectButton = screen.getByLabelText('Select tool');
    expect(within(selectButton).getByText('Sel')).toBeInTheDocument();
    expect(within(selectButton).getByTestId('dock-icon-select')).toBeInTheDocument();

    const stickyButton = screen.getByLabelText('Case card tool');
    expect(within(stickyButton).getByText('Card')).toBeInTheDocument();
    expect(within(stickyButton).getByTestId('dock-icon-sticky')).toBeInTheDocument();

    expect(screen.getByLabelText('Region tool')).toHaveClass('active');
    expect(within(screen.getByLabelText('Annotation tool')).getByText('Note')).toBeInTheDocument();
    expect(screen.getByLabelText('Relationship tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Claim node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Evidence node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Witness node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Timeline event node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Contradiction node tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Supports link tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Contradicts link tool')).toBeInTheDocument();
    expect(screen.getByLabelText('Dependency link tool')).toBeInTheDocument();
    expect(
      screen.getByText('Draw a rectangular region to group related evidence or argument clusters.'),
    ).toBeInTheDocument();
  });

  it('emits tool selection when a dock button is clicked', () => {
    const onSelectTool = vi.fn();
    render(<BoardToolDock activeTool="select" canEditBoard onSelectTool={onSelectTool} />);

    fireEvent.click(screen.getByLabelText('Annotation tool'));
    expect(onSelectTool).toHaveBeenCalledWith('text');

    fireEvent.click(screen.getByLabelText('Evidence node tool'));
    expect(onSelectTool).toHaveBeenCalledWith('legal_evidence');
    expect(screen.getByLabelText('Evidence node tool')).toHaveAttribute(
      'title',
      expect.stringContaining('Add an exhibit or document card'),
    );

    fireEvent.click(screen.getByLabelText('Contradicts link tool'));
    expect(onSelectTool).toHaveBeenCalledWith('legal_link_contradicts');
  });

  it('keeps editing tools disabled in read-only mode but select remains available', () => {
    render(<BoardToolDock activeTool="select" canEditBoard={false} onSelectTool={vi.fn()} />);

    expect(screen.getByLabelText('Select tool')).toBeEnabled();
    expect(screen.getByLabelText('Case card tool')).toBeDisabled();
    expect(screen.getByLabelText('Relationship tool')).toBeDisabled();
    expect(screen.getByLabelText('Evidence node tool')).toBeDisabled();
    expect(screen.getByLabelText('Contradicts link tool')).toBeDisabled();
  });
});
