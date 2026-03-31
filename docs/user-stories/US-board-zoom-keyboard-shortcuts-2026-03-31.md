# User Story: Board Zoom Keyboard Shortcuts

Date: 2026-03-31  
Status: Shipped

## Story

As a board collaborator  
I want keyboard shortcuts for zooming in, zooming out, and resetting zoom  
So that I can navigate large case boards quickly without leaving the keyboard

## Acceptance Criteria (Given/When/Then)

1. Given I am focused on the board canvas (not typing in an input), when I press `Ctrl/Cmd` + `+` (or `=`), then the board triggers zoom-in behavior and prevents the browser default zoom shortcut.
2. Given I am focused on the board canvas (not typing in an input), when I press `Ctrl/Cmd` + `-`, then the board triggers zoom-out behavior and prevents the browser default zoom shortcut.
3. Given I am focused on the board canvas (not typing in an input), when I press `Ctrl/Cmd` + `0`, then the board resets zoom to 100% and prevents the browser default zoom shortcut.
4. Given I am typing in an input or textarea, when I press any zoom shortcut, then the board does not intercept that key event.

## Implementation Notes

- Added global keyboard handling in `Board.tsx` for:
  - `Ctrl/Cmd` + `+` / `=` / `Add` => zoom in
  - `Ctrl/Cmd` + `-` / `_` / `Subtract` => zoom out
  - `Ctrl/Cmd` + `0` / `Numpad0` => reset zoom
- Reused existing board zoom handlers to keep behavior consistent with the zoom chip controls.
- Preserved existing guardrail to avoid global shortcut interception while users are typing in form fields.

## Tests Added

- `src/pages/Board.test.tsx`
  - verifies zoom shortcuts are intercepted (preventDefault called) when not typing
  - verifies shortcuts are ignored when target is an input
