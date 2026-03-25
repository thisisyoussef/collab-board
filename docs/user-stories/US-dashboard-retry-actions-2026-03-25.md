# US: Dashboard Retry Actions For Load Failures

## User Story

As a litigation case manager  
I want retry actions when dashboard case lists fail to load  
So that I can recover from transient Firestore/network issues without refreshing the app

## Acceptance Criteria

1. **Given** I am on `All cases` and the owned-board query fails  
   **When** the error is shown  
   **Then** I see a `Retry` button and can trigger a fresh owned-board reload.

2. **Given** I am on `Shared with me` and the shared-board query fails  
   **When** the error is shown  
   **Then** I see a `Retry` button and can trigger a fresh shared-board reload.

3. **Given** I click retry while a retry request is already in flight  
   **When** the retry button is disabled and labeled `Retrying...`  
   **Then** duplicate reload requests are not fired until the current retry completes.
