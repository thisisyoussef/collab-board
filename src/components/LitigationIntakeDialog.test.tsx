import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LitigationIntakeDialog, type LitigationIntakeDraft } from './LitigationIntakeDialog';

const emptyInput = {
  caseSummary: '',
  claims: '',
  witnesses: '',
  evidence: '',
  timeline: '',
};

function renderDialog(overrides: Partial<ComponentProps<typeof LitigationIntakeDialog>> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onGenerateDraft: vi.fn(),
    onApplyDraft: vi.fn(),
    onInputChange: vi.fn(),
    onDocumentsSelected: vi.fn(),
    onRemoveDocument: vi.fn(),
    onObjectiveChange: vi.fn(),
    onSectionToggle: vi.fn(),
  };

  render(
    <LitigationIntakeDialog
      open
      loading={false}
      error={null}
      input={emptyInput}
      draft={null}
      canGenerate={false}
      objective="board_overview"
      includedSections={{
        claims: true,
        evidence: true,
        witnesses: true,
        timeline: true,
      }}
      uploadedDocuments={[]}
      {...handlers}
      {...overrides}
    />,
  );

  return handlers;
}

describe('LitigationIntakeDialog', () => {
  it('renders guided intake fields and examples', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Build board from case input' })).toBeInTheDocument();
    expect(screen.getByLabelText('Case summary', { selector: 'textarea' })).toBeInTheDocument();
    expect(screen.getByLabelText('Claims', { selector: 'textarea' })).toBeInTheDocument();
    expect(screen.getByLabelText('Witness excerpts', { selector: 'textarea' })).toBeInTheDocument();
    expect(screen.getByLabelText('Evidence / exhibits', { selector: 'textarea' })).toBeInTheDocument();
    expect(screen.getByLabelText('Timeline notes', { selector: 'textarea' })).toBeInTheDocument();
    expect(screen.getByLabelText('Upload documents')).toBeInTheDocument();
    expect(screen.getByText('Need an example input?')).toBeInTheDocument();
    expect(screen.getByText('What should this board focus on?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Case strategy overview/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Claims' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Timeline' })).toBeInTheDocument();
  });

  it('disables generate when all inputs are empty', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Generate draft' })).toBeDisabled();
  });

  it('calls onInputChange when user types', () => {
    const { onInputChange } = renderDialog();

    fireEvent.change(screen.getByLabelText('Case summary'), {
      target: { value: 'Plaintiff alleges design defect caused injury.' },
    });

    expect(onInputChange).toHaveBeenCalledWith('caseSummary', 'Plaintiff alleges design defect caused injury.');
  });

  it('forwards uploaded files to onDocumentsSelected', () => {
    const { onDocumentsSelected } = renderDialog();
    const file = new File(['Device safety memo'], 'safety-memo.txt', { type: 'text/plain' });

    fireEvent.change(screen.getByLabelText('Upload documents'), {
      target: { files: [file] },
    });

    expect(onDocumentsSelected).toHaveBeenCalledTimes(1);
    expect(onDocumentsSelected).toHaveBeenCalledWith([file]);
  });

  it('calls objective and section handlers when options change', () => {
    const { onObjectiveChange, onSectionToggle } = renderDialog();

    fireEvent.click(screen.getByRole('radio', { name: /Witness contradiction review/i }));
    expect(onObjectiveChange).toHaveBeenCalledWith('contradictions');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Timeline' }));
    expect(onSectionToggle).toHaveBeenCalledWith('timeline');
  });

  it('renders preview and apply action when draft exists', () => {
    const draft: LitigationIntakeDraft = {
      claims: [{ id: 'c1', title: 'Design defect' }],
      evidence: [{ id: 'e1', label: 'Ex.12 Memo' }],
      witnesses: [{ id: 'w1', name: 'Dr. Lee' }],
      timeline: [{ id: 't1', dateLabel: 'Mar 2024', event: 'Repeated alarms' }],
      links: [{ fromId: 'e1', toId: 'c1', relation: 'supports' }],
    };

    const { onApplyDraft } = renderDialog({
      draft,
      canGenerate: true,
      input: { ...emptyInput, caseSummary: 'case' },
      objective: 'chronology',
      includedSections: {
        claims: true,
        evidence: true,
        witnesses: false,
        timeline: true,
      },
      uploadedDocuments: [
        {
          id: 'doc-1',
          name: 'memo.txt',
          mimeType: 'text/plain',
          size: 120,
          excerpt: 'Safety review excerpt',
          content: 'Safety review excerpt',
        },
      ],
    });

    expect(screen.getByText('Draft preview')).toBeInTheDocument();
    expect(screen.getByText('Claims: 1')).toBeInTheDocument();
    expect(screen.getByText('memo.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply to board' }));
    expect(onApplyDraft).toHaveBeenCalledTimes(1);
  });
});
