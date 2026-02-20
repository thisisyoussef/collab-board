# CollabBoard Litigation v1.1

Date: February 20, 2026  
Scope: Visual and layout reskin only (no logic/data/behavior changes)

## 1) Objective

Reskin CollabBoard so it feels like a pristine, production-grade product with stronger information architecture, cleaner component hierarchy, and a consistent litigation-inspired visual language.

## 2) Non-Negotiable Guardrails

- No changes to board object model, hooks, Firestore schema, socket contracts, or AI execution behavior.
- No route/permission/auth logic changes.
- Layout and presentation only: JSX structure, semantic wrappers, class names, and CSS.
- Keep edits additive and localized to reduce conflicts with parallel engineering work.

## 3) Layout-First Methodology

### Phase A: Layout Architecture (before visual polish)

For each screen, define:

1. Primary task of the screen.
2. Content hierarchy (what must be seen first/second/third).
3. Stable layout zones (header, primary work area, supporting rail, utility overlays).
4. Responsive collapse rules at 1280 / 1024 / 768 / 640 breakpoints.

### Phase B: Component System Mapping

- Map each zone to component primitives (surface, panel, card, toolbar, status chip, action row).
- Normalize spacing/radii/type rhythm before adding decorative styling.
- Keep interaction affordances obvious and dense where work is complex.

### Phase C: Visual Polish

- Apply palette, typography, motion, and signal colors.
- Tune contrast and legibility for long-session use.
- Keep movement purposeful and minimal.

## 4) Current Screen Inventory

1. `/` Landing
2. `/dashboard` Workspace dashboard
3. `/board/:id` Canvas workspace
4. Board overlays: Share panel, reconnect banner, floating dock, zoom chip, inspector, AI panel

## 5) Token Foundation

Design artifacts:

- `docs/design/tokens/collabboard-litigation.tokens.json`
- `docs/design/tokens/collabboard-litigation.css`
- `docs/design/collabboard-litigation-style-tile.html`

Rule: favor semantic variables (`--cb-bg-page`, `--cb-text-primary`, `--cb-action-primary-bg`) over hardcoded colors.

## 6) Screen Blueprints

### Screen 1: Landing (`/`) — Layout v2

Primary task: orient the user quickly and drive sign-in.

Layout hierarchy:

1. Topbar (brand + context line)
2. Hero and preview split (core value + product glimpse)
3. Value/pillars row (proof of structure and reliability)

Notes:

- Remove placeholder wireframe-style navigation patterns that imply fake product IA.
- Keep CTA and auth messaging prominent and trustworthy.
- Keep preview visual but secondary to the decision to sign in.

### Screen 2: Dashboard (`/dashboard`)

Primary task: manage boards fast.

Layout hierarchy:

1. Utility topbar (identity + account actions)
2. Workspace navigation zone (owned/shared context)
3. Board management zone (create + list + actions)

### Screen 3: Board (`/board/:id`)

Primary task: work on canvas with minimal friction.

Layout hierarchy:

1. High-signal topbar (title, status, collaboration controls)
2. Canvas dominant center
3. Supporting right rail (AI + Inspector)
4. Floating creation/navigation controls (dock + zoom)

### Screen 4: Share Panel

Primary task: configure access safely.

Layout hierarchy:

1. Visibility and link settings
2. Membership management
3. Save/confirmation states

### Screen 5: Utility Overlays

Primary task: communicate system state without noise.

- Reconnect banner: immediate status clarity
- Metrics/log overlays: developer utility, visually consistent but low prominence

## 7) Rollout Order

1. Shared layout primitives and spacing rhythm
2. Landing v2 layout + style
3. Dashboard layout + style
4. Board shell layout refinements (no canvas logic changes)
5. Side panels and overlays
6. Final responsive/contrast polish

## 8) Acceptance Criteria

- Every screen has clear, intentional hierarchy.
- No layout region feels like placeholder wireframe scaffolding.
- No behavior regressions in tests or runtime flows.
- Visual system is consistent across surfaces, controls, and statuses.
- UI feels production-ready, not demo-grade.
