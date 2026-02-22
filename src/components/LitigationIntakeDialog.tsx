import type {
  LitigationIntakeDraft,
  LitigationIntakeInput,
  LitigationIntakeObjective,
  LitigationSectionKey,
  LitigationUploadedDocument,
} from '../types/litigation';

type InputField = keyof LitigationIntakeInput;

interface LitigationIntakeDialogProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  message?: string | null;
  input: LitigationIntakeInput;
  draft: LitigationIntakeDraft | null;
  canGenerate: boolean;
  objective: LitigationIntakeObjective;
  includedSections: Record<LitigationSectionKey, boolean>;
  uploadedDocuments: LitigationUploadedDocument[];
  onClose: () => void;
  onInputChange: (field: InputField, value: string) => void;
  onObjectiveChange: (objective: LitigationIntakeObjective) => void;
  onSectionToggle: (section: LitigationSectionKey) => void;
  onDocumentsSelected: (files: File[]) => void;
  onRemoveDocument: (documentId: string) => void;
  onGenerateDraft: () => void;
  onApplyDraft: () => void;
}

interface FieldConfig {
  id: string;
  label: string;
  field: InputField;
  placeholder: string;
  rows: number;
}

const FIELD_CONFIG: FieldConfig[] = [
  {
    id: 'litigation-case-summary',
    label: 'Case summary',
    field: 'caseSummary',
    placeholder: 'Briefly summarize parties, allegations, and key legal theory.',
    rows: 4,
  },
  {
    id: 'litigation-claims',
    label: 'Claims',
    field: 'claims',
    placeholder: '- Breach of contract\n- Failure to warn',
    rows: 4,
  },
  {
    id: 'litigation-witnesses',
    label: 'Witness excerpts',
    field: 'witnesses',
    placeholder: '- Dr. Lee: Alarm frequency increased (Dep. 44:12-45:3)',
    rows: 4,
  },
  {
    id: 'litigation-evidence',
    label: 'Evidence / exhibits',
    field: 'evidence',
    placeholder: '- Ex.12 Internal Memo (p.3)\n- Ex.4 Inspection report (p.9)',
    rows: 4,
  },
  {
    id: 'litigation-timeline',
    label: 'Timeline notes',
    field: 'timeline',
    placeholder: '- Mar 2024: Repeated device alarms\n- Apr 2024: Recall notice issued',
    rows: 4,
  },
];

const OBJECTIVE_OPTIONS: Array<{
  value: LitigationIntakeObjective;
  label: string;
  description: string;
}> = [
  {
    value: 'board_overview',
    label: 'Case strategy overview',
    description: 'Build a balanced claims/evidence/witness/timeline board.',
  },
  {
    value: 'chronology',
    label: 'Chronology and event flow',
    description: 'Prioritize timeline events and dependencies.',
  },
  {
    value: 'contradictions',
    label: 'Witness contradiction review',
    description: 'Emphasize conflicting witness/evidence statements.',
  },
  {
    value: 'witness_prep',
    label: 'Witness prep pack',
    description: 'Focus on witness statements tied to supporting exhibits.',
  },
];

const SECTION_OPTIONS: Array<{ key: LitigationSectionKey; label: string }> = [
  { key: 'claims', label: 'Claims' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'witnesses', label: 'Witnesses' },
  { key: 'timeline', label: 'Timeline' },
];

function hasAnyInputValue(input: LitigationIntakeInput): boolean {
  return Object.values(input).some((value) => value.trim().length > 0);
}

export function LitigationIntakeDialog({
  open,
  loading,
  error,
  message = null,
  input,
  draft,
  canGenerate,
  objective,
  includedSections,
  uploadedDocuments,
  onClose,
  onInputChange,
  onObjectiveChange,
  onSectionToggle,
  onDocumentsSelected,
  onRemoveDocument,
  onGenerateDraft,
  onApplyDraft,
}: LitigationIntakeDialogProps) {
  if (!open) {
    return null;
  }

  const canGenerateDraft = (canGenerate || hasAnyInputValue(input)) && !loading;
  const canApply = Boolean(draft) && !loading;

  return (
    <div className="litigation-intake-overlay" role="presentation" onClick={onClose}>
      <aside
        className="litigation-intake-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Build board from case input"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="litigation-intake-header">
          <div>
            <p className="litigation-intake-kicker">Litigation intake</p>
            <h3>Build board from case input</h3>
            <p className="litigation-intake-muted">
              Provide case notes and supporting excerpts. Review before applying to the board.
            </p>
          </div>
          <button className="secondary-btn" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="litigation-intake-example">
          <strong>Need an example input?</strong>
          <p>
            Include claims, witness excerpts, evidence, and timeline bullets. The parser will scaffold
            claims/evidence/witness/timeline lanes with connectors.
          </p>
        </div>

        <section className="litigation-intake-options" aria-label="Intake options">
          <div className="litigation-intake-option-group">
            <h4>What should this board focus on?</h4>
            <p>Pick one objective so the generator prioritizes the right structure.</p>
            <div className="litigation-intake-objective-grid">
              {OBJECTIVE_OPTIONS.map((option) => {
                const inputId = `litigation-objective-${option.value}`;
                return (
                  <label key={option.value} htmlFor={inputId} className="litigation-intake-choice-card">
                    <input
                      id={inputId}
                      type="radio"
                      name="litigation-intake-objective"
                      checked={objective === option.value}
                      onChange={() => onObjectiveChange(option.value)}
                      disabled={loading}
                    />
                    <span className="litigation-intake-choice-label">{option.label}</span>
                    <span className="litigation-intake-choice-detail">{option.description}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="litigation-intake-option-group">
            <h4>What should be included?</h4>
            <p>Choose exactly which sections should be generated on the board.</p>
            <div className="litigation-intake-section-toggles">
              {SECTION_OPTIONS.map((option) => {
                const inputId = `litigation-section-${option.key}`;
                return (
                  <label key={option.key} htmlFor={inputId}>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={includedSections[option.key]}
                      onChange={() => onSectionToggle(option.key)}
                      disabled={loading}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <label className="litigation-intake-upload" htmlFor="litigation-documents-upload">
          <span>Upload documents</span>
          <input
            id="litigation-documents-upload"
            type="file"
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files || []);
              if (files.length > 0) {
                onDocumentsSelected(files);
              }
              event.currentTarget.value = '';
            }}
            disabled={loading}
          />
        </label>

        {uploadedDocuments.length > 0 ? (
          <ul className="litigation-intake-file-list" aria-label="Uploaded documents">
            {uploadedDocuments.map((document) => (
              <li key={document.id}>
                <div>
                  <strong>{document.name}</strong>
                  <p>{document.excerpt || 'No text extracted yet.'}</p>
                </div>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => onRemoveDocument(document.id)}
                  disabled={loading}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="litigation-intake-fields">
          {FIELD_CONFIG.map((config) => (
            <label key={config.id} className="litigation-intake-field" htmlFor={config.id}>
              <span>{config.label}</span>
              <textarea
                id={config.id}
                value={input[config.field]}
                onChange={(event) => onInputChange(config.field, event.target.value)}
                placeholder={config.placeholder}
                rows={config.rows}
                disabled={loading}
              />
            </label>
          ))}
        </div>

        {error ? (
          <div className="litigation-intake-feedback error" role="alert">
            {error}
          </div>
        ) : null}
        {message ? <div className="litigation-intake-feedback success">{message}</div> : null}

        {draft ? (
          <section className="litigation-intake-preview" aria-label="Draft preview">
            <h4>Draft preview</h4>
            <p>Claims: {draft.claims.length}</p>
            <p>Evidence: {draft.evidence.length}</p>
            <p>Witnesses: {draft.witnesses.length}</p>
            <p>Timeline: {draft.timeline.length}</p>
            <p>Connectors: {draft.links.length}</p>
          </section>
        ) : null}

        <footer className="litigation-intake-actions">
          <button
            className="primary-btn"
            type="button"
            disabled={!canGenerateDraft}
            onClick={onGenerateDraft}
          >
            {loading ? 'Generating...' : 'Generate draft'}
          </button>
          <button
            className="secondary-btn"
            type="button"
            disabled={!canApply}
            onClick={onApplyDraft}
          >
            Apply to board
          </button>
        </footer>
      </aside>
    </div>
  );
}

export type { LitigationIntakeDraft, LitigationUploadedDocument };
