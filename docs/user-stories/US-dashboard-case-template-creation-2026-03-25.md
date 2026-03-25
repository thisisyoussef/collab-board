# US: Dashboard Case Template Creation

## User Story

As a litigation case manager  
I want to create a new case board from a starter template on the dashboard  
So that I can begin analysis with a structured evidence/claim layout instead of a blank board

## Acceptance Criteria

1. **Given** I am on `All cases` and choose a template from the dashboard template selector  
   **When** I click `Create from template`  
   **Then** a new board is created with starter template objects and I am navigated to that board.

2. **Given** I have not selected a template  
   **When** the dashboard form is visible  
   **Then** `Create from template` remains disabled so no accidental template creation is triggered.

3. **Given** I trigger template creation and the commit is still in progress  
   **When** I click `Create from template` again  
   **Then** duplicate requests are prevented until the pending commit resolves, and the button shows `Creating...`.
