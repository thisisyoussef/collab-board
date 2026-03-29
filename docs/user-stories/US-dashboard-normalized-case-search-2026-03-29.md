# User Story — Dashboard Normalized Case Search (2026-03-29)

As a litigation user managing many case boards  
I want dashboard search to match titles even when punctuation or spacing differs  
So that I can quickly find the right case despite legal formatting differences

## Acceptance Criteria

1. Given I am on `All cases` and a board title includes punctuation (`Smith v. Acme, Inc.`)  
When I search for `smith acme inc` in `Search cases`  
Then that board remains visible and non-matching boards are hidden.

2. Given I am on `Shared with me` and a shared board title contains docket-style punctuation (`Case #24-CV-0192`)  
When I search for `24cv0192` in `Search cases`  
Then that board is shown as a match.

3. Given I run a regular case-insensitive keyword search with exact spacing  
When I search by title keyword in either tab  
Then existing search behavior remains unchanged.

## Notes

- Scope is UI-local filtering only; no Firestore schema/query changes.
- Normalization strips punctuation and compares both spaced and compact forms for robust matching.
