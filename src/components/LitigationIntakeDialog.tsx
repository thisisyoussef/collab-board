import type {
  LitigationIntakeDraft,
  LitigationIntakeInput,
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
  uploadedDocuments: LitigationUploadedDocument[];
  onClose: () => void;
  onInputChange: (field: InputField, value: string) => void;
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
  uploadedDocuments,
  onClose,
  onInputChange,
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
