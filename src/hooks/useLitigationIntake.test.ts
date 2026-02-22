import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLitigationIntake } from './useLitigationIntake';

const mockGetIdToken = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(result.current.message).toBe('Draft generated from uploads.');
  });

  it('returns error when board id is missing', async () => {
    const { result } = renderHook(() => useLitigationIntake({ boardId: undefined, user: null }));

    await act(async () => {
      await result.current.generateDraft();
    });

    expect(result.current.error).toBe('Board is unavailable. Reload and try again.');
  });
});
