# US2-07: Dashboard Shared with Me and Recents

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: US2-06 approved

## Persona

**Sam, the Collaborator** is in many shared boards and needs quick navigation.

**Alex, the Owner** wants confidence that boards shared with teammates are discoverable.

**Jordan, the Product Reviewer** needs clean information architecture between owned, shared, and recent boards.

## User Story

> As Sam, I want a proper Shared with me dashboard section so I can find collaboration boards quickly.

> As Alex, I want collaborators to reliably see boards I share without sending links repeatedly.

> As Jordan, I want shared and recent data merged cleanly so dashboard UX remains clear and scalable.

## Goal

Implement hybrid dashboard listing for explicit shared membership and recently opened shared links.

## Scope

In scope:

1. Activate Shared with me section.
2. Query explicit membership data from `boardMembers`.
3. Query recent-access data from `boardRecents`.
4. Merge, dedupe, and section lists with deterministic sorting.

Out of scope:

1. Full-text board search.
2. Organization/workspace hierarchy.

## Pre-Implementation Audit

Local sources:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Dashboard.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoards.ts`
3. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase2/US2-06-sharing-ui-and-membership-workflow.md`

## Preparation Phase (Mandatory)

1. Confirm source-of-truth precedence between explicit membership and recents.
2. Web-check relevant docs for:
- Firestore query/index behavior for combined dashboard reads
- React list rendering performance patterns
3. Record Preparation Notes with:
- list merge strategy
- sort strategy
- empty/loading/error states

## Listing Contract

1. `All boards` = owned boards only.
2. `Shared with me` has two sections:
- Explicit shared boards (from membership)
- Recent shared boards (from recents)
3. Dedupe by board ID with precedence:
- explicit membership first
- then recent fallback
4. Sort:
- explicit by board updated time desc
- recents by last opened desc

## UX Script

1. Collaborator opens dashboard.
2. `Shared with me` tab/section shows explicit shared boards.
3. Collaborator opens a link-only board.
4. Dashboard later shows that board in recents section.
5. If board becomes explicit member board, it appears in explicit section and is deduped from recents list.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useSharedBoards.ts`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardRecents.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Dashboard.tsx`
4. `/Users/youss/Development/gauntlet/collab-board/src/types/sharing.ts`

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useSharedBoards.test.ts`
- merges explicit + recent lists
- dedupe precedence rules
- sorted outputs

2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useBoardRecents.test.ts`
- upserts recent on board open
- updates timestamp for repeated opens

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Dashboard.test.tsx`
- renders sections correctly
- empty states and error states
- opening card navigates to board

Red -> Green -> Refactor:

1. Add failing hook tests for merge rules.
2. Add failing dashboard rendering tests.
3. Implement hooks and UI.
4. Refactor repeated card rendering into shared component if needed.

## Acceptance Criteria

- [x] Shared with me section is active.
- [x] Explicit shared boards are shown.
- [x] Recent shared boards are shown.
- [x] Dedupe and sorting follow listing contract.
- [x] Opening boards updates recents tracking.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/hooks/useSharedBoards.test.ts src/hooks/useBoardRecents.test.ts src/pages/Dashboard.test.tsx`
3. `npm run test`
4. `npm run build`

## User Checkpoint Test

1. Share boards from account A to account B.
2. Confirm account B sees explicit shared entries.
3. Open additional shared links and confirm recents entries.
4. Confirm dedupe behavior when explicit + recent overlap.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending
- Notes:
  - Implemented `useSharedBoards` with explicit-membership + recents merge/dedupe contract.
  - Activated dashboard `Shared with me` tab with sectioned rendering:
    - `Shared directly`
    - `Recent shared links`
  - Added board-recents upsert hook (`useBoardRecents`) and board-level integration for open tracking.
  - Added Firestore rules for `boardRecents/{userId_boardId}` owner-only read/write.
  - TDD evidence:
    - `src/hooks/useSharedBoards.test.ts` (3)
    - `src/hooks/useBoardRecents.test.ts` (3)
    - `src/pages/Dashboard.test.tsx` additions (3)
  - Local validation:
    - `npm run lint` (pass, 1 existing warning in `src/context/AuthContext.tsx:44`)
    - `npm run test -- src/hooks/useSharedBoards.test.ts src/hooks/useBoardRecents.test.ts src/pages/Dashboard.test.tsx` (pass)
    - `npm run test` (pass: 35 files / 231 tests)
    - `npm run build` (pass; Vite warns local Node 18 is below recommended version)
