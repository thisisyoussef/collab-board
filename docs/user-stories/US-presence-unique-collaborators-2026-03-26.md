# User Story — Presence Unique Collaborators (2026-03-26)

As a collaborator on a shared case board  
I want the topbar presence avatars to show each person only once  
So that I can quickly understand who is online without duplicate entries from extra tabs

## Acceptance Criteria

1. Given the presence snapshot includes two socket sessions for the same `userId`  
When the topbar avatars render  
Then that collaborator appears once in the presence avatar list.

2. Given a collaborator has two active sockets on the board  
When one of those sockets disconnects and emits `user:left`  
Then that collaborator remains visible in presence because at least one socket is still connected.

3. Given exactly one collaborator is shown in the topbar presence cluster  
When the presence cluster accessibility label is rendered  
Then it uses singular grammar (`1 person on this case board`) instead of plural grammar.

## Notes

- Scope is intentionally focused on topbar presence display and count semantics.
- Internal socket-level tracking remains in place for realtime leave animations and cleanup.
