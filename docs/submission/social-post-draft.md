# Social Post Drafts

Include final screenshots/GIFs/video and tag `@GauntletAI`.

## X Draft

Built **CollabBoard** in one week: a real-time collaborative whiteboard with an AI board agent.

What it does:
- Multiplayer cursors + presence + realtime object sync (<50ms cursors, <100ms objects)
- Sticky notes, shapes, text, frames, connectors
- AI commands: "Create a SWOT analysis" → full template generated on canvas
- 529 tests, 60 FPS with 500+ objects

The secret weapon? An 800-line CLAUDE.md that acted as a persistent system prompt across multiple AI agents (Claude Code, Codex, Cursor) working in parallel.

Stack: React + Konva, Socket.IO, Firebase, Vercel, Anthropic Claude

Demo: https://collab-board-iota.vercel.app
Repo: https://github.com/thisisyoussef/collab-board

@GauntletAI #BuildInPublic #AIEngineering #Realtime

## LinkedIn Draft

Just shipped **CollabBoard** — a real-time collaborative whiteboard with an AI command center, built in one week for @GauntletAI.

**What makes it interesting from an AI engineering perspective:**

The entire project was built using a multi-agent AI workflow. Three AI agents (Claude Code, Codex, Cursor) worked in parallel on independent user stories, coordinated through git worktrees. The key insight: an 800-line CLAUDE.md file acted as a persistent "project constitution" — architecture rules, performance patterns, anti-patterns with BAD/GOOD code examples, and exact API contracts. Every agent read it at session start, ensuring consistency without human re-explanation.

**Technical highlights:**
- Real-time collaboration: presence, live cursors (<50ms), instant object sync (<100ms) via Socket.IO
- Canvas performance: 60 FPS with 500+ objects using Konva ref-based rendering (not React state)
- AI board agent: 9 tool types via Claude function calling, natural language → board manipulation
- A/B benchmarking: automated multi-provider testing (Claude vs GPT-4) with LangSmith observability
- 529 tests across 52 files, TDD-first development

**Stack:** React + Konva, Socket.IO (Render), Firebase Auth + Firestore, Vercel serverless, Anthropic Claude

Demo: https://collab-board-iota.vercel.app
Repository: https://github.com/thisisyoussef/collab-board

#AIEngineering #BuildInPublic #Realtime #WebDev
