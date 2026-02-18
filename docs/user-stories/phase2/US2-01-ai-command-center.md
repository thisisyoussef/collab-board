# US2-01: AI Command Center UI

## Status

- State: Approved
- Owner: Codex
- Depends on: US2-00 approved

## Persona

**Alex, the Facilitator** wants to create structured board layouts quickly with natural language.

**Sam, the Cautious Collaborator** wants to inspect AI intentions before any mutation happens on a shared board.

**Jordan, the Observer** wants obvious UI states (loading/error/success) so AI usage feels trustworthy.

## User Story

> As Alex, I want an AI panel in the board workspace so I can request board changes without leaving context.

> As Sam, I want to preview AI action plans before they apply so I can keep collaboration safe and predictable.

> As Jordan, I want clear execution status feedback so I always know whether AI is thinking, failed, or ready.

## Goal

Deliver a production-quality right-sidebar AI command center UI: prompt input, API call flow, response rendering, action preview list, and preview/auto mode toggle shell.

## Scope

In scope:

1. Right sidebar AI panel component.
2. Prompt input (submit, keyboard shortcut, clear behavior).
3. Request lifecycle UI (idle/loading/error/success).
4. `/api/ai/generate` integration.
5. Normalized action preview rendering.
6. Preview vs Auto mode toggle persistence.

Out of scope:

1. Applying AI action plans to board state (US2-03).
2. Undo behavior (US2-03).
3. Role-based enable/disable logic (US2-05).

## Pre-Implementation Audit

Local sources:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-generate.test.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/MetricsOverlay.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md` (AI command categories)

## Preparation Phase (Mandatory)

1. Read local API contract and current board layout code.
2. Web-check relevant docs before coding:
- Anthropic Messages + tools response format
- React controlled form state patterns
- Accessibility guidance for command inputs and buttons
3. Write Preparation Notes with:
- expected API response shape
- error handling states
- planned failing tests

### Preparation Notes (Completed February 18, 2026)

Local docs/code reviewed:

1. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/api/ai/generate.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/api/ai-generate.test.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/components/MetricsOverlay.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/docs/prd.md`

Official web docs checked:

1. https://docs.anthropic.com/en/api/messages
2. https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview
3. https://react.dev/reference/react/useState
4. https://react.dev/reference/react-dom/components/textarea
5. https://www.w3.org/WAI/tutorials/forms/labels/

Expected API response shape:

1. `message?: string | null`
2. `toolCalls?: Array<{ id?: string; name?: string; input?: Record<string, unknown> }>`
3. `error?: string` for non-2xx responses

Error-handling decisions:

1. Non-2xx responses show inline non-destructive error in AI panel.
2. 401 and 429 get user-friendly fallback text.
3. Retry action reuses current prompt (or last submitted prompt).

Planned failing tests (executed first):

1. `AICommandCenter` UI render/loading/error/success behavior.
2. `useAICommandCenter` normalization + duplicate-submit guard + mode persistence.
3. `Board` integration (AI panel present + fetch request + disabled apply shell).

## UX Script

Happy path:

1. User opens board and sees AI panel on right side.
2. User enters prompt: `Create a SWOT template with four quadrants`.
3. Submit shows loading spinner and disables duplicate submits.
4. Response shows assistant summary and structured action list.
5. User toggles mode between Preview and Auto.
6. Apply controls show disabled helper text: `Execution available in US2-03`.

Error path:

1. API fails or returns malformed payload.
2. Panel shows non-destructive error state and retry button.
3. User can edit prompt and retry without refreshing page.

## Implementation Details

Implemented files:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.tsx`
2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.ts`
3. `/Users/youss/Development/gauntlet/collab-board/src/types/ai.ts`
4. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.tsx`
5. `/Users/youss/Development/gauntlet/collab-board/src/index.css`
6. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.test.tsx`
7. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.test.ts`
8. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`

Planned interfaces:

```ts
export type AIApplyMode = 'preview' | 'auto';

export interface AIActionPreview {
  id: string;
  name: string;
  summary: string;
  input: Record<string, unknown>;
}

export interface AIPanelState {
  prompt: string;
  mode: AIApplyMode;
  loading: boolean;
  error: string | null;
  message: string | null;
  actions: AIActionPreview[];
}
```

## TDD Plan

Write tests first:

1. `/Users/youss/Development/gauntlet/collab-board/src/components/AICommandCenter.test.tsx`
- renders prompt field, submit button, mode toggle
- loading state disables submit
- success renders message and action rows
- error state renders retry affordance

2. `/Users/youss/Development/gauntlet/collab-board/src/hooks/useAICommandCenter.test.ts`
- normalizes API payload to `AIActionPreview[]`
- preserves mode state
- blocks duplicate submission while loading

3. `/Users/youss/Development/gauntlet/collab-board/src/pages/Board.test.tsx`
- AI panel integrates without regressing current board layout behavior

Red -> Green -> Refactor:

1. Add failing component and hook tests.
2. Implement minimal state machine and API integration.
3. Refactor preview formatting helpers after green.

## Acceptance Criteria

- [x] AI panel appears in board UI and is interactive.
- [x] Prompt submission triggers API request and lifecycle states.
- [x] Response renders message + normalized action previews.
- [x] Mode toggle works and state persists during session.
- [x] Apply controls remain visibly disabled until US2-03.

## Local Validation

1. `npm run lint` -> pass
2. `npm run test -- src/components/AICommandCenter.test.tsx src/hooks/useAICommandCenter.test.ts src/pages/Board.test.tsx` -> pass (19 tests)
3. `npm run test` -> pass (22 files, 152 tests)
4. `npm run build` -> pass (Node `18.20.4` warning from Vite recommending `20.19+` or `22.12+`)

## User Checkpoint Test

1. Open board and verify AI panel placement.
2. Submit three prompts (simple, layout, complex template).
3. Confirm response list and status transitions behave correctly.
4. Toggle preview/auto and verify UI reflects selection.
5. Confirm no board mutation occurs yet.

## Checkpoint Result

- Production Frontend URL: https://collab-board-iota.vercel.app
- Production Socket URL: https://collab-board-0948.onrender.com
- User Validation: Passed on February 18, 2026
- Notes:
  - Added right-sidebar AI Command Center with prompt, mode toggle, clear/retry, and preview list rendering.
  - Hook blocks duplicate submissions while loading and persists Preview/Auto mode in localStorage.
  - Apply button intentionally disabled with helper copy until execution/undo stories (US2-03).
  - Vercel production deployment for this story: `dpl_E9gag6FMEwCJ1eeovH7h2AszFfUz` (aliased to `collab-board-iota.vercel.app` on February 18, 2026).
  - Manual checkpoint outcome: prompt entry, plan rendering, and disabled apply behavior all confirmed working as expected.
