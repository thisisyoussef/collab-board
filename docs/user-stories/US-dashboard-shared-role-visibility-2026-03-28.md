# User Story: Dashboard Shared Access Labels

As a collaborating attorney  
I want shared case cards to show my access level  
So that I know whether I can edit before opening a case

## Acceptance Criteria

1. Given I am in "Shared with me" and a case is directly shared with role `viewer`  
When the shared cards render  
Then that case shows an access chip labeled `View only`

2. Given I am in "Shared with me" and a case is directly shared with role `editor`  
When the shared cards render  
Then that case shows an access chip labeled `Can edit`

3. Given I am in "Shared with me" and a case appears only from a recent link (not direct membership)  
When the shared cards render  
Then no access chip is shown on that case card
