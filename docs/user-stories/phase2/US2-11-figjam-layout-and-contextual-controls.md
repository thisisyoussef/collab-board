# US2-11: FigJam-Style Layout and Contextual Controls (Deferred Extra Story)

## Status

- State: Deferred Backlog (Planned, not started)
- Owner: Codex
- Depends on: US2-10 approved
- Priority: High UX polish follow-up

## Persona

**Alex, the Workshop Facilitator** needs the board chrome to stay out of the way while still exposing key controls in predictable places.

**Sam, the Visual Organizer** wants contextual styling controls to appear where expected so shape/text edits are fast and low-friction.

**Jordan, the QA Reviewer** needs deterministic control states so toolbar and inspector behavior are testable across object types.

## User Story

> As Alex, I want a floating FigJam-style layout so the workspace feels familiar and efficient during live sessions.

> As Sam, I want a right-side contextual inspector so I can change fill, stroke, and text styles without leaving the canvas flow.

> As Jordan, I want toolbar/inspector behavior to be consistent by selection type so regressions are easy to detect.

## Goal

Recompose the board UI to match a FigJam-like floating layout (top-left doc controls, bottom-center tool dock, right contextual inspector, bottom-left zoom chip) and wire the corresponding styling/editing behavior for supported object types.

## Scope

In scope:

1. Floating top-left document controls cluster (menu/page label + undo/redo + utility actions).
2. Bottom-center tool dock with active-state tool selection and compact icon-first interaction.
3. Bottom-left zoom status chip with current zoom and quick zoom interactions.
4. Right contextual inspector with shape/text controls:
- fill/stroke color swatches
- stroke width slider
- stroke style toggles (solid/dashed/dotted where supported)
- size presets and text-format controls where applicable
5. Selection-aware inspector states (none, single-select, multi-select, connector-specific, text-specific).
6. Wiring inspector updates into existing board object mutation path and realtime/persistence flow.
7. Drag-safe visual behavior so stale selection affordances are not shown while editing another object.

Out of scope:

1. Net-new drawing primitives beyond current object model.
2. Full keyboard-shortcut redesign.
3. Mobile-native layout parity (desktop-first for this story).

## Pre-Implementation Audit

Local sources to review before coding:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/index.css`
6. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/docs/react-konva.md`
8. `/Users/youss/Development/gauntlet/collab-board/docs/konva-api.md`
9. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-02-object-model-v2-core-primitives.md`
10. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-10-board-history-undo-redo.md`

## Preparation Phase (Mandatory)

1. Local design/code audit:
- map current board chrome regions and component responsibilities.
- map existing style mutation paths for shape/text/connector objects.

2. Web research pass (official docs first):
- React composition patterns for large contextual panels.
- Konva shape/line style mutation behavior.
- Accessibility guidance for icon-only controls and grouped toolbars.

3. Required preparation output in this story before coding:
- docs checked (local + web links, date checked)
- UI composition plan (component breakdown + props contract)
- style mutation contract per object type
- failing-first test matrix
- risks/fallbacks for responsive behavior

### Preparation Notes

- Pending implementation kickoff.
- Story created from user-provided reference layout image and intended control behavior.

## Layout Contract (Planned)

```ts
type InspectorMode =
  | 'none'
  | 'multi'
  | 'shape'
  | 'text'
  | 'line'
  | 'connector'
  | 'frame';

interface BoardChromeState {
  activeTool: ActiveTool;
  zoomPercent: number;
  canUndo: boolean;
  canRedo: boolean;
  inspectorMode: InspectorMode;
}
```

## UX Script

Happy path:

1. User opens board and sees floating controls arranged like the reference (top-left, bottom-center, right, bottom-left).
2. User selects a rectangle; right inspector shows shape controls.
3. User changes fill and stroke width; canvas updates immediately and persists.
4. User selects text; inspector switches to text controls.
5. User uses top-left undo/redo and sees state step backward/forward.

Edge cases:

1. No selection: inspector collapses to neutral state, no invalid controls shown.
2. Multi-selection: only shared controls are enabled.
3. While dragging one object, stale anchors/handles from previous selection stay hidden.
4. Connector selection: connector-only controls shown; irrelevant controls disabled.

## Implementation Details (Planned)

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardTopControls.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardToolDock.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardZoomChip.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardToolDock.test.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
9. `/Users/youss/Development/gauntlet/collab-board/src/index.css`

Data flow:

1. Board selection + active tool drive `BoardChromeState`.
2. Inspector emits normalized style patch events.
3. Board applies patch through existing object update + persistence + realtime path.
4. Undo/redo controls delegate to board history API (from US2-10).

## TDD Plan

Write failing tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardToolDock.test.tsx`
- renders expected tools in floating dock
- toggles active tool state on click

2. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.test.tsx`
- shape selection shows fill/stroke controls
- text selection shows text controls
- no selection hides contextual controls

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- inspector change updates selected object style
- stale selection anchor state does not render during drag transitions
- undo/redo controls wire to board history state

Red -> Green -> Refactor:

1. Add failing component + integration tests for layout and inspector behavior.
2. Implement minimal floating chrome components and board wiring.
3. Refactor style update plumbing and duplicate UI logic after tests pass.
4. Add regression tests for drag-selection and contextual-mode edge cases.

## Acceptance Criteria

- [ ] Board layout matches the reference pattern with floating top-left, right, bottom-center, and bottom-left control regions.
- [ ] Tool dock reliably switches tools and indicates active state.
- [ ] Contextual inspector updates by selection type and only shows relevant controls.
- [ ] Fill/stroke/text control changes update selected objects correctly and persist/realtime sync.
- [ ] Undo/redo controls are visible and correctly enabled/disabled based on history state.
- [ ] No stale selection anchors/handles are shown while dragging a different object.

## Local Validation (When Implemented)

1. `npm run lint`
2. `npm run test -- src/components/BoardToolDock.test.tsx src/components/BoardInspectorPanel.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## User Checkpoint Test (When Implemented)

1. Compare board layout against reference screenshot regions and control grouping.
2. Select shape/text/connector objects and verify inspector mode switches correctly.
3. Modify style controls and verify immediate visual update + persistence after refresh.
4. Drag between objects and verify stale anchor/selection shadows are not visible.
5. Use undo/redo from top controls to confirm consistent history behavior.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes:
  - Added as deferred Phase II backlog story for FigJam-like workspace chrome and contextual style controls from user-provided reference.
