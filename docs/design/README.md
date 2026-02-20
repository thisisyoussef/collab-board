# CollabBoard Design Files

This folder contains the design-planning package for the CollabBoard Litigation reskin.

## Files

- `collabboard-litigation-v1-plan.md`
  - Product-level visual strategy and route-by-route blueprint.
- `screen-reskin-checklist.md`
  - Implementation checklist for screen-by-screen execution.
- `tokens/collabboard-litigation.tokens.json`
  - Structured design token source (colors, typography, spacing, motion).
- `tokens/collabboard-litigation.css`
  - CSS variable/token layer for implementation.
- `collabboard-litigation-style-tile.html`
  - Visual style tile preview (palette, type, controls, tone samples).

## Intended Use

1. Keep all behavior and logic intact.
2. Apply tokens and shared primitives first.
3. Reskin routes in this order: Landing -> Dashboard -> Board -> Overlays.
4. Validate existing tests after each screen pass.
