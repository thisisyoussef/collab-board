import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetIdToken = vi.fn();
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockGetIdToken.mockResolvedValue('token-123');
  vi.stubGlobal('fetch', mockFetch);
});

import { useContradictionRadar } from './useContradictionRadar';
import type { ContradictionCandidate } from './useContradictionRadar';

function makeCandidate(overrides: Partial<ContradictionCandidate> = {}): ContradictionCandidate {
  return {
    id: 'contra-1',
    topic: 'Timeline discrepancy',
    confidence: 0.85,
    rationale: 'Witness A vs Exhibit B on date.',
    sourceA: {
      objectId: 'node-a',
      label: 'Witness A',
      quote: 'The meeting was in March 2025.',
      citation: { page: '12', ref: 'Deposition A' },
    },
    sourceB: {
      objectId: 'node-b',
      label: 'Exhibit B',
      quote: 'Per our June 2025 meeting.',
      citation: { ref: 'Email chain B' },
    },
    ...overrides,
  };
}

describe('useContradictionRadar', () => {
  it('starts with empty state', () => {
    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.candidates).toHaveLength(0);
    expect(result.current.filteredCandidates).toHaveLength(0);
    expect(result.current.confidenceThreshold).toBe(0.7);
  });

  it('calls API with selected node IDs on runRadar', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [makeCandidate()],
      }),
    });

    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      await result.current.runRadar(['node-a', 'node-b']);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ai/contradictions');
    const body = JSON.parse(String(options.body));
    expect(body.boardId).toBe('board-1');
    expect(body.selectedNodeIds).toEqual(['node-a', 'node-b']);
    expect(result.current.candidates).toHaveLength(1);
  });

  it('filters candidates below confidence threshold', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [
          makeCandidate({ id: 'high', confidence: 0.9 }),
          makeCandidate({ id: 'low', confidence: 0.5 }),
        ],
      }),
    });

    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      await result.current.runRadar(['node-a', 'node-b']);
    });

    expect(result.current.candidates).toHaveLength(2);
    expect(result.current.filteredCandidates).toHaveLength(1);
    expect(result.current.filteredCandidates[0].id).toBe('high');
  });

  it('updates filteredCandidates when threshold changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [
          makeCandidate({ id: 'mid', confidence: 0.65 }),
        ],
      }),
    });

    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      await result.current.runRadar(['node-a', 'node-b']);
    });

    // Default threshold is 0.7, so 0.65 is filtered out
    expect(result.current.filteredCandidates).toHaveLength(0);

    // Lower threshold
    act(() => {
      result.current.setConfidenceThreshold(0.6);
    });

    expect(result.current.filteredCandidates).toHaveLength(1);
  });

  it('supports accept/reject state transitions', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [
          makeCandidate({ id: 'c1', confidence: 0.9 }),
          makeCandidate({ id: 'c2', confidence: 0.8 }),
        ],
      }),
    });

    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      await result.current.runRadar(['node-a', 'node-b']);
    });

    act(() => {
      result.current.accept('c1');
      result.current.reject('c2');
    });

    expect(result.current.decisions.get('c1')).toBe('accepted');
    expect(result.current.decisions.get('c2')).toBe('rejected');
    expect(result.current.acceptedCandidates).toHaveLength(1);
    expect(result.current.acceptedCandidates[0].id).toBe('c1');
  });

  it('generates correct board actions from applyAccepted', async () => {
    const candidate = makeCandidate({ id: 'c1', confidence: 0.9 });
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [candidate],
      }),
    });

    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      await result.current.runRadar(['node-a', 'node-b']);
    });

    act(() => {
      result.current.accept('c1');
    });

    const actions = result.current.applyAccepted();

    // Should produce: 1 sticky card + 2 connectors per accepted contradiction
    expect(actions).toHaveLength(3);

    const createActions = actions.filter((a) => a.kind === 'create');
    expect(createActions).toHaveLength(3);

    // First action is the contradiction card
    const card = createActions[0];
    expect(card.kind).toBe('create');
    if (card.kind === 'create') {
      expect(card.object.type).toBe('sticky');
      expect(card.object.text).toContain('Timeline discrepancy');
      expect(card.object.nodeRole).toBe('claim');
    }

    // Connectors link to source nodes
    const connectors = createActions.filter(
      (a) => a.kind === 'create' && a.object.type === 'connector',
    );
    expect(connectors).toHaveLength(2);
    if (connectors[0].kind === 'create' && connectors[1].kind === 'create') {
      const fromIds = [connectors[0].object.fromId, connectors[1].object.fromId].sort();
      expect(fromIds).toContain('node-a');
      expect(fromIds).toContain('node-b');
      expect(connectors[0].object.relationType).toBe('contradicts');
      expect(connectors[1].object.relationType).toBe('contradicts');
    }
  });

  it('reset clears all state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [makeCandidate()],
      }),
    });

    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      await result.current.runRadar(['node-a', 'node-b']);
    });

    act(() => {
      result.current.accept('contra-1');
    });

    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.acceptedCandidates).toHaveLength(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.candidates).toHaveLength(0);
    expect(result.current.filteredCandidates).toHaveLength(0);
    expect(result.current.acceptedCandidates).toHaveLength(0);
    expect(result.current.decisions.size).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('sets error on API failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'AI analysis failed' }),
    });

    const { result } = renderHook(() =>
      useContradictionRadar({
        boardId: 'board-1',
        user: { getIdToken: mockGetIdToken } as never,
      }),
    );

    await act(async () => {
      await result.current.runRadar(['node-a', 'node-b']);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.candidates).toHaveLength(0);
  });
});
