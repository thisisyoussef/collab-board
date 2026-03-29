# US4-05A — Presenter Follow Cursor (2026-03-29)

## User Story

As a collaborating reviewer  
I want to follow a teammate's live cursor from the board top bar  
So that I can stay aligned during walkthroughs without manually panning.

## Acceptance Criteria

1. Given I am on a board with no other connected teammates, when I view presenter controls, then follow mode shows no available teammate cursors and the follow action is disabled.
2. Given at least one teammate is connected, when I select a teammate and start follow mode, then the UI shows that I am following that teammate and exposes a stop-follow action.
3. Given follow mode is active and the selected teammate cursor updates, when the board receives that cursor update, then the viewport recenters toward the followed teammate cursor position.

## Automated Coverage

- `src/pages/Board.test.tsx`
  - `disables presenter follow when no teammate is connected`
  - `allows selecting and starting presenter follow for a teammate`
- `src/lib/presenter-follow.test.ts`
  - viewport centering math at scale `1`
  - viewport centering math under zoom
  - invalid numeric input guard
