import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardInspectorPanel } from './BoardInspectorPanel';
import type { BoardObject } from '../types/board';

function baseObject(overrides: Partial<BoardObject>): BoardObject {
  return {
    id: 'object-1',
    type: 'rect',
    x: 100,
    y: 120,
    width: 220,
    height: 140,
    rotation: 0,
    color: '#e2e8f0',
    stroke: '#334155',
    strokeWidth: 2,
    zIndex: 1,
    createdBy: 'user-1',
    updatedAt: '2026-02-19T00:00:00.000Z',
    ...overrides,
  };
}

const defaultCallbacks = () => ({
  onDeleteSelected: vi.fn(),
  onDeleteObject: vi.fn(),
  onUpdateObject: vi.fn(),
  onUpdateConnector: vi.fn(),
  onBatchStyleChange: vi.fn(),
  onDuplicate: vi.fn(),
  onCopy: vi.fn(),
  onPaste: vi.fn(),
});

function renderPanel(
  selectedObject: BoardObject | null,
  selectedIds: string[] = [],
  overrides: Partial<ReturnType<typeof defaultCallbacks>> = {},
) {
  const cbs = { ...defaultCallbacks(), ...overrides };
  const selectedObjects = selectedObject ? [selectedObject] : [];

  render(
    <BoardInspectorPanel
      selectedIds={selectedIds}
      selectedObject={selectedObject}
      selectedObjects={selectedObjects}
      zoomPercent={120}
      canEditBoard
      onDeleteSelected={cbs.onDeleteSelected}
      onDeleteObject={cbs.onDeleteObject}
      onUpdateObject={cbs.onUpdateObject}
      onUpdateConnector={cbs.onUpdateConnector}
      onBatchStyleChange={cbs.onBatchStyleChange}
      onDuplicate={cbs.onDuplicate}
      onCopy={cbs.onCopy}
      onPaste={cbs.onPaste}
    />,
  );

  return cbs;
}

describe('BoardInspectorPanel', () => {
  it('renders neutral inspector state when nothing is selected', () => {
    renderPanel(null, []);
    expect(screen.getByText('Case element inspector')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();
  });

  it('shows shape label and dimensions for rectangle selection', () => {
    const rect = baseObject({ id: 'rect-1', type: 'rect' });
    renderPanel(rect, [rect.id]);

    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // x
    expect(screen.getByText('120')).toBeInTheDocument(); // y
    expect(screen.getByText('220')).toBeInTheDocument(); // w
    expect(screen.getByText('140')).toBeInTheDocument(); // h
  });

  it('shows StylePanel fill and stroke for rect', () => {
    const rect = baseObject({ id: 'rect-1', type: 'rect' });
    renderPanel(rect, [rect.id]);

    expect(screen.getByText('Fill')).toBeInTheDocument();
    expect(screen.getByText('Stroke')).toBeInTheDocument();
  });

  it('shows StylePanel fill but no stroke for sticky', () => {
    const sticky = baseObject({ id: 's1', type: 'sticky', color: '#FFEB3B' });
    renderPanel(sticky, [sticky.id]);

    expect(screen.getByText('Fill')).toBeInTheDocument();
    expect(screen.queryByText('Stroke')).not.toBeInTheDocument();
  });

  it('shows StylePanel font size for text', () => {
    const text = baseObject({
      id: 'text-1',
      type: 'text',
      text: 'Hello',
      fontSize: 18,
    });
    renderPanel(text, [text.id]);

    expect(screen.getByText('Annotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Font size')).toBeInTheDocument();
  });

  it('calls onBatchStyleChange when swatch is clicked on rect', () => {
    const onBatchStyleChange = vi.fn();
    const rect = baseObject({ id: 'rect-1', type: 'rect', color: '#E3F2FD' });
    renderPanel(rect, [rect.id], { onBatchStyleChange });

    const fillSection = screen.getByText('Fill').closest('.style-panel-section')!;
    const swatches = fillSection.querySelectorAll('.color-swatch');
    fireEvent.click(swatches[0]);
    expect(onBatchStyleChange).toHaveBeenCalledWith(['rect-1'], { color: '#FFEB3B' });
  });

  it('shows connector-specific controls and emits connector updates', () => {
    const connector = baseObject({
      id: 'connector-1',
      type: 'connector',
      connectorType: 'straight',
      strokeStyle: 'solid',
      startArrow: 'none',
      endArrow: 'solid',
      strokeWidth: 2,
    });
    const { onUpdateConnector } = renderPanel(connector, [connector.id]);

    expect(screen.getByText('Relationship')).toBeInTheDocument();
    expect(screen.getByLabelText('Path')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Path'), {
      target: { value: 'curved' },
    });
    expect(onUpdateConnector).toHaveBeenCalledWith('connector-1', {
      connectorType: 'curved',
    });

    fireEvent.change(screen.getByLabelText('Relation'), {
      target: { value: 'contradicts' },
    });
    expect(onUpdateConnector).toHaveBeenCalledWith('connector-1', {
      relationType: 'contradicts',
    });
  });

  it('shows node role control and emits object role updates', () => {
    const claim = baseObject({
      id: 'claim-1',
      type: 'text',
      text: 'Breach claim',
      fontSize: 16,
    });
    const { onUpdateObject } = renderPanel(claim, [claim.id]);

    fireEvent.change(screen.getByLabelText('Node role'), {
      target: { value: 'claim' },
    });

    expect(onUpdateObject).toHaveBeenCalledWith('claim-1', {
      nodeRole: 'claim',
    });

    fireEvent.change(screen.getByLabelText('Node role'), {
      target: { value: 'contradiction' },
    });

    expect(onUpdateObject).toHaveBeenCalledWith('claim-1', {
      nodeRole: 'contradiction',
    });
  });

  it('shows connector stroke in StylePanel', () => {
    const connector = baseObject({
      id: 'connector-1',
      type: 'connector',
      color: '#64748B',
    });
    renderPanel(connector, [connector.id]);

    // StylePanel should show stroke controls for connectors
    expect(screen.getByText('Stroke')).toBeInTheDocument();
    // No fill for connectors
    expect(screen.queryByText('Fill')).not.toBeInTheDocument();
  });

  it('shows multi-select count and StylePanel', () => {
    const cbs = defaultCallbacks();
    const objects = [
      baseObject({ id: 's1', type: 'sticky', color: '#FFEB3B' }),
      baseObject({ id: 's2', type: 'sticky', color: '#FF9800' }),
    ];

    render(
      <BoardInspectorPanel
        selectedIds={['s1', 's2']}
        selectedObject={null}
        selectedObjects={objects}
        zoomPercent={100}
        canEditBoard
        {...cbs}
      />,
    );

    expect(screen.getByText('2 objects')).toBeInTheDocument();
    expect(screen.getByText('Fill')).toBeInTheDocument();
  });

  it('shows Duplicate, Copy, Paste buttons for single-select', () => {
    const rect = baseObject({ id: 'rect-1', type: 'rect' });
    renderPanel(rect, [rect.id]);

    expect(screen.getByTitle('Duplicate (Ctrl+D)')).toBeInTheDocument();
    expect(screen.getByTitle('Copy (Ctrl+C)')).toBeInTheDocument();
    expect(screen.getByTitle('Paste (Ctrl+V)')).toBeInTheDocument();
  });

  it('calls onDuplicate when Duplicate button clicked', () => {
    const onDuplicate = vi.fn();
    const rect = baseObject({ id: 'rect-1', type: 'rect' });
    renderPanel(rect, [rect.id], { onDuplicate });

    fireEvent.click(screen.getByTitle('Duplicate (Ctrl+D)'));
    expect(onDuplicate).toHaveBeenCalled();
  });

  it('calls onDeleteObject when Delete button clicked for single-select', () => {
    const onDeleteObject = vi.fn();
    const rect = baseObject({ id: 'rect-1', type: 'rect' });
    renderPanel(rect, [rect.id], { onDeleteObject });

    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteObject).toHaveBeenCalledWith('rect-1');
  });
});
