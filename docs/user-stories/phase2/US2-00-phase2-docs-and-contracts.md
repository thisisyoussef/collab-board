# US2-00: Phase II Docs and Contracts

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: Phase I completion

## Persona

**Alex, the Product Lead** wants a documented plan that prevents churn, rework, and implementation drift.

**Sam, the Implementer** needs contracts that are specific enough to code without guessing permissions, payloads, or migration behavior.

**Jordan, the Reviewer** needs objective gates and test-first criteria to evaluate each story quickly.

## User Story

> As Alex, I want Phase II documented as actionable user stories so the team executes in clear, approved increments.

> As Sam, I want explicit contracts and preparation requirements so implementation is predictable and low-risk.

> As Jordan, I want TDD requirements embedded in each story so quality is built in rather than bolted on.

## Goal

Create a decision-complete Phase II documentation baseline, including contracts, preparation protocol, and TDD expectations for all downstream stories.

## Scope

In scope:

1. Add full Phase II story scaffold.
2. Define Firestore schema v2 and compatibility defaults.
3. Define membership and recents collections.
4. Define board object model expansion contract.
5. Define realtime payload metadata additions.
6. Define AI endpoint auth/permission contract.
7. Define route behavior contract for auth/public access.
8. Define mandatory preparation phase and TDD protocol.

Out of scope:

1. Runtime feature implementation.
2. Firestore rules deployment.
3. UI changes beyond docs.

## Pre-Implementation Audit

Local docs to review before implementation starts:

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/pre-search.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/firebase-auth.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/firebase-firestore.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/socketio.md`
6. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
7. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
8. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`

## Preparation Phase (Mandatory)

1. Run a local audit of docs and current code contracts.
2. Verify external API assumptions using official web docs (Firebase/Auth/Rules, Socket.IO, Anthropic).
3. Capture a short preparation note before coding with:
- docs reviewed
- web sources checked
- confirmed assumptions
- risk list

### Preparation Notes (Completed February 18, 2026)

Local docs/code reviewed:

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/pre-search.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/firebase-auth.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/firebase-firestore.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/socketio.md`
6. `/Users/youss/Development/gauntlet/collab-board/src/types/board.ts`
7. `/Users/youss/Development/gauntlet/collab-board/src/types/realtime.ts`
8. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`

Official web docs checked:

1. https://socket.io/docs/v4/middlewares/
2. https://socket.io/docs/v4/rooms/
3. https://socket.io/docs/v4/client-options/
4. https://firebase.google.com/docs/auth/admin/verify-id-tokens
5. https://firebase.google.com/docs/firestore/security/rules-conditions
6. https://firebase.google.com/docs/firestore/security/get-started
7. https://docs.anthropic.com/en/api/messages
8. https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview
9. https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use

Confirmed assumptions:

1. Socket handshake auth via `socket.auth` and server middleware remains the correct v4 pattern.
2. Firebase Admin `verifyIdToken` is the right contract for backend token verification.
3. Firestore rules must enforce access at document level and are evaluated per request.
4. Anthropic tool-use responses map cleanly to a normalized action list for preview/apply flows.

Risk list:

1. Existing Phase I boards missing sharing fields require compatibility fallbacks.
2. Rules migration can accidentally block existing boards if fallback semantics are not encoded.
3. Object type expansion can break renderer assumptions if unions are not updated consistently.

Planned failing tests captured for downstream stories:

1. Access matrix tests for private/auth/public + owner/editor/viewer/anon.
2. AI permission tests blocking viewer/anonymous apply.
3. Realtime dedupe tests using `txId` idempotency.
4. Object model tests for create/update/render of `circle`, `line`, `text`, `frame`, `connector`.

## Contract Snapshot

### Firestore: `boards/{boardId}` schema v2

Add fields:

1. `schemaVersion: 2`
2. `sharing.visibility: 'private' | 'auth_link' | 'public_link'`
3. `sharing.authLinkRole: 'editor' | 'viewer'`
4. `sharing.publicLinkRole: 'editor' | 'viewer'`

Compatibility behavior:

1. Missing `sharing` fields resolve as `auth_link` with `editor` role for signed-in users.
2. New boards default to `private`, with `authLinkRole='editor'` and `publicLinkRole='viewer'`.

### Firestore: new collections

1. `boardMembers/{boardId_userId}`
- `boardId`, `userId`, `role`, `addedAt`, `addedBy`, `updatedAt`

2. `boardRecents/{userId_boardId}`
- `userId`, `boardId`, `lastOpenedAt`

### Type contract: board objects

Target set:

1. `sticky`
2. `rect`
3. `circle`
4. `line`
5. `text`
6. `frame`
7. `connector`

### Type contract: realtime metadata

Optional metadata on object events:

1. `txId?: string`
2. `source?: 'user' | 'ai'`
3. `actorUserId?: string`

### API contract: `POST /api/ai/generate`

Required:

1. `Authorization: Bearer <Firebase ID token>`
2. `boardId` in request body
3. Permission check: signed-in owner/editor only
4. Normalized action plan response for preview/apply

### Route behavior contract

1. Signed-out user on non-public board is redirected to `/` and returned after auth.
2. Public-link boards are accessible without auth.
3. AI apply controls are disabled for non-owner/editor roles.

## UX Script

1. Team opens Phase II README and sees mandatory preparation + TDD expectations.
2. Team opens each story and sees full narrative + implementation + test plan.
3. Team uses contracts in this story to align schema and API changes.
4. Team uses checkpoint log as source of truth for progression.

## Implementation Details

Docs created/updated:

1. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/README.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-00-phase2-docs-and-contracts.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-01-ai-command-center.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-02-object-model-v2-core-primitives.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-03-ai-execution-engine-and-undo.md`
6. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-04-ai-multiplayer-consistency-and-metrics.md`
7. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-05-access-control-v2-and-rules.md`
8. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-06-sharing-ui-and-membership-workflow.md`
9. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-07-dashboard-shared-with-me-and-recents.md`
10. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-08-phase2-validation-and-signoff.md`
11. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/phase2-checkpoint-log.md`
12. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-TEMPLATE.md`
13. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/USER-STORY-AUTHORING-GUIDE.md`

## TDD Plan

1. Require each downstream story to list tests before code changes.
2. Require red->green->refactor evidence in checkpoint notes.
3. Require at least one integration-level test for each story.

## Acceptance Criteria

- [x] Full Phase II story scaffold exists.
- [x] All contracts above are explicitly documented.
- [x] Preparation phase and web-research requirement is explicit.
- [x] TDD expectations are explicit at story and phase levels.
- [x] Reusable story template and authoring guide exist for future phases.

## Local Validation

1. `npm run lint` -> pass
2. `npm run test` -> pass (20 files, 144 tests)
3. `npm run build` -> pass (warning: local Node `18.20.4`, Vite recommends Node `20.19+` or `22.12+`)

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Review US2 docs and confirm narrative quality matches Phase I style.
2. Confirm preparation phase includes web + local audit requirements.
3. Confirm TDD-first protocol is clearly enforceable.

## Checkpoint Result

- Production Frontend URL: N/A (docs-only story)
- Production Socket URL: N/A (docs-only story)
- User Validation: Pending (awaiting manual checkpoint)
- Notes:
  - Story is docs/contracts only; no runtime feature code changed.
  - All acceptance criteria for US2-00 documentation are complete and test protocol is ready for US2-01.
