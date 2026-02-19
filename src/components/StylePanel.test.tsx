import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StylePanel } from './StylePanel';
import type { BoardObject } from '../types/board';

function makeObject(overrides: Partial<BoardObject>): BoardObject {
  return {
    id: 'obj-1',
    type: 'rect',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    color: '#E3F2FD',
    stroke: '#1565C0',
    strokeWidth: 2,
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('StylePanel', () => {
  // --- Fill color visibility ---
  it('renders fill color picker when sticky selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'sticky', color: '#FFEB3B' })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Fill')).toBeInTheDocument();
  });

  it('renders fill color picker when rect selected', () => {
    render(
      <StylePanel selectedObjects={[makeObject({ type: 'rect' })]} onStyleChange={vi.fn()} />,
    );
    expect(screen.getByText('Fill')).toBeInTheDocument();
  });

  it('does NOT render fill color picker when line selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'line', color: '#0F172A' })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Fill')).not.toBeInTheDocument();
  });

  it('does NOT render fill color picker when connector selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'connector', color: '#64748B' })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Fill')).not.toBeInTheDocument();
  });

  // --- Stroke color visibility ---
  it('renders stroke color picker when rect selected', () => {
    render(
      <StylePanel selectedObjects={[makeObject({ type: 'rect' })]} onStyleChange={vi.fn()} />,
    );
    expect(screen.getByText('Stroke')).toBeInTheDocument();
  });

  it('renders stroke color picker when line selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'line', color: '#0F172A' })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Stroke')).toBeInTheDocument();
  });

  it('does NOT render stroke color picker when sticky selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'sticky', color: '#FFEB3B' })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Stroke')).not.toBeInTheDocument();
  });

  it('does NOT render stroke color picker when text selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'text', color: '#111827' })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Stroke')).not.toBeInTheDocument();
  });

  // --- Stroke width visibility ---
  it('renders stroke width slider when line selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'line', color: '#0F172A', strokeWidth: 3 })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Stroke width')).toBeInTheDocument();
  });

  it('does NOT render stroke width for text', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'text' })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Stroke width')).not.toBeInTheDocument();
  });

  // --- Font size visibility ---
  it('renders font size control when text selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'text', fontSize: 20 })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Font size')).toBeInTheDocument();
  });

  it('renders font size control when sticky selected', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'sticky', fontSize: 14 })]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Font size')).toBeInTheDocument();
  });

  it('does NOT render font size for rect', () => {
    render(
      <StylePanel selectedObjects={[makeObject({ type: 'rect' })]} onStyleChange={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Font size')).not.toBeInTheDocument();
  });

  // --- onStyleChange callback ---
  it('calls onStyleChange with correct id and patch on fill swatch click', () => {
    const onStyleChange = vi.fn();
    render(
      <StylePanel
        selectedObjects={[makeObject({ id: 'rect-1', type: 'rect', color: '#E3F2FD' })]}
        onStyleChange={onStyleChange}
      />,
    );
    // Click first swatch in the fill color picker
    const fillSection = screen.getByText('Fill').closest('.style-panel-section')!;
    const swatches = fillSection.querySelectorAll('.color-swatch');
    fireEvent.click(swatches[0]);
    expect(onStyleChange).toHaveBeenCalledWith(['rect-1'], { color: '#FFEB3B' });
  });

  it('calls onStyleChange with stroke field for shape stroke change', () => {
    const onStyleChange = vi.fn();
    render(
      <StylePanel
        selectedObjects={[makeObject({ id: 'rect-1', type: 'rect', stroke: '#1565C0' })]}
        onStyleChange={onStyleChange}
      />,
    );
    const strokeSection = screen.getByText('Stroke').closest('.style-panel-section')!;
    const swatches = strokeSection.querySelectorAll('.color-swatch');
    fireEvent.click(swatches[2]);
    expect(onStyleChange).toHaveBeenCalledWith(['rect-1'], { stroke: '#F44336' });
  });

  it('calls onStyleChange with color field for line stroke change', () => {
    const onStyleChange = vi.fn();
    render(
      <StylePanel
        selectedObjects={[makeObject({ id: 'line-1', type: 'line', color: '#0F172A' })]}
        onStyleChange={onStyleChange}
      />,
    );
    const strokeSection = screen.getByText('Stroke').closest('.style-panel-section')!;
    const swatches = strokeSection.querySelectorAll('.color-swatch');
    fireEvent.click(swatches[0]);
    expect(onStyleChange).toHaveBeenCalledWith(['line-1'], { color: '#FFEB3B' });
  });

  // --- Multi-select ---
  it('multi-select: shows fill when all support fill (sticky + rect)', () => {
    render(
      <StylePanel
        selectedObjects={[
          makeObject({ id: 's1', type: 'sticky', color: '#FFEB3B' }),
          makeObject({ id: 'r1', type: 'rect', color: '#E3F2FD' }),
        ]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Fill')).toBeInTheDocument();
  });

  it('multi-select: hides fill when mixed incompatible types (sticky + line)', () => {
    render(
      <StylePanel
        selectedObjects={[
          makeObject({ id: 's1', type: 'sticky', color: '#FFEB3B' }),
          makeObject({ id: 'l1', type: 'line', color: '#0F172A' }),
        ]}
        onStyleChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Fill')).not.toBeInTheDocument();
  });

  it('multi-select: shows Mixed for fill when objects have different colors', () => {
    render(
      <StylePanel
        selectedObjects={[
          makeObject({ id: 's1', type: 'sticky', color: '#FFEB3B' }),
          makeObject({ id: 's2', type: 'sticky', color: '#F44336' }),
        ]}
        onStyleChange={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText('Mixed');
    expect(input).toBeInTheDocument();
  });

  it('multi-select: shows shared color when all have same color', () => {
    render(
      <StylePanel
        selectedObjects={[
          makeObject({ id: 's1', type: 'sticky', color: '#FFEB3B' }),
          makeObject({ id: 's2', type: 'sticky', color: '#FFEB3B' }),
        ]}
        onStyleChange={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const fillInput = inputs[0];
    expect(fillInput.value).toBe('FFEB3B');
  });

  it('multi-select: calls onStyleChange with ALL ids', () => {
    const onStyleChange = vi.fn();
    render(
      <StylePanel
        selectedObjects={[
          makeObject({ id: 's1', type: 'sticky', color: '#FFEB3B' }),
          makeObject({ id: 's2', type: 'sticky', color: '#FFEB3B' }),
        ]}
        onStyleChange={onStyleChange}
      />,
    );
    const fillSection = screen.getByText('Fill').closest('.style-panel-section')!;
    const swatches = fillSection.querySelectorAll('.color-swatch');
    fireEvent.click(swatches[2]);
    expect(onStyleChange).toHaveBeenCalledWith(['s1', 's2'], { color: '#F44336' });
  });

  // --- Disabled ---
  it('disabled: no controls are interactive', () => {
    render(
      <StylePanel
        selectedObjects={[makeObject({ type: 'rect' })]}
        disabled
        onStyleChange={vi.fn()}
      />,
    );
    const swatches = screen.getAllByRole('button');
    for (const swatch of swatches) {
      expect(swatch).toBeDisabled();
    }
    const inputs = screen.getAllByRole('textbox');
    for (const input of inputs) {
      expect(input).toBeDisabled();
    }
  });

  // --- Empty selection ---
  it('renders nothing when no objects selected', () => {
    const { container } = render(
      <StylePanel selectedObjects={[]} onStyleChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
