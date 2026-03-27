# User Story: Dashboard meaningful case titles

As a litigation user  
I want dashboard case create and rename actions to reject empty or whitespace-only titles  
So that my case list remains clear and free from accidental blank entries.

## Acceptance criteria

1. **Given** I am on the dashboard and the new case field is empty or contains only spaces  
   **When** I view the create controls  
   **Then** the **Create Case** button is disabled.

2. **Given** I enter only whitespace in the new case field  
   **When** I submit the create form  
   **Then** no create request is sent and no navigation occurs.

3. **Given** I enter a case title with leading/trailing spaces  
   **When** I submit create  
   **Then** the create request uses the trimmed title value.

4. **Given** I open rename for an existing case and clear the input (or enter only spaces)  
   **When** I view rename actions  
   **Then** the **Save** button is disabled and Enter does not trigger rename.

5. **Given** I enter a rename value with leading/trailing spaces  
   **When** I save rename  
   **Then** the rename request uses the trimmed title value.
