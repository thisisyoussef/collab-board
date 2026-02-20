# CollabBoard Reskin Checklist (Layout-First)

Goal: Upgrade layout and visual quality without touching business logic, data flow, permissions, or realtime behavior.

## Rule 0: No Logic Touches

- [ ] No hook contract changes.
- [ ] No route behavior changes.
- [ ] No Firestore/API/socket payload changes.
- [ ] No auth/access decision changes.

## Shared Foundation

- [ ] Apply token variables and typography base.
- [ ] Normalize spacing rhythm to 8px grid across shared containers.
- [ ] Normalize radii and border hierarchy for panel/card/controls.
- [ ] Normalize button and input primitives.

## Per-Screen Workflow

For each screen, execute in this order:

1. Layout pass
- [ ] Define zones and hierarchy (header, primary, secondary, utility).
- [ ] Remove placeholder/wireframe-like structure.
- [ ] Establish responsive collapse behavior.

2. Component pass
- [ ] Map zones to reusable surfaces/cards/rows/actions.
- [ ] Ensure consistent control sizing and alignment.
- [ ] Ensure status/feedback components are explicit and legible.

3. Visual pass
- [ ] Apply final colors/type/motion from tokens.
- [ ] Tune contrast and readability.
- [ ] Verify state styling (error/success/warning/info).

## Screen 1: Landing (`/`)

Files: `src/pages/Landing.tsx`, `src/index.css`, `src/pages/Landing.test.tsx`

- [ ] Replace wireframe-style sidebar layout with coherent marketing/product IA.
- [ ] Keep sign-in CTA above fold.
- [ ] Keep preview as secondary support, not primary navigation.
- [ ] Add value/pillar section that reinforces product clarity.
- [ ] Preserve all auth and returnTo behavior.

## Screen 2: Dashboard (`/dashboard`)

Files: `src/pages/Dashboard.tsx`, `src/index.css`, `src/pages/Dashboard.test.tsx`

- [ ] Clarify hierarchy between workspace controls and board list.
- [ ] Improve board card readability and action grouping.
- [ ] Improve empty/loading/error layout.

## Screen 3: Board (`/board/:id`)

Files: `src/pages/Board.tsx`, `src/index.css`, `src/components/*`

- [ ] Keep canvas as dominant region.
- [ ] Tighten topbar hierarchy and utility clarity.
- [ ] Keep right rail and floating controls visually integrated.
- [ ] Do not alter Konva interactions.

## Screen 4: Side Panels and Overlays

Files: `src/components/ShareSettingsPanel.tsx`, `src/components/AICommandCenter.tsx`, `src/components/BoardInspectorPanel.tsx`, `src/index.css`

- [ ] Clarify section grouping and action hierarchy.
- [ ] Keep dense controls readable.
- [ ] Keep error/success states explicit and calm.

## Final QA

- [ ] Targeted tests pass for touched screens.
- [ ] Responsive checks at 1280 / 1024 / 768 / 640.
- [ ] No regressions in existing flows.
- [ ] Visual outcome feels intentional and production-ready.
