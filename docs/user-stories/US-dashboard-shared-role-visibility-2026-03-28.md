# US: Dashboard Shared Role Visibility (2026-03-28)

## User Story
As a collaborating attorney  
I want to see my access level on each shared case in the dashboard  
So that I know whether I can edit or only review before opening a case

## Acceptance Criteria (Given/When/Then)
1. Given I open the `Shared with me` dashboard tab and a case is explicitly shared with `editor` access  
When the shared case list renders  
Then that case card shows a `Can edit` role chip.

2. Given I open the `Shared with me` dashboard tab and a case is explicitly shared with `viewer` access  
When the shared case list renders  
Then that case card shows a `View only` role chip.

3. Given I open the `Shared with me` dashboard tab and a case appears only in `Recent case links`  
When the shared case list renders  
Then that case card does not show an access role chip.
