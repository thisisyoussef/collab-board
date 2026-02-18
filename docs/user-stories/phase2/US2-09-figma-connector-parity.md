# US2-09: Figma-Grade Connector and Arrow Parity (Deferred Extra Story)

## Status

- State: Deferred Backlog (Planned, not started)
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

- Pending implementation kickoff.
- This story is intentionally parked as a follow-up backlog item.

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

## Implementation Details (Planned)

1. Add connector routing module (visibility graph + A*).
2. Expand board object connector fields and normalization.
3. Add modifier-key input handling for perimeter mode.
4. Add hover-lock timer for straight connectors.
5. Add path-handle rendering and interactions.
6. Extend serialization/realtime payload compatibility.
7. Add metrics for route recompute latency and snap stability.

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

- [ ] Default connector mode snaps to side-center anchors reliably.
- [ ] `Cmd`/`Ctrl` enables arbitrary perimeter attachment and persists correctly.
- [ ] Hover-to-lock behavior for straight connectors works as specified.
- [ ] Straight, bent, and curved connector types are selectable and editable.
- [ ] Bent connectors route around shapes using orthogonal pathfinding.
- [ ] Route selection minimizes unnecessary turns using explicit penalty.
- [ ] Endpoint and path handles are easy to select and manipulate.
- [ ] Connected connectors reroute correctly when shapes move/resize.
- [ ] Connector styling and arrowhead options are supported.
- [ ] Optional connector label supports position along path.
- [ ] No endpoint jitter/flicker near snap boundaries.
- [ ] Realtime collaboration converges for connector edits.

## Local Validation (When Implemented)

1. `npm run lint`
2. `npm run test`
3. `npm run build`
4. Run connector-focused stress checklist (manual + multi-tab).

## User Checkpoint Test (When Implemented)

1. Create straight, bent, curved connectors between multiple shapes.
2. Validate side-center snapping and perimeter attachment with modifier key.
3. Validate hover-to-lock behavior for straight connectors.
4. Drag endpoints and path handles repeatedly; verify no oscillation or selection frustration.
5. Move connected shapes and verify immediate reroute correctness.
6. Open second tab/user and verify connector convergence during concurrent edits.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes:
  - Added as deferred extra story from user-provided Figma connector parity research.
