# CollabBoard

Real-time collaborative whiteboard with AI-powered board manipulation. Built for Gauntlet G4 Week 1.

## Live Demo

> **Deployed URL:** _Coming soon_

## Tech Stack

| Layer          | Technology                                    |
| -------------- | --------------------------------------------- |
| Real-time sync | [Socket.IO](https://socket.io/) (WebSocket transport) |
| Database       | Firebase Firestore                            |
| Auth           | Firebase Auth (Google Sign-In)                |
| Frontend       | Vite + React + react-konva                    |
| AI Agent       | Anthropic Claude (via Vercel serverless)      |
| Deployment     | Vercel (frontend + API) + Render (Socket.IO server) |

## Features

- **Infinite canvas** with smooth pan/zoom
- **Real-time collaboration** — cursors, objects, presence sync across users
- **Board objects** — sticky notes, shapes, frames, connectors, text
- **AI agent** — natural language commands to create and manipulate board elements
- **Share links** — UUID-based URLs for instant collaboration

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project (Auth + Firestore enabled)
- Render account (for Socket.IO server)
- Anthropic API key

### Setup

```bash
# Clone and install
git clone <repo-url>
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

See `.env.example` for required variables.

### Optional: LangSmith Tracing (AI Observability)

To trace `/api/ai/generate` requests and Anthropic planning calls in LangSmith:

1. Set `LANGCHAIN_TRACING_V2=true`
2. Set `LANGCHAIN_API_KEY=<your-langsmith-api-key>`
3. Set `LANGCHAIN_PROJECT=collab-board-dev` (or your environment-specific project name)

Tracing is server-side only and should be configured in Vercel environment variables for production.

### Optional: Multi-Provider AI Routing (Anthropic + OpenAI)

You can run the AI endpoint with Anthropic only, OpenAI only, or deterministic A/B routing:

1. Set `AI_PROVIDER_MODE=anthropic` (default), `openai`, or `ab`.
2. If using OpenAI or A/B, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
3. If using A/B, set `AI_OPENAI_PERCENT` (0-100) to control OpenAI traffic split.
4. For scripted benchmark runs that force provider/model per request, set `AI_ALLOW_EXPERIMENT_OVERRIDES=true`.

Recommended for observability:
- Keep LangSmith tracing enabled.
- Filter traces by metadata tag `provider` to compare quality, latency, and tool-call reliability between providers.

### Deploy-Time Benchmark Automation (High-Volume LangSmith Traces)

This repo includes an automated benchmark workflow that runs after production deployment and generates many traces across provider/model combinations.

1. Enable request-level benchmark overrides in Vercel:
`AI_ALLOW_EXPERIMENT_OVERRIDES=true`
2. Keep LangSmith enabled in Vercel:
`LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_API_KEY=...`, `LANGCHAIN_PROJECT=...`
3. Configure GitHub secrets for benchmark auth:
`AI_AUTH_TOKEN` OR `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_WEB_API_KEY`, `BENCHMARK_USER_ID`
4. Optional GitHub repository variables:
`AB_MODEL_MATRIX`, `AB_ROUNDS`, `AB_AUTO_CREATE_BOARDS`, `AB_CONCURRENCY`, `AB_MAX_REQUESTS`, `AB_DEPLOY_BASE_URL`

Workflow file:
`/Users/youss/Development/gauntlet/collab-board/.github/workflows/ai-benchmark-on-deploy.yml`

Local/manual run:

```bash
npm run ab:deploy
```

## Architecture

```
Client: React + Konva (canvas) + Socket.IO client (sync) + Firebase SDK (auth/db)
Realtime Server: Render-hosted Node + Socket.IO
Serverless: Vercel /api/ai/generate (Claude API, protects API key)
```

**Key design decision:** Canvas state managed via Konva refs (not React state) for 60 FPS performance with 500+ objects.

## Project Structure

```
src/
├── components/   # UI components (Canvas, Toolbar, etc.)
├── hooks/        # Custom hooks (useSocketRealtime, useFirestore, useCanvas)
├── lib/          # Service clients (socket.ts, firebase.ts, utils.ts)
├── pages/        # Route pages (Landing, Dashboard, Board)
└── main.tsx
api/
└── ai/generate.ts  # Vercel serverless function for Claude AI
server/
├── index.js        # Socket.IO realtime backend entrypoint (Render)
└── package.json
docs/
├── pre-search.md   # Architecture decisions
├── prd.md          # Product requirements
└── mcp-setup.md    # MCP configuration guide
```

## Performance Targets

| Metric              | Target |
| ------------------- | ------ |
| Frame rate          | 60 FPS |
| Object sync latency | <100ms |
| Cursor sync latency | <50ms  |
| Object capacity     | 500+   |
| Concurrent users    | 5+     |

## Documentation

- [Pre-Search Decisions](docs/pre-search.md)
- [Product Requirements](docs/prd.md)
- [MCP Setup Guide](docs/mcp-setup.md)
- [Developer Guide](docs/dev-guide.md)
- [Testing Playbook](docs/testing-playbook.md)
