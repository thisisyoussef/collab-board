# User Story — Shared Case Access Badges

As a shared-case collaborator  
I want to see my access level on each shared case card  
So that I know whether I can edit or only review before opening a case.

## Acceptance Criteria

### Case 1: Viewer badge is shown
Given I open the dashboard and switch to "Shared with me"  
When an explicitly shared case entry has role `viewer`  
Then the card shows the label "Viewer access".

### Case 2: Editor badge is shown
Given I open the dashboard and switch to "Shared with me"  
When an explicitly shared case entry has role `editor`  
Then the card shows the label "Editor access".

### Case 3: Owner badge is shown for explicit owner role
Given I open the dashboard and switch to "Shared with me"  
When an explicitly shared case entry has role `owner`  
Then the card shows the label "Owner access".

### Case 4: Recent link entries do not show role badges
Given I open the dashboard and switch to "Shared with me"  
When a case appears only in the "Recent case links" section  
Then the card does not show any access role label.
