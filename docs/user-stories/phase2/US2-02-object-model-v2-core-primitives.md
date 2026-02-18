# US2-02: Object Model v2 Core Primitives

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: US2-01 approved

## Persona

**Alex, the Workshop Lead** needs more than stickies and rectangles to run real planning sessions.

**Sam, the Collaborator** expects every new primitive to behave consistently under drag, transform, save, and sync.

**Jordan, the QA Reviewer** needs explicit object contracts so regressions are easy to catch.

## User Story

> As Alex, I want circles, lines, text blocks, frames, and connectors so I can model real workflows and diagrams.

> As Sam, I want these object types to sync and persist exactly like existing objects so collaboration feels reliable.

## Goal

Expand the board object model from Phase I to support all core primitives required by Phase II AI and product workflows.

## Scope

In scope:

1. Expand board object type system.
2. Render/create/update/delete flows for each primitive.
3. Selection and transform support where applicable.
4. Realtime and persistence compatibility for all types.
5. Persist and restore board viewport (pan/zoom) so users re-open at their last working area.

Out of scope:

1. AI action execution engine (US2-03).
2. Role and permission enforcement (US2-05).

## Pre-Implementation Audit

Local sources:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
4. `/Users/youss/Development/gauntlet/collab-board/docs/react-konva.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/konva-api.md`
6. `/Users/youss/Development/gauntlet/collab-board/docs/konva-select-transform.md`

## Preparation Phase (Mandatory)

1. Confirm current Konva transform patterns in local docs and code.
2. Web-check official docs for any primitive-specific Konva behavior:
- Line points updates
- Text sizing and wrapping
- Group/connector update patterns
3. Record Preparation Notes with:
- exact type fields per primitive
- min-size constraints
- known transform edge cases

### Preparation Notes (Completed February 18, 2026)

Local docs/code reviewed:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
4. `/Users/youss/Development/gauntlet/collab-board/docs/react-konva.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/konva-api.md`
6. `/Users/youss/Development/gauntlet/collab-board/docs/konva-select-transform.md`

Official web docs checked:

1. https://konvajs.org/docs/shapes/Line.html
2. https://konvajs.org/docs/shapes/Text.html
3. https://konvajs.org/docs/shapes/Arrow.html
4. https://konvajs.org/docs/select_and_transform/Transformer.html
5. https://react.dev/reference/react/useEffect
6. https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-the-FigJam-toolbar
7. https://help.figma.com/hc/en-us/articles/1500004413162-Create-diagrams-with-connectors-in-FigJam

Object field decisions:

1. `circle` uses width/height + optional radius.
2. `line` uses `points[]` + width/height bounds.
3. `text` uses `text`, `fontSize`, width/height box.
4. `frame` uses `title`, `stroke`, `strokeWidth`, width/height.
5. `connector` uses `fromId`, `toId`, `style`, and derived `points[]`.
6. `connector` adds endpoint anchors (`fromAnchorX/Y`, `toAnchorX/Y`) for stable attachment points on shape boundaries.

Known transform edge cases handled:

1. Line transform scales points and then normalizes node scale back to `1`.
2. Circle transform normalizes to a single size so circles stay true circles (no pill/cylinder drift).
3. Frame transform updates body rectangle and title width together.
4. Connector endpoints recompute from linked-object anchors when linked objects move or resize.
5. Connector endpoints can detach to free points and re-attach by snapping to nearby shape boundaries.

## Object Contract

Target `BoardObjectType` set:

1. `sticky`
2. `rect`
3. `circle`
4. `line`
5. `text`
6. `frame`
7. `connector`

Type-specific additions:

1. `circle`: `radius`
2. `line`: `points` array
3. `text`: `text`, `fontSize`
4. `frame`: `title`, `stroke`
5. `connector`: `fromId`, `toId`, `style`, `fromAnchorX`, `fromAnchorY`, `toAnchorX`, `toAnchorY`

## UX Script

1. User creates each primitive from UI controls.
2. User manipulates each shape (move/resize/rotate as supported).
3. User pans/zooms to a different area, refreshes, and lands in same viewport.
4. User refreshes page and all primitives restore.
5. Second tab sees all primitives and updates in realtime.
6. User deletes primitives and both tabs converge.

## Implementation Details

Implemented files:

1. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/viewport.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.object-v2.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.realtime-v2.test.tsx`
8. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.viewport.test.tsx`
9. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`

Special handling:

1. Connectors must recompute endpoints when linked objects move/resize.
2. Missing connector targets must fail gracefully (no crash).
3. Frame and text editing must follow existing inline-edit safety patterns.
4. Viewport restore should apply once on board load and never fight live user interactions.
5. Selected connectors expose endpoint handles for direct endpoint drag + snap attachment.
6. Circle transforms must preserve a true circular geometry under all resize paths.

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`
- normalize and serialize each primitive
- reject malformed input safely

2. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.object-v2.test.tsx`
- create/render each type
- selection/transform updates object data
- deletion clears refs and UI state

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.realtime-v2.test.tsx`
- incoming create/update/delete for each new primitive applies correctly

4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.viewport.test.tsx`
- saves viewport on pan/zoom updates
- restores viewport on reload for same board/user context
- safely falls back when persisted viewport is invalid

Red -> Green -> Refactor:

1. Add failing type-normalization tests.
2. Add failing board behavior tests for each primitive.
3. Implement primitive support incrementally until green.
4. Refactor node update paths to shared helpers.
5. Add viewport persistence logic after primitives are green and lock with dedicated tests.

## Acceptance Criteria

- [x] All seven primitive types exist in type system and runtime model.
- [x] User can create/edit/delete each primitive.
- [x] Selection/transform behaves correctly for each applicable primitive.
- [x] Persistence/hydration works for each type.
- [x] Realtime sync works for each type.
- [x] Viewport pan/zoom restores user to prior working area after refresh/reopen.
- [x] Connector endpoints can be dragged freely, snap to shape boundary points, and stay attached when target shapes move/resize.
- [x] Circle objects remain true circles after creation and transform (no rounded-rectangle/pill drift).
- [x] When a connector is selected, shape anchor points are visible to guide attachment targets.
- [x] Connectors remain easy to re-select after deselect via larger hit target.
- [x] Connector creation follows a point-A to point-B drag flow with immediate start-point snapping and optional free-space endpoint.

## Local Validation

1. `npm run lint` -> pass
2. `npm run test -- src/lib/board-object.test.ts src/pages/Board.object-v2.test.tsx src/pages/Board.realtime-v2.test.tsx src/pages/Board.viewport.test.tsx` -> pass
3. `npm run test` -> pass (26 files, 164 tests)
4. `npm run build` -> pass (local Node `18.20.4` warning from Vite recommending `20.19+` or `22.12+`)

## User Checkpoint Test

1. Create one instance of each primitive in tab A.
2. Verify all appear in tab B.
3. Move/edit/delete in tab A and verify tab B convergence.
4. Pan/zoom tab A to a non-default area, refresh, and verify viewport restores.
5. Refresh both tabs and verify object persistence.
6. Select a connector and drag each endpoint handle:
- verify free endpoint movement works.
- verify endpoint snaps/attaches when moved near a shape edge.
- verify attachment follows when that shape is moved or resized.
7. Create and resize circles from multiple directions; verify circles remain true circles.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending manual checkpoint
- Notes:
  - Added object model v2 support for `circle`, `line`, `text`, `frame`, and `connector` in addition to existing `sticky` and `rect`.
  - Added viewport persistence/restore by board + user context via localStorage-backed helper.
  - Added dedicated object-model and viewport TDD suites before implementation, then implemented to green.
  - Fix-forward: upgraded connectors from center-link behavior to anchor-based endpoint handles with free drag + boundary snap/attach behavior aligned to Figma-style connector interactions.
  - Fix-forward: anchor candidates are now visibly rendered on shapes while connector editing is active.
  - Fix-forward: connector hit area increased for easier re-selection after deselect.
  - Fix-forward: connector tool now uses a drag-to-create point-A to point-B flow (instead of instant spawn), with start-point shape snap and free-space endpoints.
  - Fix-forward: endpoint drag now follows live pointer coordinates and detaches from the current anchor immediately when dragging away.
  - Fix-forward: enforced strict circle geometry in normalization + transform paths to remove rounded-rectangle/pill regressions.
  - Vercel production deployment for this story: `GjVpmK2qP4vqiP9FKxmBTzCcb2HT` (aliased to `collab-board-iota.vercel.app` on February 18, 2026).
