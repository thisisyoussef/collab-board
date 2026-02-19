# US2-11: FigJam-Style Layout and Contextual Controls

## Status

- State: Implemented, Ready for User Checkpoint
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

Docs checked on February 19, 2026:

1. Local: `src/pages/Board.tsx`, `src/index.css`, `src/types/board.ts`, `src/lib/board-object.ts`, `src/components/AICommandCenter.tsx`, `src/pages/Board.test.tsx`, `docs/react-konva.md`, `docs/konva-api.md`.
2. Web: React docs for component composition and controlled inputs, Konva docs for node style mutation and z-index semantics, and WAI-ARIA toolbar guidance for icon-first controls.

Preparation outputs completed:

1. UI composition plan: split dock, zoom chip, and inspector into dedicated components with explicit props contracts.
2. Style mutation contract: normalized `onUpdateObject` and `onUpdateConnector` callbacks that route through existing board mutation + realtime + persistence pipeline.
3. Failing-first test matrix: added dedicated dock and inspector component tests; updated board integration tests to new layout expectations.
4. Responsive risk handling: dock and zoom chip are fixed-position overlays; workspace padding reserves space to avoid overlap.

## Layout Contract

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

Implemented files:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardToolDock.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardZoomChip.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.test.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardToolDock.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/index.css`

Data flow:

1. Board selection + active tool drive `BoardChromeState`.
2. Inspector emits normalized style patch events.
3. Board applies patch through existing object update + persistence + realtime path.
4. Undo/redo controls delegate to board history API (from US2-10).
5. Zoom chip updates stage scale/position around viewport center, then persists viewport state.

## TDD Plan

Failing tests added first:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardToolDock.test.tsx`
- renders expected tools in floating dock
- toggles active tool state on click

2. `/Users/youss/Development/gauntlet/collab-board/src/components/BoardInspectorPanel.test.tsx`
- shape selection shows fill/stroke controls
- text selection shows text controls
- no selection hides contextual controls

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- board layout expectations updated from left rail/properties to dock/inspector/zoom-chip regions
- undo/redo controls remain wired to board history state

Red -> Green -> Refactor:

1. Added failing tests for dock rendering, dock selection, inspector contextual rendering, and board layout assertions.
2. Implemented floating dock + zoom chip + inspector components and integrated them into `Board.tsx`.
3. Refactored object style update plumbing into `updateObjectProperties` for non-connector object types.
4. Stabilized integration tests by scoping inspector assertions and resetting `getDoc`/`setDoc` mocks per test to prevent flake.

## Acceptance Criteria

- [x] Board layout matches the reference pattern with top-left controls, right inspector panel, bottom-center tool dock, and bottom-left zoom chip.
- [x] Tool dock reliably switches tools and indicates active state.
- [x] Contextual inspector updates by selection type and only shows relevant controls.
- [x] Fill/stroke/text control changes update selected objects correctly and route through persistence/realtime path.
- [x] Undo/redo controls are visible and correctly enabled/disabled based on history state.
- [x] Existing connector/selection affordances remain scoped to active selection and do not regress during layout changes.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/components/BoardToolDock.test.tsx src/components/BoardInspectorPanel.test.tsx src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

Result (February 19, 2026):

1. `npm run lint` pass.
2. Story-targeted tests pass (23/23).
3. Full suite pass (39 files, 255 tests).
4. Build pass (Node 18 warning from Vite minimum version + existing chunk-size warning).

## User Checkpoint Test (Production)

1. Open a board and confirm UI regions:
- top-left doc controls (menu, board title/rename), top-center undo/redo, top-right status/share/session actions.
- bottom-center tool dock.
- bottom-left zoom chip (`-`, `%`, `+`).
- right-side AI panel + Inspector.
2. Click each dock tool and verify active visual state moves to the selected tool.
3. Select one rectangle/circle/frame and edit fill/stroke/stroke-width in Inspector; verify immediate canvas update.
4. Select a connector and verify connector-specific controls (path type, arrows, label) appear.
5. Use zoom chip to zoom in/out/reset and verify stage zoom changes.
6. Use topbar Undo/Redo and confirm buttons enable/disable correctly and behavior matches history state.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending
- Notes:
  - Implemented as Phase II follow-up after US2-10.
  - Included UI copy polish update from "left rail" to "bottom dock".
