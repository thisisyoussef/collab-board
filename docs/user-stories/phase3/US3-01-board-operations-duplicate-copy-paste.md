# US3-01: Board Operations - Duplicate and Copy/Paste

## Status

- State: Pending
- Owner: Codex
- Depends on: US3-00 approved

## Persona

**Alex, the Power User** needs fast object duplication workflows during live facilitation.

**Sam, the Collaborator** expects copy/paste to preserve visual fidelity and relative positioning.

**Jordan, the QA Reviewer** needs deterministic clipboard behavior across object types.

## User Story

> As Alex, I want duplicate and copy/paste operations so I can build board structures quickly.

> As Sam, I want pasted items to keep expected styles and geometry so edits remain predictable.

> As Jordan, I want operation behavior consistent across primitives so regressions are testable.

## Goal

Implement missing PRD operations: duplicate, copy, and paste for supported board objects, including multi-select behavior and robust clipboard payload handling.

## Scope

In scope:

1. Duplicate selected object(s).
2. Copy selected object(s) into app clipboard.
3. Paste clipboard content as new objects with offset placement.
4. Support for sticky, rect, circle, line, text, frame, connector.
5. Realtime + persistence integration for pasted/duplicated objects.
6. Guardrails for empty/invalid clipboard payloads.

Out of scope:

1. OS-global clipboard interoperability beyond app JSON payload.
2. Cross-board clipboard sync.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

## Preparation Phase (Mandatory)

1. Local audit
- Identify selection model and object insertion path.
- Identify safe serialization format for clipboard payload.

2. Web research (official docs first)
- Clipboard API reliability and permission constraints.
- React/Konva event handling for operation buttons.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. User selects one or more objects.
2. User clicks Duplicate.
3. New objects appear offset and selected.
4. User clicks Copy then Paste.
5. Pasted objects preserve visual attributes and relation where applicable.

Edge cases:

1. Paste with empty clipboard shows non-destructive notice.
2. Invalid clipboard JSON is ignored safely.
3. Copy/paste while disconnected still applies locally and syncs on reconnect.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-clipboard.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-clipboard.test.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Clipboard contract:

```ts
interface BoardClipboardPayload {
  version: 1;
  boardObjectIds: string[];
  objects: Record<string, BoardObject>;
  copiedAt: number;
}
```

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-clipboard.test.ts`
- serialize/deserialize roundtrip
- invalid payload rejection

2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- duplicate selected object(s)
- copy then paste inserts new IDs with offset
- paste ignores invalid clipboard safely

Red -> Green -> Refactor:

1. Add failing clipboard utility tests.
2. Add failing board integration tests.
3. Implement operation handlers and UI wiring.
4. Refactor shared object-clone logic.

## Acceptance Criteria

- [ ] Duplicate works for single and multi-selection.
- [ ] Copy/paste works for supported object types.
- [ ] Pasted objects receive new IDs and preserve attributes.
- [ ] Realtime and persistence remain consistent after operations.
- [ ] Invalid clipboard content does not crash board.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/lib/board-clipboard.test.ts src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## User Checkpoint Test

1. Duplicate each primitive type and verify output.
2. Copy/paste multi-selection and verify relative layout.
3. Refresh and verify persistence.
4. Open second tab and verify realtime convergence.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
