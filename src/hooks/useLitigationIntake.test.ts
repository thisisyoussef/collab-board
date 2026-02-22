import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLitigationIntake } from './useLitigationIntake';

const mockExtractDocumentText = vi.fn<
  (file: File, options?: { maxChars?: number; maxPdfPages?: number }) => Promise<string>
>();
const mockIsPdfDocument = vi.fn<(file: File) => boolean>();

vi.mock('../lib/documentTextExtraction', () => ({
  extractDocumentText: mockExtractDocumentText,
  isPdfDocument: mockIsPdfDocument,
}));

const mockGetIdToken = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockExtractDocumentText.mockImplementation(async (file: File) => {
    try {
      return await file.text();
    } catch {
      return '';
    }
  });
  mockIsPdfDocument.mockImplementation((file: File) => {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  });
  mockGetIdToken.mockResolvedValue('token-123');
  vi.stubGlobal('fetch', mockFetch);
});

describe('useLitigationIntake', () => {
  it('loads draft from endpoint on generate', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: 'Draft generated.',
        draft: {
          claims: [{ id: 'c1', title: 'Design defect' }],
          evidence: [],
          witnesses: [],
          timeline: [],
          links: [],
        },
      }),
    });

    const { result } = renderHook(() =>
      useLitigationIntake({ boardId: 'board-1', user: { getIdToken: mockGetIdToken } as never }),
    );

    await act(async () => {
      result.current.setInputField('caseSummary', 'Case summary text');
      await result.current.generateDraft();
    });

    expect(result.current.draft?.claims).toHaveLength(1);
    expect(result.current.message).toBe('Draft generated.');
    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const parsedBody = JSON.parse(String(request.body));
    expect(parsedBody.preferences).toEqual({
      objective: 'board_overview',
      includeClaims: true,
      includeEvidence: true,
      includeWitnesses: true,
      includeTimeline: true,
    });
  });

  it('can generate from uploaded documents without manual text input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: 'Draft generated from uploads.',
        draft: {
          claims: [{ id: 'c1', title: 'Design defect' }],
          evidence: [{ id: 'e1', label: 'safety-memo.txt' }],
          witnesses: [],
          timeline: [],
          links: [],
        },
      }),
    });

    const { result } = renderHook(() =>
      useLitigationIntake({ boardId: 'board-1', user: { getIdToken: mockGetIdToken } as never }),
    );

    const file = new File(['Alarm escalation and delayed warning'], 'safety-memo.txt', {
      type: 'text/plain',
    });

    await act(async () => {
      await result.current.addUploadedDocuments([file]);
    });

    expect(result.current.uploadedDocuments).toHaveLength(1);
    expect(result.current.canGenerate).toBe(true);

    await act(async () => {
      await result.current.generateDraft();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const parsedBody = JSON.parse(String(request.body));
    expect(parsedBody.intake.evidence).toContain('safety-memo.txt');
    expect(parsedBody.intake.caseSummary).toBe('');
    expect(parsedBody.documents).toHaveLength(1);
    expect(parsedBody.documents[0].name).toBe('safety-memo.txt');
    expect(result.current.message).toBe('Draft generated from uploads.');
  });

  it('deduplicates repeated uploads by filename and size', async () => {
    const { result } = renderHook(() =>
      useLitigationIntake({ boardId: 'board-1', user: { getIdToken: mockGetIdToken } as never }),
    );

    const first = new File(['Alarm escalation and delayed warning'], 'safety-memo.txt', {
      type: 'text/plain',
    });
    const duplicate = new File(['Alarm escalation and delayed warning'], 'safety-memo.txt', {
      type: 'text/plain',
    });

    await act(async () => {
      await result.current.addUploadedDocuments([first, duplicate]);
    });

    expect(result.current.uploadedDocuments).toHaveLength(1);
    expect(result.current.uploadedDocuments[0]?.name).toBe('safety-memo.txt');
  });

  it('uses extracted PDF text in upload payloads', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: 'Draft generated from pdf.',
        draft: {
          claims: [{ id: 'c1', title: 'First-degree murder charge' }],
          evidence: [],
          witnesses: [],
          timeline: [],
          links: [],
        },
      }),
    });

    const extracted =
      'Claims: First-degree murder charge\n' +
      'Evidence/Exhibits: 12 exhibits including autopsy report\n' +
      'Witness Statements: Lou Christoff conflicts with Lane King\n' +
      'Timeline: Events span Feb 27 - March 28, 2023';
    mockExtractDocumentText.mockResolvedValueOnce(extracted);

    const { result } = renderHook(() =>
      useLitigationIntake({ boardId: 'board-1', user: { getIdToken: mockGetIdToken } as never }),
    );

    const file = new File(['%PDF-1.7\u0000\u0001'], '2024-high-school-mock-trial-case-and-exhibits.pdf', {
      type: 'application/pdf',
    });

    await act(async () => {
      await result.current.addUploadedDocuments([file]);
    });

    expect(result.current.uploadedDocuments).toHaveLength(1);
    expect(result.current.uploadedDocuments[0]?.excerpt).toContain('Claims: First-degree murder charge');

    await act(async () => {
      await result.current.generateDraft();
    });

    const request = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const parsedBody = JSON.parse(String(request.body));
    expect(parsedBody.documents[0]?.content).toContain('Claims: First-degree murder charge');
  });

  it('prevents generation when all output sections are disabled', async () => {
    const { result } = renderHook(() =>
      useLitigationIntake({ boardId: 'board-1', user: { getIdToken: mockGetIdToken } as never }),
    );

    await act(async () => {
      result.current.setInputField('caseSummary', 'Case summary text');
      result.current.toggleSection('claims');
      result.current.toggleSection('evidence');
      result.current.toggleSection('witnesses');
      result.current.toggleSection('timeline');
    });

    expect(result.current.canGenerate).toBe(false);

    await act(async () => {
      await result.current.generateDraft();
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Select at least one section to include in the board draft.');
  });

  it('returns error when board id is missing', async () => {
    const { result } = renderHook(() => useLitigationIntake({ boardId: undefined, user: null }));

    await act(async () => {
      await result.current.generateDraft();
    });

    expect(result.current.error).toBe('Board is unavailable. Reload and try again.');
  });
});
