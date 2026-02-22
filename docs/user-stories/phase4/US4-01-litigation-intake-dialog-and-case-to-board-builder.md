# US4-01: Litigation Intake Dialog and Case-to-Board Builder

## Status

- State: In Progress
- Owner: Codex
- Depends on: US4-00 approved

## Persona

**Alex, the Litigation Associate** needs to transform raw case materials into a structured strategy board quickly.

**Sam, the Collaborator** needs a guided intake flow with examples so teammates submit consistent inputs.

**Jordan, the Reviewer** needs a deterministic generation path with explicit human approval before changes are applied.

## User Story

> As Alex, I want to paste litigation notes and upload supporting excerpts so the board is scaffolded automatically.

> As Sam, I want intake prompts and examples so I know what to provide without legal-tech training.

> As Jordan, I want generated output previewed and approved before board mutation.

## Goal

Implement a specialized litigation intake workflow that collects case inputs, generates a structured board plan (claims/evidence/witnesses/timeline), and applies it only after user confirmation.

## Scope

In scope:

1. Intake dialog entrypoint on board page.
2. Guided intake fields with sample prompts/examples.
3. AI-assisted parse endpoint from intake text to structured schema.
4. Deterministic layout engine from schema to board actions.
5. Preview + approve/reject flow before apply.
6. Realtime, persistence, and history integration on apply.

Out of scope:

1. Full OCR/document ingestion pipeline.
2. Native third-party legal platform integrations.
3. Batch background processing queue for large files.

## Pre-Implementation Audit

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/lib/ai-executor.ts`
5. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/types/ai.ts`
7. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

## Preparation Phase (Mandatory)

1. Local audit
- Identify right-panel entrypoints and modal layering patterns.
- Identify existing AI apply pathway to reuse history/realtime/persistence behavior.

2. Web research (official docs first)
- React controlled form + async UI patterns.
- Anthropic/OpenAI structured JSON generation guardrails.

3. Preparation Notes
- assumptions:
- risks:
- planned failing tests:

## UX Script

Happy path:

1. User clicks `Build board from case input`.
2. Intake dialog opens with fields:
   - Case summary
   - Claims
   - Witness excerpts
   - Evidence/exhibits
   - Timeline notes
3. User can open examples for each field.
4. User clicks `Generate draft`.
5. System returns preview: extracted entities + planned board layout.
6. User edits/removes generated items if needed.
7. User clicks `Apply to board`.
8. Board updates with created frames/nodes/connectors and success notice.

Edge cases:

1. Empty/low-signal input shows validation guidance.
2. Oversized input is blocked with explicit limits.
3. AI parse failure shows retry option and no board mutation.
4. User can cancel without side effects.

## Implementation Details

Planned files:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/LitigationIntakeDialog.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/components/LitigationIntakeDialog.test.tsx`
3. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useLitigationIntake.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useLitigationIntake.test.ts`
5. `/Users/youss/Development/gauntlet/collab-board/src/lib/litigation-intake-layout.ts`
6. `/Users/youss/Development/gauntlet/collab-board/src/lib/litigation-intake-layout.test.ts`
7. `/Users/youss/Development/gauntlet/collab-board/api/ai/intake-to-board.ts`
8. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-intake-to-board.test.ts`
9. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
10. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Schema contract:

```ts
interface LitigationIntakeDraft {
  claims: Array<{ id: string; title: string; summary?: string }>;
  evidence: Array<{ id: string; label: string; citation?: string }>;
  witnesses: Array<{ id: string; name: string; quote?: string; citation?: string }>;
  timeline: Array<{ id: string; dateLabel: string; event: string }>;
  links: Array<{
    fromId: string;
    toId: string;
    relation: 'supports' | 'contradicts' | 'depends_on';
    reason?: string;
  }>;
}
```

Apply contract:

1. No direct board mutation from endpoint response.
2. Draft must be accepted client-side first.
3. Final apply uses deterministic layout function and existing board action path.

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/LitigationIntakeDialog.test.tsx`
- render fields and examples
- disable generate on invalid input
- open preview and apply/cancel actions

2. `/Users/youss/Development/gauntlet/collab-board/src/lib/litigation-intake-layout.test.ts`
- deterministic positions for claims/evidence/witness/timeline
- stable IDs/relation mapping

3. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-intake-to-board.test.ts`
- schema validation
- rejection of missing required sections
- size limits and error handling

4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- entrypoint button opens dialog
- apply mutates board only after confirmation

Red -> Green -> Refactor:

1. Add failing dialog and layout tests.
2. Add failing endpoint tests.
3. Implement endpoint + hook + dialog.
4. Wire apply into Board flow.
5. Refactor for reuse and readability.

## Acceptance Criteria

- [x] Intake dialog exists with guided fields and examples.
- [x] AI parse returns structured draft or explicit validation errors.
- [ ] Draft preview is editable/reviewable before apply.
- [x] No board mutation occurs without explicit user confirmation.
- [x] Applied draft creates expected frames/nodes/connectors consistently.
- [x] Realtime/persistence/history remain stable after apply.

## Local Validation

1. `npm run lint`
2. `npm run test -- src/components/LitigationIntakeDialog.test.tsx src/lib/litigation-intake-layout.test.ts src/api/ai-intake-to-board.test.ts src/pages/Board.test.tsx`
3. `npm run test`
4. `npm run build`

## Deployment Handoff (Mandatory)

1. Commit implementation and docs on the working branch.
2. Push the branch to `origin`.
3. Deploy the latest branch state to Vercel.
4. Record deployed URLs and commit SHA in `Checkpoint Result`.
5. If deployment is blocked, document blocker and owner in `Checkpoint Result`.

## User Checkpoint Test

1. Paste sample litigation notes and generate a draft.
2. Verify preview quality and edit controls.
3. Apply draft and confirm board structure correctness.
4. Open second tab and verify realtime convergence.
5. Refresh and verify persistence.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Pending
- Notes:
  - Implemented intake dialog UI and board entrypoint (`Build board from case input`).
  - Added direct document upload in intake dialog, including upload-only generation path (no manual typing required).
  - Added authenticated intake parse endpoint (`/api/ai/intake-to-board`) with board role enforcement.
  - Added deterministic draft-to-actions layout engine and wired apply through existing AI executor commit path.
  - Fix-forward (February 22, 2026): deduplicated repeated uploads, removed synthetic upload placeholder claim fallback, and added structured section extraction (`Claims:`, `Evidence/Exhibits:`, `Witness Statements:`, `Timeline:`) from uploaded document text passed to intake API.
  - Commit: `77fd038` (pushed to `origin/main` on February 22, 2026).
  - Vercel production deploy: `https://collab-board-7fqrva1wy-thisisyoussefs-projects.vercel.app`, aliased to `https://collab-board-iota.vercel.app`.
  - TDD evidence captured via targeted tests for dialog, hook, API route, layout engine, and board entrypoint.
