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
