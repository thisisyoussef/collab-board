# US4-05A: Presenter Mode Follow-Me (V1)

## Status

- State: Ready for User Checkpoint
- Owner: Codex
- Depends on: US4-04 approved

## User Story

As a presenter  
I want to broadcast my board viewport and let collaborators follow it live  
So that I can run guided walkthroughs without repeatedly asking others to pan and zoom manually

## Acceptance Criteria

1. Given I am an editor on a board and no presenter is active
When I click `Start Presenter`
Then my session is marked as the active presenter and other participants can see that a presenter is live.

2. Given another user is the active presenter
When I click `Follow Presenter`
Then my board viewport updates to the presenter's broadcasted pan/zoom position.

3. Given I am currently following a presenter
When I press `Escape` or click `Stop Following`
Then follow mode exits immediately and my viewport control is restored.

4. Given I am following and the presenter session ends
When the presenter stops or disconnects
Then follow mode exits automatically and the presenter indicator clears.

## Scope

In scope:

1. Socket presenter start/stop state broadcast.
2. Socket presenter viewport broadcast + follower apply flow.
3. Board topbar controls for start/stop presenter and follow/stop following.
4. Escape-key exit for follow mode.

Out of scope:

1. Presenter queueing or handoff prompts.
2. Per-follower permissions or analytics.
3. Session recording integration.

## TDD Evidence

Added tests first:

1. `src/hooks/usePresenterMode.test.ts`
2. `src/pages/Board.test.tsx` (topbar + read-only presenter control assertions)

Implemented until green:

1. `src/hooks/usePresenterMode.ts`
2. `src/pages/Board.tsx`
3. `src/types/realtime.ts`
4. `server/index.js`
