# US3-06: Submission Artifacts and Release Package

## Status

- State: Pending
- Owner: Codex
- Depends on: US3-05 approved

## Persona

**Alex, the Candidate** needs all required deliverables complete and coherent before deadline.

**Sam, the Reviewer** needs links and documents to be easy to validate quickly.

**Jordan, the Release Owner** needs a final package with no missing submission items.

## User Story

> As Alex, I want all PRD submission artifacts assembled so I can submit confidently.

> As Sam, I want each artifact to be complete and linked so review is efficient.

> As Jordan, I want a release checklist that verifies all required deliverables.

## Goal

Produce and verify all non-code PRD submission artifacts: demo video, AI development log, AI cost analysis, deployed-link docs, and social-post package.

## Scope

In scope:

1. README release-ready updates (live URLs, architecture summary, setup clarity).
2. Demo video script/final cut checklist.
3. AI Development Log document (1-page format).
4. AI Cost Analysis document with assumptions and user-scale projections.
5. Social post draft with required content.
6. Final artifact index with absolute links/paths.

Out of scope:

1. New runtime feature work.
2. Post-submission marketing strategy.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`
2. `/Users/youss/Development/gauntlet/collab-board/README.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/pre-search.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/mcp-setup.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/phase3-checkpoint-log.md`

## Preparation Phase (Mandatory)

1. Local audit
- Verify currently missing submission files and placeholders.

2. Web research (official docs first)
- Check any required platform formats/limits for deliverables.

3. Preparation Notes
- assumptions:
- risks:
- planned failing checks:

## UX Script

1. Reviewer opens README and immediately sees deployed links and setup instructions.
2. Reviewer opens artifact index and accesses all required submission files.
3. Reviewer validates AI log and cost analysis format against PRD requirements.
4. Reviewer validates demo and social-post readiness.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/README.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/submission/README.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/submission/ai-development-log.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/submission/ai-cost-analysis.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/submission/demo-video-notes.md`
6. `/Users/youss/Development/gauntlet/collab-board/docs/submission/social-post-draft.md`

Artifact contract:

```ts
interface SubmissionArtifact {
  key: 'repo' | 'demo_video' | 'pre_search' | 'ai_log' | 'cost_analysis' | 'deployed_app' | 'social_post';
  path: string;
  status: 'ready' | 'pending';
}
```

## TDD Plan

Write checks first:

1. Artifact completeness checklist (docs-based)
- every PRD submission item mapped to an artifact path
- no placeholder statuses in final package

2. README verification checklist
- live URL populated
- setup/deploy instructions accurate

Red -> Green -> Refactor:

1. Add failing checklist with missing artifacts.
2. Create/update documents to satisfy each item.
3. Refactor docs structure for clarity.

## Acceptance Criteria

- [ ] All PRD submission artifacts exist and are complete.
- [ ] README is release-ready with live deployment information.
- [ ] AI Development Log is complete and scoped to PRD template.
- [ ] AI Cost Analysis includes development spend and projections.
- [ ] Social post draft includes required elements.

## Local Validation

1. Artifact checklist pass.
2. Link/path verification pass.
3. Optional markdown lint pass.

## User Checkpoint Test

1. Open artifact index and verify every required deliverable.
2. Spot-check content completeness against PRD table.
3. Approve release package or request targeted fixes.

## Checkpoint Result

- Production Frontend URL: Pending
- Production Socket URL: Pending
- User Validation: Pending
- Notes: Pending implementation.
