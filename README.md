# CollabBoard

Real-time collaborative whiteboard with AI-powered board manipulation and litigation workflow tools. Built for Gauntlet G4 Week 1.

**Author:** Youssef | **Program:** Gauntlet G4 Week 1 | **Date:** February 2026

## Live Demo

| Resource | URL |
|---|---|
| Deployed App | [https://collab-board-iota.vercel.app](https://collab-board-iota.vercel.app) |
| Socket.IO Server | [https://collab-board-0948.onrender.com](https://collab-board-0948.onrender.com) |
| GitHub Repository | [https://github.com/thisisyoussef/collab-board](https://github.com/thisisyoussef/collab-board) |

## Key Metrics

| Metric | Value |
|---|---|
| Tests | 664 across 72 test files — all passing (vitest) |
| Cursor sync latency | <50ms (Socket.IO volatile broadcast) |
| Object sync latency | <100ms (Socket.IO reliable broadcast) |
| Canvas FPS | 60 FPS with 500+ objects (Konva ref-based rendering) |
| Concurrent users | 5+ without degradation |
| AI tool types | 9 via Claude function calling with multi-model routing |
| Infrastructure cost | $7 (Vercel + Firebase free tiers, Render paid tier for always-on Socket.IO) |

## Tech Stack

| Layer | Technology |
|---|---|
| Real-time sync | [Socket.IO](https://socket.io/) (WebSocket transport, self-hosted on Render) |
| Database | Firebase Firestore (one document per board, embedded objects) |
| Auth | Firebase Auth (Google Sign-In) |
| Frontend | Vite + React + react-konva (canvas rendering) |
| AI Agent | Multi-provider: Anthropic Claude + OpenAI (via Vercel serverless) |
| AI Observability | LangSmith tracing with provider/model metadata |
| Deployment | Vercel (frontend + API) + Render (Socket.IO server) |

## Features

- **Infinite canvas** with smooth pan/zoom (scale 0.1–5x)
- **Real-time collaboration** — cursors (<50ms), objects (<100ms), presence sync
- **Board objects** — sticky notes, rectangles, circles, lines, text, frames, connectors
- **Transforms** — move, resize, rotate objects with Transformer handles
- **Selection** — single click, shift-click multi-select, drag-to-select rubber band
- **Operations** — delete, duplicate, copy/paste
- **Conflict resolution** — last-write-wins with `updatedAt` timestamps (documented below)
- **Resilience** — graceful disconnect/reconnect with automatic state reconciliation from Firestore
- **Persistence** — board state survives all users leaving and returning
- **Authentication** — Google Sign-In via Firebase Auth
- **AI agent** — natural language commands across 4 command categories (creation, manipulation, layout, complex templates) with 9 tool types
- **Multi-model AI routing** — automatic complexity classification routes simple prompts to fast/cheap models (Haiku, gpt-4o-mini) and complex prompts to capable models (Sonnet, gpt-4.1)
- **Litigation workflow** — case intake dialog, claim-evidence graph with strength heatmap, contradiction radar, session replay
- **Share links** — UUID-based URLs for instant collaboration
- **Metrics overlay** — real-time FPS, latency, connection status with PRD threshold indicators

---

## Architecture

```
Client:     React + Konva (canvas) + Socket.IO client (sync) + Firebase SDK (auth/persistence)
Socket:     Render-hosted Node.js + Socket.IO (rooms, presence, cursor/object broadcast)
Serverless: Vercel /api/* (AI endpoints, benchmark, litigation tools — protects API keys)
```

### Two-Layer Sync

- **Socket.IO** = fast broadcast layer (cursors + object events, in-memory, <50ms target)
- **Firestore** = persistence layer (board state, debounced writes every 3s)

Socket.IO handles real-time; Firestore handles durability. UI never blocks on Firestore writes.

### Key Design Decision

Canvas state is managed via Konva refs (not React state) for 60 FPS performance with 500+ objects. React state is reserved for UI components (toolbar, panels, dialogs), presence lists, and board metadata. See [CLAUDE.md](CLAUDE.md) for the detailed performance pattern.

### Conflict Resolution

CollabBoard uses a **last-write-wins** strategy for concurrent edits. Every board object carries an `updatedAt` ISO timestamp set on each mutation. When two users modify the same object simultaneously:

1. Both local changes apply optimistically (instant feedback).
2. Socket.IO broadcasts each update to the room.
3. On receipt, the client compares timestamps — the newer `updatedAt` wins; the older update is discarded.
4. Firestore persistence uses the same rule during debounced writes.

This approach trades theoretical conflict accuracy for simplicity and latency — appropriate for a whiteboard where objects are spatially distributed and true conflicts are rare.

---

## Project Structure

```
src/
├── components/        # Canvas, Toolbar, AICommandCenter, MetricsOverlay,
│                      # RemoteCursors, ClaimStrengthPanel, ContradictionRadarPanel,
│                      # LitigationIntakeDialog, etc.
├── hooks/             # useSocket, usePresence, useCursors, useAICommandCenter,
│                      # useAIExecutor, useBoardHistory, useSessionReplay,
│                      # useClaimClassification, useContradictionRadar, etc.
├── lib/               # firebase.ts, socket.ts, utils.ts, color-utils.ts,
│                      # frame-grouping.ts, board-connector-helpers.ts
├── pages/             # Landing.tsx, Dashboard.tsx, Board.tsx
├── context/           # AuthContext.tsx
├── types/             # board.ts (object schema with litigation extensions)
└── main.tsx
api/
├── ai/
│   ├── generate.ts           # Main AI command generation (multi-provider routing)
│   ├── benchmark.ts          # A/B testing and performance benchmarking
│   ├── intake-to-board.ts    # Litigation case intake → board generation
│   ├── classify-claim.ts     # AI claim strength classification
│   ├── contradictions.ts     # AI contradiction detection
│   └── claim-strength-recommendations.ts  # Claim strengthening recommendations
└── cron/
    └── ai-usage.ts           # Background usage tracking
server/
├── index.js           # Socket.IO realtime backend (Render)
└── package.json
docs/
├── submission/        # Submission artifacts (cost analysis, dev log, etc.)
├── pre-search.md      # Architecture decisions
├── prd.md             # Product requirements
├── dev-guide.md       # Developer guide
├── testing-playbook.md
└── user-stories/      # Phase 1–4 user stories and checkpoint logs
```

### Routes

| Path | Page |
|---|---|
| `/` | Landing / login |
| `/dashboard` | Board list (user's boards) |
| `/board/:id` | Canvas editor (UUID-based, shareable) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project (Auth + Firestore enabled)
- Render account (for Socket.IO server)
- Anthropic API key (and optionally OpenAI API key for multi-provider mode)

### Setup

```bash
# Clone and install
git clone https://github.com/thisisyoussef/collab-board.git
cd collab-board
npm install

# Configure environment
cp .env.example .env
# Fill in your API keys in .env

# Start development server
npm run dev
```

### Firestore Rules (Required)

If dashboard loading shows `Permission denied`, publish the Firestore rules:

1. Open Firebase Console for project `collab-board-c15b8`.
2. Go to Firestore Database -> Rules.
3. Paste contents of `firestore.rules`.
4. Click **Publish**.

Optional CLI deploy:

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project collab-board-c15b8
```

### Environment Variables

See `.env.example` for the full list. Key variables:

```bash
# Client-side (VITE_ prefix = exposed to browser)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_SOCKET_SERVER_URL=xxx

# Server-side only (Vercel serverless functions)
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional
VITE_ENABLE_METRICS=true
```

### Commands

```bash
npm run dev          # Start dev server
npm run build        # TypeScript check + Vite build
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm test             # Run tests once (vitest)
npm run test:watch   # Watch mode tests
```

---

## AI Agent

### Tool Schema (9 tools)

| Tool | Parameters | Description |
|---|---|---|
| `createStickyNote` | `text, x, y, color?, width?, height?, nodeRole?` | Create sticky notes with optional litigation role |
| `createShape` | `type (rect\|circle\|line), x, y, width, height, color?` | Create geometric shapes |
| `createFrame` | `title, x, y, width, height` | Create grouping containers |
| `createConnector` | `fromId, toId, connectorType?, strokeStyle?, relationType?` | Connect objects with typed arrows |
| `moveObject` | `objectId, x, y` | Reposition objects |
| `resizeObject` | `objectId, width, height` | Resize objects |
| `updateText` | `objectId, newText` | Modify text content |
| `changeColor` | `objectId, color` | Change fill color |
| `getBoardState` | *(none)* | Read current board state |

### Command Categories

1. **Creation** — "Add a yellow sticky note that says 'User Research'"
2. **Manipulation** — "Change the sticky note color to green"
3. **Layout** — "Arrange these sticky notes in a grid"
4. **Complex / Template** — "Create a SWOT analysis template with four quadrants"

### Multi-Model Routing (Already Implemented)

The AI endpoint uses a multi-layer prompt complexity classifier that automatically routes requests to the most cost-effective model:

**Complexity classification pipeline:**
1. **Cache lookup** — pre-computed results for 32 known prompt patterns (fast path)
2. **Keyword matching** — triggers on template/layout keywords (swot, retrospective, grid, arrange, etc.)
3. **Pattern matching** — detects NxM grids, multi-step conjunctions, numbered stages
4. **Explicit simple detection** — single primitive + simple verb + short prompt = simple
5. **Default fallback** — conservative bias toward complex

**Model selection per provider:**

| Complexity | Anthropic | OpenAI |
|---|---|---|
| Simple (single-step) | `claude-3-5-haiku-latest` | `gpt-4o-mini` |
| Complex (multi-step/template) | `claude-sonnet-4-20250514` | `gpt-4.1` |

**Token budgets:** Simple prompts get 2,048 tokens; complex prompts get 4,096. Both are configurable via environment variables.

**Dual-provider fallback:** If the primary provider's API key is missing or returns an error (non-rate-limit), the endpoint automatically falls back to the other provider. Rate limit errors (429) are never retried via fallback — they return immediately.

### AI Observability

Optional LangSmith tracing for all AI calls:

1. Set `LANGCHAIN_TRACING_V2=true`
2. Set `LANGCHAIN_API_KEY=<your-langsmith-api-key>`
3. Set `LANGCHAIN_PROJECT=collab-board-dev`

Response headers expose routing decisions: `X-AI-Provider` and `X-AI-Model`.

### Multi-Provider Configuration

```bash
# Provider mode: anthropic (default), openai, or ab
AI_PROVIDER_MODE=anthropic

# Anthropic model routing (defaults shown)
ANTHROPIC_MODEL_SIMPLE=claude-3-5-haiku-latest
ANTHROPIC_MODEL_COMPLEX=claude-sonnet-4-20250514

# OpenAI model routing (defaults shown)
OPENAI_MODEL_SIMPLE=gpt-4o-mini
OPENAI_MODEL_COMPLEX=gpt-4.1

# Token budgets
AI_MAX_TOKENS_SIMPLE=2048
AI_MAX_TOKENS_COMPLEX=4096
```

---

## Litigation Workflow

CollabBoard extends the whiteboard with litigation-specific tools:

- **Case Intake Dialog** — structured form for case details, parties, claims, and document uploads; generates a pre-populated board layout
- **Claim-Evidence Graph** — board objects carry `nodeRole` (claim, evidence, witness, timeline_event, contradiction) and `relationType` (supports, contradicts, depends_on) metadata
- **Strength Heatmap** — AI-powered claim strength classification (weak/moderate/strong) with visual indicators and recommendations for strengthening weak claims
- **Contradiction Radar** — AI-detected contradictions between sources with confidence thresholds; accept/reject individual contradictions and apply to board
- **Session Replay** — time-machine playback of board editing sessions

### Litigation API Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/ai/generate` | Main AI command generation |
| `POST /api/ai/intake-to-board` | Case intake → board generation |
| `POST /api/ai/classify-claim` | Claim strength classification |
| `POST /api/ai/contradictions` | Contradiction detection |
| `POST /api/ai/claim-strength-recommendations` | Recommendations for weak claims |

---

## Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| Frame rate | 60 FPS | MetricsOverlay + requestAnimationFrame counter |
| Object sync latency | <100ms | Timestamp-based (`_ts` field on Socket.IO events) |
| Cursor sync latency | <50ms | Timestamp-based (volatile emit, 20-sample sliding window) |
| Object capacity | 500+ | Viewport culling + Konva batchDraw |
| Concurrent users | 5+ | Socket.IO room-based broadcast |
| AI single-step latency | <2s | Response time measurement |

The MetricsOverlay component displays real-time metrics in development (or when `VITE_ENABLE_METRICS=true`) with PRD threshold indicators (pass/warn/fail).

---

## Benchmark Infrastructure

### A/B Testing Endpoint

The `/api/ai/benchmark` endpoint runs multi-model benchmarks directly on Vercel compute:

```bash
curl -X POST "https://collab-board-iota.vercel.app/api/ai/benchmark" \
  -H "Content-Type: application/json" \
  -H "X-Benchmark-Secret: $BENCHMARK_RUN_SECRET" \
  -d '{
    "rounds": 4,
    "concurrency": 8,
    "autoCreateBoards": 6,
    "matrix": "anthropic:claude-sonnet-4-20250514,anthropic:claude-3-5-haiku-latest,openai:gpt-4.1-mini,openai:gpt-4.1,openai:gpt-4o-mini"
  }'
```

### GitHub Actions Automation

The workflow at `.github/workflows/ai-benchmark-on-deploy.yml` triggers benchmarks automatically after production deployment, uploading results to `docs/submission/ab-results/`.

Manual trigger: `npm run ab:deploy`

### Benchmark Results Summary

**High-volume production run** (240 requests, 8 prompts, 5 model configs):

| Provider:Model | Success % | Avg Latency (ms) | Avg Tool Calls |
|---|---:|---:|---:|
| `openai:gpt-4.1-mini` | 100 | 2,827 | 2.65 |
| `openai:gpt-4o-mini` | 100 | 3,346 | 2.52 |
| `openai:gpt-4.1` | 100 | 3,452 | 1.96 |
| `anthropic:claude-sonnet-4-20250514` | 100 | 4,933 | 2.88 |
| `anthropic:claude-3-5-haiku-latest` | 100 | 5,278 | 1.79 |

**Single-step latency focus** (30 rounds, "Create sticky note"):

| Provider:Model | Avg (ms) | P95 (ms) | Under 2s % | Accuracy |
|---|---:|---:|---:|---:|
| `openai:gpt-4.1` | 1,467 | 2,370 | 93.3% | 1.00 |
| `openai:gpt-4o-mini` | 1,519 | 1,786 | 96.7% | 1.00 |
| `openai:gpt-4.1-mini` | 1,589 | 2,638 | 86.7% | 1.00 |
| `anthropic:claude-sonnet-4-20250514` | 3,254 | 4,585 | 0.0% | 1.00 |
| `anthropic:claude-3-5-haiku-latest` | 3,519 | 4,742 | 0.0% | 1.00 |

**Complex prompt accuracy** (64 requests, SWOT + retro templates):

| Provider:Model | Avg Accuracy | Avg Latency (ms) |
|---|---:|---:|
| `openai:gpt-4.1-mini` | 0.70 | 2,719 |
| `anthropic:claude-3-5-haiku-latest` | 0.70 | 9,987 |
| `openai:gpt-4o-mini` | 0.60 | 3,720 |

---

## AI Cost Analysis

### Development Cost (Actual)

| Category | Value |
|---|---|
| Total API calls | ~350 (AI endpoint) + ~2,000 (coding agents) |
| Input tokens | ~8M (development) + ~1.2M (AI endpoint testing/benchmarks) |
| Output tokens | ~4M (development) + ~600K (AI endpoint testing/benchmarks) |
| Models used | Claude Sonnet 4, Claude 3.5 Haiku, OpenAI GPT-4.1 (A/B benchmarks) |
| Total AI endpoint spend | ~$5 (Anthropic API for board AI + benchmarks) |
| Infrastructure cost | $7 (Render paid tier for always-on Socket.IO server) |
| Other AI costs | $0 incremental — Claude Code (Claude Max plan), Codex (Codex Plus plan), and Cursor covered by existing subscriptions |

### Production Projection Assumptions

| Assumption | Value |
|---|---|
| Avg AI commands per active user per session | 5 |
| Avg sessions per user per month | 10 |
| Avg input tokens per command | 2,000 |
| Avg output tokens per command | 1,500 |

### Monthly Cost Projections

These projections account for the **model routing already in production**: simple prompts route to cheaper models (Haiku at $0.80/$4.00 per 1M tokens, or gpt-4o-mini at $0.15/$0.60 per 1M tokens), and complex prompts route to capable models (Sonnet at $3/$15 per 1M tokens, or gpt-4.1 at $2/$8 per 1M tokens).

Based on benchmark data, approximately 60% of user commands are simple (single-step creation/manipulation) and 40% are complex (templates, layout, multi-step).

**With current routing (Anthropic mode, Haiku + Sonnet blend):**

| User Scale | Commands/mo | Simple (60%) | Complex (40%) | Estimated Monthly Cost |
|---|---:|---:|---:|---:|
| 100 users | 5,000 | 3,000 | 2,000 | **~$72** |
| 1,000 users | 50,000 | 30,000 | 20,000 | **~$720** |
| 10,000 users | 500,000 | 300,000 | 200,000 | **~$7,200** |
| 100,000 users | 5,000,000 | 3,000,000 | 2,000,000 | **~$72,000** |

*Calculation: Simple commands use Haiku ($0.80/$4.00 per 1M tokens) × 2K input + 1K output per command. Complex commands use Sonnet ($3/$15 per 1M tokens) × 2K input + 1.5K output per command. Simple output is lower due to `AI_MAX_TOKENS_SIMPLE` constraint.*

**With OpenAI routing (gpt-4o-mini + gpt-4.1 blend):**

| User Scale | Commands/mo | Estimated Monthly Cost |
|---|---:|---:|
| 100 users | 5,000 | **~$20** |
| 1,000 users | 50,000 | **~$200** |
| 10,000 users | 500,000 | **~$2,000** |
| 100,000 users | 5,000,000 | **~$20,000** |

*OpenAI pricing is substantially lower for both simple and complex tiers; benchmark data shows comparable accuracy.*

### Sensitivity Notes

- **Output tokens drive cost** — at $15/1M (Sonnet) they account for ~79% of complex-command cost. The `AI_MAX_TOKENS_SIMPLE` cap (default 2,048) already constrains simple commands.
- **Worst-case scenario:** Power users at 20 commands/session × 20 sessions/month = 400 commands/user/month. At 100K users on Sonnet-only (no routing) this would be ~$570K/mo — mitigated by the routing already in place plus rate limiting (5 req/min/user).
- **Additional cost levers:**
  1. **Prompt caching** — Anthropic prompt caching reduces input token costs by 90% for repeated system prompts; estimated 30–40% input savings.
  2. **Response trimming** — reduce `AI_MAX_TOKENS_COMPLEX` from 4,096 to 2,048 for commands that don't need it.
  3. **Provider switching** — the A/B infrastructure makes it trivial to shift traffic to the most cost-effective provider as pricing changes.

### Scenario Comparison

| Scenario | 1K Users | 10K Users | 100K Users |
|---|---:|---:|---:|
| **Current (Anthropic routing, Haiku + Sonnet)** | $720 | $7,200 | $72,000 |
| **OpenAI routing (gpt-4o-mini + gpt-4.1)** | $200 | $2,000 | $20,000 |
| **Worst-case (Sonnet-only, power users, no routing)** | $5,700 | $57,000 | $570,000 |

---

## AI Development Log

### Tools and Workflow

- **Primary agents:** Claude Code via Claude Max plan (planning, TDD, multi-file implementation), Codex via Codex Plus plan (parallel story execution), Cursor (interactive editing, UI iteration)
- **Orchestration:** Multi-agent dispatch — independent user stories assigned to separate agents working in parallel, coordinated via git branches and a shared CLAUDE.md specification
- **Workflow:**
  1. Author CLAUDE.md with architecture rules, code patterns, performance targets, and anti-patterns
  2. Write user stories with acceptance criteria and PRD gap mappings
  3. TDD: write failing tests first, implement minimum code to pass, refactor with green suite
  4. Validate locally (`npm run lint && npm test && npm run build`), then smoke-test production deploy
  5. Commit immediately after each meaningful work unit (auto-deploy via Vercel on push)

### CLAUDE.md as Project-Level System Prompt

The CLAUDE.md file (~800 lines) was the most critical prompting artifact — a persistent system prompt that every agent read at session start, ensuring consistency across agents, sessions, and context window resets. Key sections:

- **Critical Performance Pattern:** Explicit "BAD vs GOOD" code examples showing why React state kills canvas performance and how to use Konva refs instead
- **Board Object Schema:** Exact schema for all object types, ensuring agents generated compatible data structures without coordination
- **Socket.IO Sync Patterns:** Two-layer architecture (Socket.IO for speed, Firestore for durability), volatile vs reliable emit, cursor throttling at 50ms
- **AI Tool Schema:** 9 tool definitions with exact parameter signatures matching the serverless function API contract
- **Anti-Patterns:** Explicit "DO NOT" rules that prevented common mistakes across all agents
- **Build Priority:** Strict numbered order (1–11) ensuring infrastructure was validated before features

### MCP Usage

- **MCPs used:** Desktop Commander (file system + process management), Claude in Chrome (browser automation for deployed testing), Firecrawl (documentation scraping for Socket.IO/Konva/Firebase APIs), Control Chrome (tab management), Context7 (library documentation lookup)
- **What MCPs enabled:** Automated file scaffolding and multi-file edits across 50+ source files; browser-based smoke testing of deployed Vercel URLs; real-time documentation fetching during implementation
- **Limitations:** Desktop Commander's file write limits required chunked writes for large files; browser automation couldn't interact with Konva canvas elements (no DOM nodes) — fell back to manual QA; Firecrawl hit rate limits on rapid lookups

### Effective Prompts

1. **TDD story scaffold:** "Implement US2-03 (AI board agent) using TDD. Write failing tests first for all 9 tool call types, then implement the minimum code to pass each test. Use the Vercel serverless pattern from CLAUDE.md."
   *Referenced CLAUDE.md patterns directly, specified test-first order, named exact scope.*

2. **Performance architecture:** "Add viewport culling to the canvas. Create a pure function getVisibleObjects that takes objects, stage position, scale, and viewport size, filters by AABB intersection, and returns only visible objects. Write tests first covering inside, outside, partial overlap, and edge cases."
   *Specified function signature, algorithm, and test cases upfront — left no ambiguity.*

3. **Multi-agent coordination:** "I have 5 independent user stories (US3-01 through US3-05) that can be worked on in parallel. Each has its own acceptance criteria and test files. Dispatch them to separate agents, each working in its own git worktree to avoid merge conflicts."
   *Explicitly addressed the coordination problem (merge conflicts) and the solution (git worktrees).*

4. **Socket.IO latency validation:** "Set up a Socket.IO echo test that measures round-trip latency across 100 iterations. The cursor target is <50ms and object sync target is <100ms. Emit timestamped events and compute average/p95/max on the client side."
   *Quantified targets from CLAUDE.md performance gates, specified measurement method and output destination.*

5. **Anti-pattern enforcement via CLAUDE.md:** Including explicit "BAD" and "GOOD" code examples (e.g., `useState({})` marked BAD vs `stageRef.current.findOne()` marked GOOD) prevented performance regressions across all agents — more effective than describing the rule in prose.

### Code Analysis (AI vs Hand-Written)

- **AI-generated: 100%** — All code produced by AI agents (Claude Code via Claude Max plan, Codex via Codex Plus plan, and Cursor)
- **Human contribution:** Prompt engineering, CLAUDE.md authoring, acceptance criteria, architecture decisions, environment configuration, deployment debugging, and code review/approval
- **Methodology:** All source code was generated by AI coding agents working from user stories and acceptance criteria; human role was directing agents, reviewing outputs, and making architectural decisions

### Strengths and Limitations

**Strengths:**
- CLAUDE.md as persistent project memory eliminated re-explanation across agent sessions
- TDD-first workflow caught integration issues early (664 tests across 72 files)
- Multi-agent parallelism compressed a week of work into days
- Explicit anti-patterns in CLAUDE.md prevented the most common performance and architecture mistakes

**Limitations:**
- Agents on wrong branches required manual git operations to recover
- Cross-agent merge conflicts needed human judgment to resolve
- Canvas (Konva) interactions couldn't be automated — required manual QA
- Context window limits required session compaction and summary-based continuity

### Key Learnings

- **CLAUDE.md is the highest-ROI artifact** in an AI-first project — invest heavily in it upfront
- **Anti-patterns > rules:** Showing agents what NOT to do (with code examples) is more effective than describing the correct approach in prose
- **TDD + story gates** improve reliability under time pressure — agents can't "skip ahead" when tests must pass first
- **Commit after every unit of work** — auto-deploy catches integration issues immediately; waiting to batch commits loses the safety net

---

## Submission Deliverables

| # | Deliverable | Location | Status |
|---|---|---|---|
| 1 | Deployed application (public) | [collab-board-iota.vercel.app](https://collab-board-iota.vercel.app) | Complete |
| 2 | GitHub repository with setup guide | This README | Complete |
| 3 | Pre-Search document | [docs/pre-search.md](docs/pre-search.md) | Complete |
| 4 | AI Development Log | [AI Development Log](#ai-development-log) (above) | Complete |
| 5 | AI Cost Analysis | [AI Cost Analysis](#ai-cost-analysis) (above) | Complete |
| 6 | Demo video (3–5 min) | Uploaaded | Complete |
| 7 | Social post (X or LinkedIn, tag @GauntletAI) | Posted | Complete |

---

## Documentation

- [Pre-Search Decisions](docs/pre-search.md)
- [Product Requirements](docs/prd.md)
- [Developer Guide](docs/dev-guide.md)
- [Testing Playbook](docs/testing-playbook.md)
- [MCP Setup Guide](docs/mcp-setup.md)
- [User Stories](docs/user-stories/)
