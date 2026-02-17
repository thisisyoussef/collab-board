# Phase I User Stories

This folder tracks the implementation and validation workflow for Phase I.

## Workflow Rules

1. **Audit first:** Read the "Pre-Implementation Audit" section of the story. Review every listed doc. Understand the APIs and patterns before writing code.
2. Implement one story at a time.
3. Run local validation (`npm run build`, `npm run lint`, plus story checks).
4. Deploy frontend and socket server to production.
5. Execute manual checkpoint tests.
6. Record results in `phase1-checkpoint-log.md`.
7. Stop and wait for user approval before starting the next story.

## Reference Docs

All docs live in `docs/` and should be consulted before each story:

| Doc | Content |
|-----|---------|
| `pre-search.md` | Architecture decisions, deployment model, cost analysis |
| `socketio.md` | Socket.IO server/client API, rooms, events, middleware |
| `firebase-auth.md` | Google Sign-In, auth state, ID tokens, server verification |
| `firebase-firestore.md` | CRUD, queries, listeners, debounced saves |
| `react-konva.md` | Canvas components, events, drag/drop, Transformer |
| `konva-api.md` | Full Konva node API reference |
| `konva-select-transform.md` | Selection rectangle and transform patterns |
| `CLAUDE.md` | Critical performance patterns, naming, anti-patterns |

## Story Order

1. `US-00-docs-and-env.md`
2. `US-01-auth-login.md`
3. `US-02-socket-auth-handshake.md`
4. `US-03-presence-awareness.md`
5. `US-04-cursor-sync.md`
6. `US-05-local-canvas-and-persistence.md`
7. `US-06-realtime-object-sync.md`
8. `US-07-reconnect-and-phase1-validation.md`

## Definition of Done (Phase I)

- All stories are marked "Approved".
- Every story has production URLs and a completed checkpoint section.
- The PRD collaboration scenarios pass in US-07.
