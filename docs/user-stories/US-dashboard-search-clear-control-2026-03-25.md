# User Story: Dashboard Search Clear Control (2026-03-25)

As a litigation lead  
I want a one-click way to clear the active dashboard search query  
So that I can quickly recover the full case list without manual input editing

## Acceptance Criteria

1. **Given** I am on the dashboard and the active tab search query is empty  
   **When** the page renders  
   **Then** a clear-search button is not shown.

2. **Given** I have entered a non-empty search query on **All cases**  
   **When** I click the clear-search control  
   **Then** the All cases search query resets to empty and the full owned list is shown.

3. **Given** I have different non-empty queries saved per tab  
   **When** I clear search from the currently active tab  
   **Then** only that tab query is cleared and the other tab query remains unchanged.
