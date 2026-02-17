# US-00: Docs and Environment Pivot

## Status

- State: Approved
- Owner: Codex
- Depends on: none

## Goal

Replace Ably-first documentation/environment references with Socket.IO-first guidance and create the Phase I user-story framework.

## Scope

- Update docs and `.env.example` to Socket.IO terminology.
- Add all story files in `docs/user-stories/`.
- Do not implement runtime Socket.IO code yet.

## Pre-Implementation Audit

Before writing any code, review and cross-reference these project docs:

- `docs/pre-search.md` — architecture decisions, tech stack, deployment model
- `docs/socketio.md` — Socket.IO server/client API, rooms, middleware
- `docs/firebase-auth.md` — Google Sign-In, auth state, ID tokens
- `docs/firebase-firestore.md` — CRUD, queries, real-time listeners
- `docs/react-konva.md` — canvas components, events, Transformer
- `docs/konva-api.md` — full Konva node API reference
- `docs/konva-select-transform.md` — selection and transform patterns
- `CLAUDE.md` — critical performance patterns, naming conventions, anti-patterns

**Be strategic:** Read the relevant docs for this story first. Identify the exact APIs/patterns needed. Plan file structure before creating files. Check for conflicts with existing code. Don't cargo-cult — adapt patterns to our specific needs.

## Tasks

1. Replace Ably references in `README.md`, `docs/*.md`, `CLAUDE.md`, and `.env.example` where they represent active architecture guidance.
2. Add Socket.IO env variables in `.env.example`.
3. Add user-story docs scaffold and checkpoint log.
4. Verify app still builds and lints.

## Acceptance Criteria

- `rg -n "\\b(Ably|ably)\\b" -S README.md .env.example CLAUDE.md docs/*.md` returns no active-architecture Ably references.
- `.env.example` contains `VITE_SOCKET_SERVER_URL` and server env placeholders.
- All planned files exist under `docs/user-stories/`.
- `npm run build` and `npm run lint` pass.

## Checkpoint Test (User)

1. Open updated docs and confirm Socket.IO is described as the realtime layer.
2. Open `.env.example` and confirm Socket.IO variables are present.
3. Confirm app still loads (`npm run dev`).

## Checkpoint Result

- Production Frontend URL: https://collab-board-h4cqo9jgj-thisisyoussefs-projects.vercel.app
- Production Socket URL: N/A for US-00 (first socket deployment starts in US-02)
- User Validation: Approved
- Notes: Approved by user in chat after validating docs and app load.
