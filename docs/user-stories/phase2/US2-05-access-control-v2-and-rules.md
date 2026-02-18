# US2-05: Access Control v2 and Firestore Rules

## Status

- State: Pending
- Owner: Codex
- Depends on: US2-04 approved

## Persona

**Alex, the Owner** wants strong control over board visibility and collaborator permissions.

**Sam, the Collaborator** wants permission behavior that is consistent and understandable.

**Jordan, the Security Reviewer** wants policy enforcement in UI, API, and Firestore rules without loopholes.

## User Story

> As Alex, I want to set board visibility and member roles so I can collaborate without exposing private work.

> As Sam, I want shared links to behave predictably based on configured role and visibility.

> As Jordan, I want access enforcement implemented server-side and client-side so security is not bypassable.

## Goal

Implement Phase II visibility and role model (`private`, `auth_link`, `public_link`; `owner`, `editor`, `viewer`) with compatibility behavior for legacy boards.

## Scope

In scope:

1. Effective role resolver across board, API, and AI apply paths.
2. Route behavior for signed-out users on non-public boards.
3. Firestore rules update for visibility and role checks.
4. Legacy fallback behavior for boards without `sharing` fields.

Out of scope:

1. Share settings UI (US2-06).
2. Shared dashboard aggregation (US2-07).

## Pre-Implementation Audit

Local sources:

1. `/Users/youss/Development/gauntlet/collab-board/firestore.rules`
2. `/Users/youss/Development/gauntlet/collab-board/src/App.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/context/AuthContext.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`

## Preparation Phase (Mandatory)

1. Audit current auth and routing behavior locally.
2. Web-check official docs for:
- Firebase Auth token verification behavior
- Firestore rules functions/conditions for nested fields
- secure authorization patterns for mixed public/private resources
3. Record Preparation Notes with:
- role resolution precedence
- compatibility assumptions
- rules test matrix

## Permission Matrix

### Private

1. Owner: read/write/apply AI
2. Explicit editor: read/write/apply AI
3. Explicit viewer: read-only
4. Signed-in non-member: deny
5. Anonymous: deny

### Auth Link

1. Owner: read/write/apply AI
2. Explicit role wins if present
3. Signed-in non-member: role = `authLinkRole`
4. Anonymous: deny

### Public Link

1. Owner: read/write/apply AI
2. Explicit role wins if present
3. Signed-in non-member: role = `publicLinkRole`
4. Anonymous: role = `publicLinkRole`
5. AI apply still requires signed-in owner/editor

### Legacy fallback

1. Missing sharing fields resolve to `auth_link` with editor-level signed-in access.

## Route/Auth Contract

1. Signed-out user opening non-public board is redirected to `/` with `returnTo`.
2. After successful auth, user returns to original board.
3. Public-link boards remain openable without auth.
4. Viewer users can pan/zoom/select but cannot mutate or apply AI.

## UX Script

1. Owner sets board to `private`.
2. Signed-in non-member opening link gets access-denied behavior.
3. Owner switches to `auth_link` with viewer role.
4. Signed-in non-member can open but cannot edit or apply AI.
5. Owner switches to `public_link` and chooses `editor`.
6. Anonymous user can open/edit board objects but still cannot apply AI.
7. Owner removes public access and grants explicit editor membership.
8. Explicit member regains signed-in full edit + AI apply access.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/access.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/App.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
5. `/Users/youss/Development/gauntlet/collab-board/firestore.rules`

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/lib/access.test.ts`
- full role/visibility matrix
- legacy fallback behavior

2. `/Users/youss/Development/gauntlet/collab-board/src/App.test.tsx`
- non-public redirect for signed-out users
- returnTo restore path after login

3. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-generate.test.ts`
- rejects anonymous and viewers
- accepts signed-in owner/editor

4. Firestore rules matrix checks via emulator or scripted verification.

Red -> Green -> Refactor:

1. Add failing matrix tests first.
2. Implement central access resolver and wire it everywhere.
3. Update rules and pass matrix checks.
4. Refactor duplicate checks into shared helper.

## Acceptance Criteria

- [ ] Effective permission behavior matches matrix.
- [ ] Signed-out non-public access redirects and returns correctly.
- [ ] Viewer cannot mutate board or apply AI.
- [ ] AI endpoint rejects unauthorized actors.
- [ ] Legacy boards continue functioning with compatibility defaults.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/lib/access.test.ts src/App.test.tsx src/api/ai-generate.test.ts`
3. `npm run test`
4. `npm run build`
5. Firestore rules validation (emulator or deploy dry run)

## User Checkpoint Test

1. Run visibility matrix with owner/editor/viewer/anonymous actors.
2. Confirm redirect/return behavior for non-public boards.
3. Confirm AI apply availability only for signed-in owner/editor.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
