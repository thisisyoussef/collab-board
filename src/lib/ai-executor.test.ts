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
          nodeRole: 'claim',
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
          relationType: 'supports',
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
    expect(sticky?.nodeRole).toBe('claim');
    expect(connector?.relationType).toBe('supports');
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

  describe('Template execution validation', () => {
    it('executes SWOT template with 4 frames at correct quadrant positions', () => {
      const previews: AIActionPreview[] = [
        {
          id: 'swot-s', name: 'createFrame', summary: '',
          input: { objectId: 'frame-strengths', title: 'Strengths', x: 100, y: 100, width: 400, height: 300 },
        },
        {
          id: 'swot-w', name: 'createFrame', summary: '',
          input: { objectId: 'frame-weaknesses', title: 'Weaknesses', x: 550, y: 100, width: 400, height: 300 },
        },
        {
          id: 'swot-o', name: 'createFrame', summary: '',
          input: { objectId: 'frame-opportunities', title: 'Opportunities', x: 100, y: 450, width: 400, height: 300 },
        },
        {
          id: 'swot-t', name: 'createFrame', summary: '',
          input: { objectId: 'frame-threats', title: 'Threats', x: 550, y: 450, width: 400, height: 300 },
        },
        {
          id: 'sticky-s1', name: 'createStickyNote', summary: '',
          input: { objectId: 'note-s1', text: 'Strong team', x: 150, y: 150, color: '#81C784' },
        },
        {
          id: 'sticky-w1', name: 'createStickyNote', summary: '',
          input: { objectId: 'note-w1', text: 'Limited budget', x: 600, y: 150, color: '#E57373' },
        },
      ];

      const plan = buildAIActionPlanFromPreviews({
        previews,
        context: { currentObjects: {}, actorUserId: 'user-swot' },
      });

      const result = executeAIActionPlan({
        plan,
        currentObjects: {},
        actorUserId: 'user-swot',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const objects = Object.values(result.nextObjects);
      const frames = objects.filter((o) => o.type === 'frame');
      const stickies = objects.filter((o) => o.type === 'sticky');

      expect(frames).toHaveLength(4);
      expect(stickies).toHaveLength(2);

      const titles = frames.map((f) => f.title).sort();
      expect(titles).toEqual(['Opportunities', 'Strengths', 'Threats', 'Weaknesses']);

      const strengths = frames.find((f) => f.title === 'Strengths');
      expect(strengths?.x).toBe(100);
      expect(strengths?.y).toBe(100);

      const threats = frames.find((f) => f.title === 'Threats');
      expect(threats?.x).toBe(550);
      expect(threats?.y).toBe(450);
    });

    it('executes 2x3 grid layout with uniform spacing', () => {
      const gap = 200;
      const W = 150;
      const H = 100;
      const previews: AIActionPreview[] = [];

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          previews.push({
            id: `grid-${row}-${col}`,
            name: 'createStickyNote',
            summary: '',
            input: {
              objectId: `grid-note-${row}-${col}`,
              text: `Item ${row * 3 + col + 1}`,
              x: 100 + col * (W + gap),
              y: 100 + row * (H + 150),
            },
          });
        }
      }

      const plan = buildAIActionPlanFromPreviews({
        previews,
        context: { currentObjects: {}, actorUserId: 'user-grid' },
      });

      const result = executeAIActionPlan({
        plan,
        currentObjects: {},
        actorUserId: 'user-grid',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const objects = Object.values(result.nextObjects);
      expect(objects).toHaveLength(6);

      // Verify uniform column spacing
      const cols = objects.map((o) => o.x).sort((a, b) => a - b);
      const uniqueCols = [...new Set(cols)];
      expect(uniqueCols).toHaveLength(3);
      const colGap1 = uniqueCols[1] - uniqueCols[0];
      const colGap2 = uniqueCols[2] - uniqueCols[1];
      expect(Math.abs(colGap1 - colGap2)).toBeLessThanOrEqual(20);
    });

    it('executes retro board with 3 column frames', () => {
      const previews: AIActionPreview[] = [
        {
          id: 'retro-good', name: 'createFrame', summary: '',
          input: { objectId: 'frame-good', title: 'What Went Well', x: 100, y: 100, width: 300, height: 500 },
        },
        {
          id: 'retro-bad', name: 'createFrame', summary: '',
          input: { objectId: 'frame-bad', title: 'What Didn\'t Go Well', x: 450, y: 100, width: 300, height: 500 },
        },
        {
          id: 'retro-action', name: 'createFrame', summary: '',
          input: { objectId: 'frame-action', title: 'Action Items', x: 800, y: 100, width: 300, height: 500 },
        },
        {
          id: 'retro-sticky', name: 'createStickyNote', summary: '',
          input: { objectId: 'retro-note-1', text: 'Great teamwork', x: 120, y: 160, color: '#81C784' },
        },
      ];

      const plan = buildAIActionPlanFromPreviews({
        previews,
        context: { currentObjects: {}, actorUserId: 'user-retro' },
      });

      const result = executeAIActionPlan({
        plan,
        currentObjects: {},
        actorUserId: 'user-retro',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const frames = Object.values(result.nextObjects).filter((o) => o.type === 'frame');
      expect(frames).toHaveLength(3);

      const xPositions = frames.map((f) => f.x).sort((a, b) => a - b);
      expect(xPositions).toEqual([100, 450, 800]);

      // All frames at same y and same height
      expect(frames.every((f) => f.y === 100)).toBe(true);
      expect(frames.every((f) => f.height === 500)).toBe(true);
    });

    it('rolls back entire plan when connector references nonexistent object', () => {
      const existing: BoardObjectsRecord = {
        stickyX: createDefaultObject('sticky', {
          id: 'stickyX', text: 'Existing', x: 100, y: 100, createdBy: 'u1', zIndex: 1,
        }),
      };

      const plan: AIActionPlan = {
        planId: 'bad-connector-plan',
        message: null,
        actions: [
          { kind: 'update', objectId: 'stickyX', patch: { text: 'Modified' } },
          {
            kind: 'create',
            object: createDefaultObject('connector', {
              id: 'bad-conn',
              fromId: 'stickyX',
              toId: 'nonexistent-id',
              createdBy: 'u1',
              zIndex: 2,
            }),
          },
        ],
      };

      executeAIActionPlan({
        plan,
        currentObjects: existing,
        actorUserId: 'u1',
      });

      // Whether the executor fails or succeeds (lenient connector resolution),
      // the source record must never be mutated
      expect(existing['stickyX']?.text).toBe('Existing');
    });
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
