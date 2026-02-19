# AI Development Log (1 Page)

> PRD-required summary of AI-first development workflow.

Date: February 19, 2026
Project: CollabBoard

## 1) Tools and Workflow

- Primary coding agent(s): `Codex`, `Cursor`
- Secondary support: `Claude` (planning/iteration where used)
- Workflow model:
  1. Write or refine user stories and acceptance criteria.
  2. Start with failing tests for each story.
  3. Implement minimum change set, then refactor with green tests.
  4. Validate with local checks and production smoke tests.

## 2) MCP Usage

- MCPs used: `TODO`
- What MCPs enabled: `TODO`
- Any MCP limitations and fallback approach: `TODO`

## 3) Effective Prompts (3-5)

1. `TODO: add exact prompt`
2. `TODO: add exact prompt`
3. `TODO: add exact prompt`
4. `TODO: add exact prompt (optional)`
5. `TODO: add exact prompt (optional)`

## 4) Code Analysis (AI vs Hand-Written)

- Estimated AI-generated code: `TODO %`
- Estimated hand-written/edited code: `TODO %`
- How estimate was computed: `TODO`

## 5) Strengths and Limitations

Strengths:
- Rapid scaffolding of tests and story-driven implementation plans.
- Faster iteration on repetitive refactors and doc generation.
- Strong support for edge-case brainstorming.

Limitations:
- Requires tight prompting and acceptance criteria to avoid drift.
- Generated code needs careful project-specific validation.
- Documentation and runtime can diverge unless checkpoints are enforced.

## 6) Key Learnings

- TDD + story gates improves reliability under time pressure.
- Explicit acceptance contracts reduce ambiguity in AI-generated output.
- Splitting work into low-conflict parallel tracks preserves delivery speed.

## 7) Finalization TODOs

- Replace all `TODO` placeholders with final evidence.
- Keep this file near one page in final submission form.
