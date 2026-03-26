# User Story — Presenter Mode Follow Me (2026-03-26)

As a litigation presenter  
I want to broadcast my current viewport to collaborators with optional follow mode  
So that I can lead a live case walkthrough without asking everyone to pan and zoom manually

## Acceptance Criteria (Given / When / Then)

1. Given I am an editor on a board and no one is presenting, when I click `Start presenter mode`, then all board participants receive presenter state showing me as the active presenter.
2. Given another user is actively presenting, when I click `Follow`, then my board viewport mirrors incoming presenter viewport updates.
3. Given I am currently following a presenter, when I press `Escape`, then follow mode exits immediately and my viewport is no longer forced by presenter updates.
4. Given the active presenter disconnects or stops presenting, when presenter state is broadcast as empty, then all followers automatically exit follow mode.

## Scope Implemented

- Added presenter state + viewport realtime events to client/server contracts.
- Added server-side active presenter tracking per board room with disconnect cleanup.
- Added `usePresenterMode` hook for start/stop, follow/unfollow, and viewport publish/apply.
- Added `PresenterBanner` UI to start presenting, follow, stop following, and stop presenting.
- Integrated Board viewport sync, keyboard escape exit, and follower drag/zoom guardrails.

