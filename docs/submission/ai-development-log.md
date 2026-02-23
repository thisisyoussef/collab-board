# AI Development Log

> PRD-required summary of AI-first development workflow.

Date: February 22, 2026
Project: CollabBoard — Real-time collaborative whiteboard with AI board agent

## 1) Tools and Workflow

- **Primary agents:** Claude Code (planning, TDD, multi-file implementation), Codex (parallel story execution), Cursor (interactive editing, UI iteration)
- **Orchestration model:** Multi-agent dispatch — independent user stories assigned to separate agents working in parallel, coordinated via git branches and a shared CLAUDE.md specification
- **Workflow:**
  1. Author detailed CLAUDE.md with architecture rules, code patterns, performance targets, and anti-patterns
  2. Write user stories with explicit acceptance criteria and PRD gap mappings
  3. TDD: write failing tests first, implement minimum code to pass, refactor with green suite
  4. Validate locally (`npm run lint && npm test && npm run build`), then smoke-test production deploy
  5. Commit immediately after each meaningful work unit (auto-deploy via Vercel on push)

## 2) CLAUDE.md as Project-Level System Prompt

The CLAUDE.md file (~800 lines) was the most critical prompting artifact. It functioned as a persistent system prompt that every agent read at session start, ensuring consistency across agents, sessions, and context window resets. Key sections:

- **Critical Performance Pattern:** Explicit "BAD vs GOOD" code examples showing why React state kills canvas performance and how to use Konva refs instead. This prevented every agent from making the most common whiteboard performance mistake.
- **Board Object Schema:** Exact TypeScript-like schema for all object types, ensuring agents generated compatible data structures without coordination.
- **Socket.IO Sync Patterns:** Two-layer architecture (Socket.IO for speed, Firestore for durability), volatile vs reliable emit, cursor throttling at 50ms — agents implemented networking correctly on first pass.
- **AI Tool Schema:** 9 tool definitions with exact parameter signatures, so the AI board agent implementation matched the serverless function API contract.
- **Anti-Patterns:** Explicit "DO NOT" rules (never store canvas objects in React state, never write every change directly to Firestore, never block UI on Firestore acknowledgment) that prevented common mistakes across all agents.
- **Build Priority:** Strict numbered order (1-11) ensuring foundational infrastructure was validated before features were built on top.
- **Auto-Deploy Workflow:** Commit frequency rules and message format ensuring continuous deployment visibility.

**Why this worked:** Each agent session starts fresh with no memory of previous sessions. The CLAUDE.md provided the "memory" — architecture decisions, naming conventions, performance constraints, and code patterns that would otherwise be lost between sessions. When agents drifted, the CLAUDE.md's explicit anti-patterns caught them.

## 3) MCP Usage

- **MCPs used:** Desktop Commander (file system + process management), Claude in Chrome (browser automation for deployed testing), Firecrawl (documentation scraping for Socket.IO/Konva/Firebase APIs), Control Chrome (tab management), Context7 (library documentation lookup)
- **What MCPs enabled:** Automated file scaffolding and multi-file edits across 50+ source files; browser-based smoke testing of deployed Vercel URLs; real-time documentation fetching during implementation to verify API usage
- **Limitations:** Desktop Commander's file write limits required chunked writes for large files; browser automation couldn't interact with Konva canvas elements (no DOM nodes) — fell back to manual QA; Firecrawl hit rate limits on rapid lookups — cached results locally

## 4) Effective Prompts (5)

1. **TDD story scaffold:** "Implement US2-03 (AI board agent) using TDD. Write failing tests first for all 9 tool call types (createStickyNote, createShape, moveObject, etc.), then implement the minimum code to pass each test. Use the Vercel serverless pattern from CLAUDE.md."
   *Why effective:* Referenced CLAUDE.md patterns directly, specified test-first order, named exact scope (9 tool types).

2. **Performance architecture:** "Add viewport culling to the canvas. Create a pure function getVisibleObjects that takes objects, stage position, scale, and viewport size, filters by AABB intersection, and returns only visible objects. Write tests first covering inside, outside, partial overlap, and edge cases."
   *Why effective:* Specified the function signature, algorithm (AABB), and test cases upfront — left no ambiguity for the agent.

3. **Multi-agent parallel execution:** "I have 5 independent user stories (US3-01 through US3-05) that can be worked on in parallel. Each has its own acceptance criteria and test files. Dispatch them to separate agents, each working in its own git worktree to avoid merge conflicts."
   *Why effective:* Explicitly addressed the coordination problem (merge conflicts) and the solution (git worktrees) before agents started work.

4. **Socket.IO latency validation:** "Set up a Socket.IO echo test that measures round-trip latency across 100 iterations. The cursor target is <50ms and object sync target is <100ms. Emit timestamped events and compute average/p95/max on the client side. Show results in MetricsOverlay."
   *Why effective:* Quantified targets from CLAUDE.md performance gates, specified measurement method (timestamp-based), and output destination (MetricsOverlay).

5. **CLAUDE.md anti-pattern enforcement:** Including explicit "BAD" and "GOOD" code examples in CLAUDE.md (e.g., `const [objects, setObjects] = useState({})` marked BAD vs `stageRef.current.findOne()` marked GOOD) prevented performance regressions across all agents — more effective than any single prompt.
   *Why effective:* Agents pattern-match against examples. Showing the wrong approach alongside the right one with clear labels was more effective than describing the rule in prose.

## 5) Code Analysis (AI vs Hand-Written)

- **AI-generated code: ~85%** — Codex, Cursor, and Claude Code each generated implementations from user stories and acceptance criteria
- **Hand-written/edited: ~15%** — Prompt engineering, CLAUDE.md authoring, acceptance criteria, merge conflict resolution, environment configuration, deployment debugging (Vercel cold starts, Render spin-down, Firebase rules)
- **Methodology:** Compared git blame across 50+ source files; AI agents authored initial implementations, human reviewed and approved; the 15% hand-written work was disproportionately high-leverage (CLAUDE.md, prompts, architecture decisions)

## 6) Strengths and Limitations

**Strengths:**
- CLAUDE.md as persistent project memory eliminated re-explanation across agent sessions
- TDD-first workflow caught integration issues early (575 tests across 58 files)
- Multi-agent parallelism compressed a week of work into days
- Explicit anti-patterns in CLAUDE.md prevented the most common performance and architecture mistakes

**Limitations:**
- Agents on wrong branches required manual git operations to recover
- Cross-agent merge conflicts needed human judgment to resolve
- Canvas (Konva) interactions couldn't be automated — required manual QA
- Context window limits required session compaction and summary-based continuity

## 7) Key Learnings

- **CLAUDE.md is the highest-ROI artifact** in an AI-first project — invest heavily in it upfront
- **Anti-patterns > rules:** Showing agents what NOT to do (with code examples) is more effective than describing the correct approach in prose
- **TDD + story gates** improve reliability under time pressure — agents can't "skip ahead" when tests must pass first
- **Commit after every unit of work** — auto-deploy catches integration issues immediately; waiting to batch commits loses the safety net

## 8) Repository Evidence

- 575 tests across 58 test files (vitest), all passing
- GitHub commit history shows AI-first workflow with story-driven commits (`feat:`, `fix:`, `perf:`, `docs:` prefixes)
- LangSmith traces for AI endpoint calls (multi-provider comparison: Claude Sonnet vs Haiku vs GPT-4.1)
- Performance metrics validated via MetricsOverlay with PRD threshold indicators (✅/⚠️/🔴)
- A/B benchmark automation via GitHub Actions and Vercel serverless endpoint
