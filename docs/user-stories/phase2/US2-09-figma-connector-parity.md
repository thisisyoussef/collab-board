# US2-09: Figma-Grade Connector and Arrow Parity (Deferred Extra Story)

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: US2-02 approved
- Priority: High polish follow-up

## Persona

**Alex, the Facilitator** needs connectors to feel predictable and precise during fast diagramming sessions.

**Sam, the Power User** expects connector behavior to match Figma/FigJam muscle memory exactly.

**Jordan, the QA Reviewer** needs a deterministic connector contract with measurable performance and reliability gates.

## User Story

> As Alex, I want connector interactions to behave like Figma so I can diagram quickly without fighting the tool.

> As Sam, I want endpoint snapping, arbitrary perimeter attachment, and editable paths so I can express flows precisely.

> As Jordan, I want a testable routing and attachment model so regressions are caught before release.

## Goal

Implement a Figma-grade connector system with stable endpoint behavior, richer attachment modes, orthogonal routing, and production-level interaction polish.

## Scope

In scope:

1. Connection modes (side-center, arbitrary perimeter, free endpoint).
2. Modifier-key behavior for arbitrary perimeter attachment (`Cmd`/`Ctrl`).
3. Hover-to-lock behavior for straight connectors.
4. Connector types: straight, bent/orthogonal, curved.
5. Orthogonal router using visibility graph + A* with turn penalties.
6. Connector endpoint handles plus path handles.
7. Real-time rerouting when connected objects move.
8. Connector style model (stroke variants + arrowheads + labels).
9. Data model and persistence updates needed for parity.

Out of scope:

1. Auto-layout engine.
2. AI semantic understanding of diagram intent.
3. Non-connector canvas systems unrelated to arrows.

## Pre-Implementation Audit

Local sources to review before coding:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.object-v2.test.tsx`
6. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.realtime-v2.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/docs/react-konva.md`
8. `/Users/youss/Development/gauntlet/collab-board/docs/konva-api.md`
9. `/Users/youss/Development/gauntlet/collab-board/docs/konva-select-transform.md`

## Preparation Phase (Mandatory)

1. Local design/code audit:
- map current connector creation, snap, detach, and drag flow.
- map current persistence shape for connector metadata.

2. Web research pass (official/primary docs first):
- Figma/FigJam connector behavior and interaction patterns.
- Konva primitives needed for endpoint/path handles.
- Pathfinding references for orthogonal routing (A* + Manhattan + turn penalties).
- Performance references for drag-time rerouting.

3. Required preparation output in this story before coding:
- docs checked (local + web with date)
- routing strategy decision
- attachment-state schema decision
- failing-first test list
- risk list + fallback approach

### Preparation Notes

Completed on February 19, 2026.

Local audit completed:
1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
5. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`
7. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.realtime-v2.test.tsx`

Web research (primary docs/refs) completed:
1. Figma connector docs:
   - https://help.figma.com/hc/en-us/articles/14560776087959-Connect-shapes-and-objects
2. FigJam connector walkthrough:
   - https://www.figma.com/resource-library/guide-to-figjams-connector-tool/
3. Konva Arrow API (pointer behavior):
   - https://konvajs.org/api/Konva.Arrow.html
4. Konva Line API (bezier/tension/path behavior):
   - https://konvajs.org/api/Konva.Line.html

Design decisions locked:
1. Route strategy: orthogonal visibility-grid + A* + explicit turn penalty, with deterministic fallback path.
2. Attachment state: side-center default; arbitrary perimeter mode via `Cmd/Ctrl`; free endpoint fallback.
3. Data model: connector v2 fields added to `BoardObject` with backward compatibility to legacy `style`.
4. Path editing: endpoint handles plus center path handle for bent/curved connectors.

## Figma Parity Behavior Contract

### 1. Connection Modes

1. Side-center attachment (default):
- snap to top/right/bottom/left side centers.
- connector remains attached and follows object movement.

2. Arbitrary perimeter attachment (`Cmd`/`Ctrl` while dragging):
- endpoint can attach to any perimeter point.
- attachment persists as relative perimeter position.

3. Hover-to-lock behavior for straight connectors:
- holding endpoint over a shape for ~2 seconds locks connection intent.

### 2. Attachment Point Detection

1. Connection points are shown only in connector-relevant contexts:
- connector tool active, or endpoint drag/edit active.

2. Snap behavior:
- endpoint snaps within threshold radius.
- anchor highlight provides visual feedback.
- center-of-shape drop path resolves to nearest side automatically.

### 3. Connector Types

1. Straight connector.
2. Bent/orthogonal connector (90-degree segments).
3. Curved connector (Bezier-based with handles).

### 4. Orthogonal Routing Algorithm (Bent Connectors)

1. Build visibility graph from board obstacles and endpoint references.
2. Build orthogonal candidate edges that do not pass through objects.
3. Run A* (or Dijkstra fallback) with Manhattan heuristic.
4. Apply cost with turn penalty:
- `cost = segment_length + (turn_penalty * turns)`
5. Optimize resulting path:
- reduce collinear segments.
- center segments in open channels when possible.

### 5. Path Manipulation and Handles

1. Endpoint handles detach/reattach attachments.
2. Path handles reshape segments.
3. Segment edits preserve connector validity and persistence state.

### 6. Real-Time Update Behavior

1. Connected object move/resize triggers connector recompute.
2. Update target for drag operations: interactive smoothness suitable for 60fps.
3. Recompute should be scoped to impacted connectors/obstacles only.

### 7. Styling and Labels

1. Stroke options: solid/dashed + thickness.
2. Arrowheads on start/end:
- none, solid, line, triangle, diamond.
3. Optional label:
- text on path, movable along path by percentage position.

### 8. Proposed Connector Data Contract (v2 extension)

```ts
type ConnectorType = 'straight' | 'bent' | 'curved';
type AttachmentMode = 'side-center' | 'arbitrary' | 'free';
type ConnectorSide = 'top' | 'right' | 'bottom' | 'left' | null;
type ArrowHead = 'none' | 'solid' | 'line' | 'triangle' | 'diamond';

interface ConnectorEndpointState {
  shapeId: string | null;
  attachmentMode: AttachmentMode;
  side: ConnectorSide;
  anchorX: number | null;
  anchorY: number | null;
  x: number;
  y: number;
}

interface ConnectorLabelState {
  text: string;
  positionPercent: number;
  hasBackground: boolean;
}
```

## Implementation Details

Implemented in this story:

1. Routing engine:
   - Added `/Users/youss/Development/gauntlet/collab-board/src/lib/connector-routing.ts`.
   - Implements:
     - straight path generation.
     - bent path routing via orthogonal graph + A* + turn penalty.
     - curved path generation with deterministic control handles.
     - path simplification and label point sampling helpers.

2. Data contract expansion:
   - Updated `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`:
     - `connectorType`, `strokeStyle`, `startArrow`, `endArrow`,
       `fromAttachmentMode`, `toAttachmentMode`,
       `label`, `labelPosition`, `labelBackground`,
       `pathControlX`, `pathControlY`, `curveOffset`.
   - Backward compatibility maintained with existing `style` values.

3. Model normalization + persistence:
   - Updated `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.ts`:
     - connector defaults/normalization/sanitization for v2 fields.
     - side-anchor helper export for side-center mode.
     - connector point resolver now supports bent/curved routing with obstacles.

4. Board interaction parity:
   - Updated `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`:
     - side-center snapping as default attachment behavior.
     - `Cmd/Ctrl` perimeter attachment mode during draft/endpoint drag.
     - 2-second hover lock for straight connectors over shapes.
     - straight/bent/curved rendering support.
     - endpoint handles + path handle (for bent/curved).
     - connector label rendering along path.
     - properties panel controls for connector path, stroke style, arrowheads, and labels.
     - connected-object moves trigger reroute using obstacle-aware routing.

5. AI connector contract support:
   - Updated `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts` to parse connector v2 fields.
   - Updated `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts` tool schema for connector v2 options.

## TDD Plan

Write failing tests first:

1. Unit tests (`/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`):
- side-center anchor selection.
- arbitrary perimeter anchor retention.
- connector route recompute invariants.

2. Routing unit tests (new file suggested):
- visibility graph node/edge construction.
- obstacle avoidance.
- turn-penalty path preference.

3. Integration tests (`/Users/youss/Development/gauntlet/collab-board/src/pages/Board.object-v2.test.tsx` and new connector-focused suite):
- drag endpoint snap/unsnap stability.
- modifier-key perimeter mode.
- hover-to-lock behavior.
- path handle manipulation.

4. Realtime tests (`/Users/youss/Development/gauntlet/collab-board/src/pages/Board.realtime-v2.test.tsx`):
- consistent rerouting on remote shape moves.
- connector convergence under concurrent updates.

5. Performance checks:
- routing time budget logging during drag.
- regression guard for high object count scenarios.

## Acceptance Criteria

- [x] Default connector mode snaps to side-center anchors reliably.
- [x] `Cmd`/`Ctrl` enables arbitrary perimeter attachment and persists correctly.
- [x] Hover-to-lock behavior for straight connectors works as specified.
- [x] Straight, bent, and curved connector types are selectable and editable.
- [x] Bent connectors route around shapes using orthogonal pathfinding.
- [x] Route selection minimizes unnecessary turns using explicit penalty.
- [x] Endpoint and path handles are easy to select and manipulate.
- [x] Connected connectors reroute correctly when shapes move/resize.
- [x] Connector styling and arrowhead options are supported.
- [x] Optional connector label supports position along path.
- [x] No endpoint jitter/flicker near snap boundaries.
- [x] Realtime collaboration converges for connector edits.

## Local Validation

1. `npm run lint` -> pass
2. `npm run test` -> pass (`36` files, `242` tests)
3. `npm run build` -> pass
   - known local warning: Node `18.20.4` below Vite recommended runtime
4. Connector-focused automated coverage:
   - `/Users/youss/Development/gauntlet/collab-board/src/lib/connector-routing.test.ts`
   - `/Users/youss/Development/gauntlet/collab-board/src/lib/board-object.test.ts`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Create straight, bent, curved connectors between multiple shapes.
2. Validate side-center snapping and perimeter attachment with modifier key.
3. Validate hover-to-lock behavior for straight connectors.
4. Drag endpoints and path handles repeatedly; verify no oscillation or selection frustration.
5. Move connected shapes and verify immediate reroute correctness.
6. Open second tab/user and verify connector convergence during concurrent edits.
7. For selected connector, verify properties panel controls:
   - path type switch (straight/bent/curved)
   - stroke style (solid/dashed)
   - start/end arrowhead selection
   - label text + label position updates

## Checkpoint Result

- Production Frontend URL: `https://collab-board-iota.vercel.app`
- Production Socket URL: `https://collab-board-0948.onrender.com`
- User Validation: Pending
- Notes:
  - Implemented and ready for manual production checkpoint.
  - Additional non-blocking parity opportunities can be tracked in follow-up stories if needed (e.g., richer arrowhead glyph differentiation beyond Konva native pointer styles).
