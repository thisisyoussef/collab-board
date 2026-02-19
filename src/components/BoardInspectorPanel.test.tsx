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

function renderPanel(selectedObject: BoardObject | null, selectedIds: string[] = []) {
  const onDeleteSelected = vi.fn();
  const onDeleteObject = vi.fn();
  const onUpdateObject = vi.fn();
  const onUpdateConnector = vi.fn();

  render(
    <BoardInspectorPanel
      selectedIds={selectedIds}
      selectedObject={selectedObject}
      zoomPercent={120}
      canEditBoard
      onDeleteSelected={onDeleteSelected}
      onDeleteObject={onDeleteObject}
      onUpdateObject={onUpdateObject}
      onUpdateConnector={onUpdateConnector}
    />,
  );

  return {
    onDeleteSelected,
    onDeleteObject,
    onUpdateObject,
    onUpdateConnector,
  };
}

describe('BoardInspectorPanel', () => {
  it('renders neutral inspector state when nothing is selected', () => {
    renderPanel(null, []);
    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();
  });

  it('shows shape controls for rectangle selection and emits style updates', () => {
    const rect = baseObject({ id: 'rect-1', type: 'rect' });
    const { onUpdateObject } = renderPanel(rect, [rect.id]);

    expect(screen.getByText('Rectangle')).toBeInTheDocument();
    expect(screen.getByLabelText('Fill')).toBeInTheDocument();
    expect(screen.getByLabelText('Stroke')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Fill'), {
      target: { value: '#22c55e' },
    });
    expect(onUpdateObject).toHaveBeenCalledWith('rect-1', { color: '#22c55e' });
  });

  it('shows text controls for text selection', () => {
    const text = baseObject({
      id: 'text-1',
      type: 'text',
      text: 'Hello',
      fontSize: 18,
      stroke: undefined,
    });
    renderPanel(text, [text.id]);

    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByLabelText('Font size')).toBeInTheDocument();
  });

  it('shows connector-specific controls and emits connector updates', () => {
    const connector = baseObject({
      id: 'connector-1',
      type: 'connector',
      points: [0, 0, 180, 0],
      connectorType: 'straight',
      strokeStyle: 'solid',
      startArrow: 'none',
      endArrow: 'solid',
      strokeWidth: 2,
      stroke: undefined,
    });
    const { onUpdateConnector } = renderPanel(connector, [connector.id]);

    expect(screen.getByText('Connector')).toBeInTheDocument();
    expect(screen.getByLabelText('Path')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Path'), {
      target: { value: 'curved' },
    });
    expect(onUpdateConnector).toHaveBeenCalledWith('connector-1', {
      connectorType: 'curved',
    });
  });
});

