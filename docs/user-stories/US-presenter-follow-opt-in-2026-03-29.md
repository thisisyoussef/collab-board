# User Story — Presenter Follow Opt-In

## User Story

As a litigation team participant  
I want to opt in to follow a presenter teammate's cursor-driven viewport  
So that I can stay synchronized during live walkthroughs without manual panning

## Acceptance Criteria

1. Given at least one teammate cursor is active on the board  
When I open the top bar controls  
Then I can choose a presenter and start follow mode with a single action

2. Given I am in follow mode  
When the presenter cursor position updates  
Then my viewport recenters to keep the presenter in focus

3. Given I am in follow mode  
When I press `Escape` or click `Stop follow`  
Then follow mode exits immediately and my board returns to manual navigation

4. Given no teammate cursor is available  
When I view the top bar controls  
Then presenter follow controls are hidden

## Scope and Notes

- Story slice: US4-05 follow opt-in and escape behavior.
- Out of scope for this slice: explicit presenter broadcast socket protocol and reconnect handoff semantics.
- Date: March 29, 2026.
