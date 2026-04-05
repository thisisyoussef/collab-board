# User Story — Shared Dashboard Excludes Owned Cases

## Story

As a collaborating attorney  
I want the **Shared with me** dashboard tab to hide cases I own  
So that I can quickly focus on boards that actually come from co-counsel or shared links

## Acceptance Criteria

1. **Given** I have recent-link records that include one board I own and one board owned by someone else  
   **When** shared boards are loaded for my dashboard  
   **Then** only the board owned by someone else appears in **Recent case links**

2. **Given** explicit membership records include an `owner` role entry for my own board and an `editor` role for a teammate board  
   **When** shared boards are loaded  
   **Then** my own board is excluded and only the teammate board appears in **Shared by co-counsel**

3. **Given** every board candidate from explicit memberships and recent links is owned by me  
   **When** shared boards are loaded  
   **Then** both shared sections are empty and the dashboard treats the shared list as empty

## Scope

- Filter shared dashboard board summaries by `ownerId !== currentUserId` before composing explicit/recent sections.
- Preserve existing behavior for sorting, dedupe, and fallback error handling.
- Add tests that cover mixed ownership and all-owned edge cases.
