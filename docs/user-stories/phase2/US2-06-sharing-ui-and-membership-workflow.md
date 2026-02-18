# US2-06: Sharing UI and Membership Workflow

## Status

- State: Pending
- Owner: Codex
- Depends on: US2-05 approved

## Persona

**Alex, the Owner** wants a polished share experience that feels like a real product, not a hidden config panel.

**Sam, the Invitee** wants to open a shared board, understand their role quickly, and save it to workspace.

**Jordan, the Admin-Minded Reviewer** wants role changes to be immediate and auditable.

## User Story

> As Alex, I want a clear share panel where I can configure visibility and role behavior with confidence.

> As Sam, I want a simple "Save to workspace" flow after opening shared links so boards are easy to find later.

> As Jordan, I want owner-only share controls and reliable role updates so governance is consistent.

## Goal

Deliver share settings and membership management UX in board page aligned with Phase II permission model.

## Scope

In scope:

1. Share panel UI in board context.
2. Visibility selector.
3. Required role selection when enabling public mode.
4. Member list management (role update/remove).
5. Save-to-workspace action for collaborators.

Out of scope:

1. Email invitations and directory search.
2. Organization/team-wide role inheritance.

## Pre-Implementation Audit

Local sources:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoards.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/lib/firebase.ts`
4. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-05-access-control-v2-and-rules.md`

## Preparation Phase (Mandatory)

1. Confirm role model and visibility behavior from US2-05.
2. Web-check relevant docs for:
- Firestore transaction/update patterns for role edits
- React UX patterns for destructive confirmations and disabled owner-only controls
3. Record Preparation Notes with:
- share panel state model
- validation rules
- failure/retry behavior

## UX Script

Owner flow:

1. Owner clicks topbar `Share`.
2. Panel shows current visibility and role summary.
3. Owner switches to `public_link`.
4. UI requires explicit public role (`viewer` or `editor`) before save.
5. Save persists settings and shows success notice.

Collaborator flow:

1. Collaborator opens shared board.
2. Collaborator clicks `Save to workspace`.
3. Membership record is created for collaborator.
4. Success notice confirms board is now in Shared with me.

Member management flow:

1. Owner opens member list in share panel.
2. Owner changes collaborator role editor<->viewer.
3. Owner removes collaborator.
4. Permission changes apply on next board permission evaluation.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/ShareSettingsPanel.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardSharing.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/sharing.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`

Data writes:

1. Board sharing config to `boards/{boardId}.sharing`.
2. Collaborator workspace save to `boardMembers/{boardId_userId}`.

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/ShareSettingsPanel.test.tsx`
- owner-only controls
- required public-role selection validation
- role update/remove controls

2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardSharing.test.ts`
- visibility update payloads
- member role update/remove writes
- save-to-workspace write behavior

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- share panel integration and state transitions

Red -> Green -> Refactor:

1. Add failing panel and hook tests.
2. Implement minimal panel + hook behaviors.
3. Refactor validation and write helpers.

## Acceptance Criteria

- [ ] Owner can configure visibility and role behavior from share panel.
- [ ] Public mode requires explicit role selection at enable-time.
- [ ] Collaborator can save board to workspace.
- [ ] Owner can update/remove member roles.
- [ ] Non-owner cannot modify sharing settings.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/components/ShareSettingsPanel.test.tsx src/hooks/useBoardSharing.test.ts src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## User Checkpoint Test

1. Owner sets each visibility mode and saves.
2. Collaborator opens link and saves to workspace.
3. Owner changes collaborator role and validates behavior.
4. Owner removes collaborator and validates access change.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
