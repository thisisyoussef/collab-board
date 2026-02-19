# Testing Playbook

This playbook documents current test patterns used in this repository.

## Commands

```bash
# Full suite
npm run test

# Watch mode
npm run test:watch

# Single file
npx vitest run src/hooks/useBoards.test.tsx

# Filter by test name
npx vitest run -t "useBoards"
```

## Test Layout

- Frontend tests live next to source files as `*.test.ts` or `*.test.tsx`.
- Server helper tests live under `/Users/youss/Development/gauntlet/collab-board/server/`.
- Shared test setup is `/Users/youss/Development/gauntlet/collab-board/src/test/setup.ts`.

## Mocking Patterns In Use

- Router:
Mock `useNavigate` for navigation assertions in page/component tests.
- Firebase/Firestore:
Mock `firebase/firestore/lite` and `src/lib/firebase` imports at module boundary.
- Socket:
Use socket-like test doubles (`on`, `off`, `emit`, `trigger`) for hook tests.
- Konva:
Prefer lightweight `react-konva` mocks for DOM-oriented tests.

## Suggested Coverage Priorities

- Hooks with side effects (`useBoards`, realtime hooks, auth hooks).
- Error and rollback behavior for optimistic updates.
- Route guards and auth transitions.
- Server payload shaping/normalization helpers.

## Fast Sanity Checklist Before Push

- New logic has at least one success-path test.
- Error path is tested for any catch branch.
- Optimistic update code has rollback coverage.
- Test names describe behavior, not implementation details.

## Phase III Validation Protocol

Use this when running final PRD checks and submission verification.

### 1) Local Gate

```bash
npm run lint
npm run test
npm run build
```

Record results in `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/phase3-checkpoint-log.md`.

### 2) AI Command Validation

Use this template:

- `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/templates/ai-command-validation-matrix.md`

Minimum expected coverage:

1. Creation commands
2. Manipulation commands
3. Layout commands
4. Complex multi-step template commands
5. Multiplayer AI convergence behavior

### 3) Performance Validation

Use this template:

- `/Users/youss/Development/gauntlet/collab-board/docs/user-stories/phase3/templates/performance-evidence-template.md`

PRD thresholds to verify:

1. Cursor sync latency <50ms average
2. Object sync latency <100ms average
3. 60 FPS during active manipulation
4. 500+ objects without major degradation
5. 5+ concurrent users without major degradation

### 4) WebSocket Smoke Checks (Production)

1. Verify socket health endpoint:

```bash
curl -i https://collab-board-0948.onrender.com/health
```

2. Verify frontend points to intended socket URL:

```bash
cat /Users/youss/Development/gauntlet/collab-board/.env | rg '^VITE_SOCKET_URL='
```

3. Run two-browser session and confirm:

- presence snapshot received
- cursor events stream
- object create/update/delete sync
- reconnect path recovers after brief network drop

### 5) Final Evidence Pack

Before signoff, ensure these files are populated:

1. `/Users/youss/Development/gauntlet/collab-board/docs/submission/README.md`
2. `/Users/youss/Development/gauntlet/collab-board/docs/submission/ai-development-log.md`
3. `/Users/youss/Development/gauntlet/collab-board/docs/submission/ai-cost-analysis.md`
4. `/Users/youss/Development/gauntlet/collab-board/docs/submission/demo-video-notes.md`
5. `/Users/youss/Development/gauntlet/collab-board/docs/submission/social-post-draft.md`

## AI A/B Benchmark Script

Use this to generate reproducible Anthropic vs OpenAI benchmark evidence.

### Inputs Required

1. Auth for benchmark calls:
`AI_AUTH_TOKEN`, or Firebase service-account values + `FIREBASE_WEB_API_KEY` + `BENCHMARK_USER_ID`.
2. Board scope:
`AB_BOARD_IDS=id1,id2,...` or auto-create boards with `AB_AUTO_CREATE_BOARDS`.
3. Benchmark matrix and volume:
`AB_MODEL_MATRIX`, `AB_ROUNDS`, `AB_CONCURRENCY`.
4. Deployed API must allow request overrides:
`AI_ALLOW_EXPERIMENT_OVERRIDES=true` in Vercel env.

### Run Command

```bash
npm run ab:run
```

Optional flags:

```bash
npm run ab:deploy -- \
  --base-url https://collab-board-iota.vercel.app \
  --wait-ready \
  --prompt-suite scripts/ab-prompt-suite.json \
  --matrix anthropic:claude-sonnet-4-20250514,openai:gpt-4.1-mini,openai:gpt-4.1 \
  --rounds 4 \
  --concurrency 8 \
  --auto-create-boards 6 \
  --delay-ms 0 \
  --timeout-ms 45000 \
  --max-requests 0
```

Deploy automation workflow:

- `/Users/youss/Development/gauntlet/collab-board/.github/workflows/ai-benchmark-on-deploy.yml`
- Triggered on successful production deployment status (and manually via workflow dispatch).

### Outputs

- JSON report: `/Users/youss/Development/gauntlet/collab-board/docs/submission/ab-results/ab-report-<timestamp>.json`
- Markdown report: `/Users/youss/Development/gauntlet/collab-board/docs/submission/ab-results/ab-report-<timestamp>.md`

Captured stats include:

1. `X-AI-Provider` selected provider.
2. Request latency.
3. HTTP status + error.
4. Tool-call count + stop reason.
5. Provider-level and prompt-level success/latency aggregates.
