import { describe, expect, it } from 'vitest';
import { createDefaultObject, sanitizeBoardObjectForFirestore } from './board-object';
import { buildAIActionPlanFromPreviews, executeAIActionPlan } from './ai-executor';
import type { AIActionPreview, AIActionPlan } from '../types/ai';
import type { BoardObjectsRecord } from '../types/board';

function normalizeRecord(record: BoardObjectsRecord): BoardObjectsRecord {
  const next: BoardObjectsRecord = {};
  Object.entries(record).forEach(([id, entry]) => {
    next[id] = {
      ...sanitizeBoardObjectForFirestore(entry),
      updatedAt: 'normalized-ts',
    };
  });
  return next;
}

describe('ai-executor', () => {
  it('builds and executes ordered AI actions across core primitives', () => {
    const previews: AIActionPreview[] = [
      {
        id: 'create-sticky',
        name: 'createStickyNote',
        summary: '',
        input: {
          objectId: 'sticky-1',
          text: 'Kickoff',
          x: 120,
          y: 120,
          color: '#FFEB3B',
        },
      },
      {
        id: 'create-rect',
        name: 'createShape',
        summary: '',
        input: {
          objectId: 'rect-1',
          type: 'rect',
          x: 420,
          y: 120,
          width: 180,
          height: 120,
          color: '#E3F2FD',
        },
      },
      {
        id: 'create-link',
        name: 'createConnector',
        summary: '',
        input: {
          objectId: 'connector-1',
          fromId: 'sticky-1',
          toId: 'rect-1',
          style: 'arrow',
        },
      },
      {
        id: 'recolor',
        name: 'changeColor',
        summary: '',
        input: {
          objectId: 'rect-1',
          color: '#10B981',
        },
      },
    ];

    const plan = buildAIActionPlanFromPreviews(
      {
        previews,
        context: {
          currentObjects: {},
          actorUserId: 'user-1',
        },
      },
      {
        createId: () => 'plan-id',
        nowMs: () => 1739836800000,
      },
    );

    const result = executeAIActionPlan(
      {
        plan,
        currentObjects: {},
        actorUserId: 'user-1',
      },
      {
        createId: () => 'tx-id',
        nowMs: () => 1739836800000,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.diff.createdIds.sort()).toEqual(['connector-1', 'rect-1', 'sticky-1']);
    expect(result.diff.updatedIds).toEqual([]);
    expect(result.diff.deletedIds).toEqual([]);
    expect(result.transaction.txId).toBe('tx-id');

    const sticky = result.nextObjects['sticky-1'];
    const rect = result.nextObjects['rect-1'];
    const connector = result.nextObjects['connector-1'];

    expect(sticky?.type).toBe('sticky');
    expect(rect?.type).toBe('rect');
    expect(rect?.color).toBe('#10B981');
    expect(connector?.type).toBe('connector');
    expect(connector?.fromId).toBe('sticky-1');
    expect(connector?.toId).toBe('rect-1');
    expect(connector?.points).toHaveLength(4);
  });

  it('accepts createShape plans with missing dimensions by applying defaults', () => {
    const previews: AIActionPreview[] = [
      {
        id: 'line-defaults',
        name: 'createShape',
        summary: '',
        input: {
          objectId: 'line-1',
          type: 'line',
          x: 300,
          y: 200,
        },
      },
      {
        id: 'line-endpoints',
        name: 'createShape',
        summary: '',
        input: {
          objectId: 'line-2',
          type: 'line',
          x: 120,
          y: 120,
          x2: 280,
          y2: 220,
        },
      },
      {
        id: 'frame-default-size',
        name: 'createFrame',
        summary: '',
        input: {
          objectId: 'frame-1',
          x: 640,
          y: 80,
        },
      },
    ];

    const plan = buildAIActionPlanFromPreviews({
      previews,
      context: {
        currentObjects: {},
        actorUserId: 'user-2',
      },
    });

    const result = executeAIActionPlan({
      plan,
      currentObjects: {},
      actorUserId: 'user-2',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.nextObjects['line-1']).toBeDefined();
    expect(result.nextObjects['line-1']?.type).toBe('line');
    expect(result.nextObjects['line-1']?.points).toEqual([0, 0, 140, 0]);

    expect(result.nextObjects['line-2']).toBeDefined();
    expect(result.nextObjects['line-2']?.points).toEqual([0, 0, 160, 100]);

    expect(result.nextObjects['frame-1']).toBeDefined();
    expect(result.nextObjects['frame-1']?.type).toBe('frame');
    expect(result.nextObjects['frame-1']?.title).toBe('Frame');
  });

  it('fails safely without mutating source when one action is invalid', () => {
    const source: BoardObjectsRecord = {
      stickyA: createDefaultObject('sticky', {
        id: 'stickyA',
        text: 'Keep',
        x: 100,
        y: 100,
        createdBy: 'u1',
        zIndex: 1,
      }),
    };

    const invalidPlan: AIActionPlan = {
      planId: 'bad-plan',
      message: null,
      actions: [
        { kind: 'update', objectId: 'stickyA', patch: { text: 'Changed once' } },
        { kind: 'update', objectId: 'missing', patch: { x: 999 } },
      ],
    };

    const result = executeAIActionPlan({
      plan: invalidPlan,
      currentObjects: source,
      actorUserId: 'u1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.failedActionIndex).toBe(1);
    expect(source['stickyA']?.text).toBe('Keep');
  });

  it('supports single-step undo by applying inverse actions transactionally', () => {
    const initial: BoardObjectsRecord = {
      textA: createDefaultObject('text', {
        id: 'textA',
        text: 'Before',
        x: 220,
        y: 140,
        createdBy: 'u2',
        zIndex: 1,
      }),
    };

    const plan: AIActionPlan = {
      planId: 'plan-undo',
      message: null,
      actions: [
        {
          kind: 'update',
          objectId: 'textA',
          patch: { text: 'After', color: '#1D4ED8' },
        },
        {
          kind: 'create',
          object: createDefaultObject('circle', {
            id: 'circleA',
            x: 480,
            y: 140,
            width: 120,
            height: 120,
            createdBy: 'u2',
            zIndex: 2,
          }),
        },
      ],
    };

    const applied = executeAIActionPlan({
      plan,
      currentObjects: initial,
      actorUserId: 'u2',
    });

    expect(applied.ok).toBe(true);
    if (!applied.ok) {
      return;
    }

    const undoPlan: AIActionPlan = {
      planId: 'undo-plan',
      message: null,
      actions: applied.transaction.inverseActions,
    };

    const undone = executeAIActionPlan({
      plan: undoPlan,
      currentObjects: applied.nextObjects,
      actorUserId: 'u2',
    });

    expect(undone.ok).toBe(true);
    if (!undone.ok) {
      return;
    }

    expect(normalizeRecord(undone.nextObjects)).toEqual(normalizeRecord(initial));
  });
});
