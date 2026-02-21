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

- MCPs used: Desktop Commander (file system + process management), Claude in Chrome (browser automation for testing), Firecrawl (documentation scraping), Control Chrome (tab management), Pencil (design prototyping)
- What MCPs enabled: Automated file scaffolding and multi-file edits across 50+ source files; browser-based smoke testing of deployed URLs; real-time documentation fetching for Socket.IO, Konva, and Firebase APIs during implementation
- Any MCP limitations and fallback approach: Desktop Commander's file write line limits required chunked writes for large files; browser automation tools couldn't interact with canvas (Konva) elements directly — fell back to manual QA for canvas interactions; Firecrawl occasionally hit rate limits on rapid doc lookups — cached results locally

## 3) Effective Prompts (3-5)

1. **TDD story scaffold:** "Implement US2-03 (AI board agent) using TDD. Write failing tests first for all 9 tool call types (createStickyNote, createShape, moveObject, etc.), then implement the minimum code to pass each test. Use the Vercel serverless pattern from CLAUDE.md."
2. **Performance architecture:** "Add viewport culling to the canvas. Create a pure function getVisibleObjects that takes objects, stage position, scale, and viewport size, filters by AABB intersection, and returns only visible objects. Write tests first covering inside, outside, partial overlap, and edge cases."
3. **Multi-agent parallel execution:** "I have 5 independent user stories (US3-01 through US3-05) that can be worked on in parallel. Each has its own acceptance criteria and test files. Dispatch them to separate agents, each working in its own git worktree to avoid merge conflicts."
4. **Socket.IO latency validation:** "Set up a Socket.IO echo test that measures round-trip latency across 100 iterations. The cursor target is <50ms and object sync target is <100ms. Emit timestamped events and compute average/p95/max on the client side. Show results in MetricsOverlay."
5. **AI A/B benchmark design:** "Design a benchmark system that tests multiple AI providers (Anthropic Claude, OpenAI GPT-4) across the same prompt suite. Use LangSmith tracing for observability. Support deterministic A/B routing with configurable traffic split. Run as a GitHub Actions workflow on deploy."

## 4) Code Analysis (AI vs Hand-Written)

- Estimated AI-generated code: ~85%
- Estimated hand-written/edited code: ~15%
- How estimate was computed: Multi-agent workflow — Codex, Cursor, and Claude Code each generated initial implementations from user stories and acceptance criteria. Human review consisted of: (1) writing/refining prompts and acceptance criteria, (2) reviewing and approving generated code, (3) manual integration fixes when agent outputs conflicted, (4) production debugging of deployment-specific issues (Vercel cold starts, Render spin-down). The 15% hand-written estimate covers prompt engineering, merge conflict resolution, environment configuration, and targeted hotfixes.

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

## 7) Repository Evidence

- 529 tests across 52 test files (vitest)
- GitHub commit history shows AI-first workflow with story-driven commits
- LangSmith traces available for AI endpoint calls (provider comparison data)
- Performance metrics validated via MetricsOverlay with PRD threshold indicators
