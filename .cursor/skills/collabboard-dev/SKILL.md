---
name: collabboard-dev
description: Guide CollabBoard development following the PRD priorities, MVP checklist, and AI-first methodology. Use when building board features, real-time sync, AI agent commands, or checking progress against deadlines and acceptance criteria.
---

# CollabBoard Development

## Project Context

Real-time collaborative whiteboard (Miro-like) with AI agent. One-week sprint, hard gates.

## Tech Stack (from Pre-Search)

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Real-time sync | Ably (managed WebSocket, <50ms cursors) |
| Database       | Firebase Firestore (one doc per board)  |
| Auth           | Firebase Auth (Google Sign-In only)     |
| Frontend       | Vite + React + react-konva              |
| AI             | Anthropic Claude (Vercel serverless)    |
| Deployment     | Vercel (static + `/api` functions)      |

## Critical Design Decision

**Separate Konva state from React state.** Use refs for canvas updates to achieve 60 FPS with 500+ objects. React only for UI components (toolbar, panels, dialogs).

## Deadlines

| Checkpoint       | Deadline           | Focus                        |
| ---------------- | ------------------ | ---------------------------- |
| Pre-Search       | Monday (hour 1)    | Architecture decisions       |
| MVP              | Tuesday (24 hours) | Collaborative infrastructure |
| Early Submission | Friday (4 days)    | Full feature set             |
| Final            | Sunday (7 days)    | Polish, docs, deployment     |

## Build Priority (strict order)

1. **Validate Ably latency** (hours 1-4) — echo test, measure <50ms cursors, <100ms objects
2. **Cursor sync** — two cursors moving across browsers
3. **Object sync** — sticky notes appear for all users
4. **Canvas pan/zoom** — infinite board, smooth navigation
5. **Object manipulation** — create, move, edit, shapes
6. **Conflict handling** — last-write-wins with timestamps
7. **State persistence** — Firestore, survive refresh/reconnect
8. **Auth + deploy** — Firebase Auth, Vercel, publicly accessible
9. **Board features** — shapes, frames, connectors, transforms, selection
10. **AI commands basic** — single-step creation/manipulation via Claude
11. **AI commands complex** — SWOT template, retro board, multi-step

**Finish one layer before starting the next.**

## MVP Checklist (24-hour hard gate)

- [ ] Infinite board with pan/zoom
- [ ] Sticky notes with editable text
- [ ] At least one shape type
- [ ] Create, move, and edit objects
- [ ] Real-time sync between 2+ users
- [ ] Multiplayer cursors with name labels
- [ ] Presence awareness
- [ ] User authentication (Google Sign-In)
- [ ] Deployed and publicly accessible

## AI Agent (6+ command types)

Tools: `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `moveObject`, `resizeObject`, `updateText`, `changeColor`, `getBoardState`

Commands across: Creation, Manipulation, Layout, Complex/Template.

## Performance Targets

| Metric              | Target     |
| ------------------- | ---------- |
| Frame rate          | 60 FPS     |
| Object sync latency | <100ms     |
| Cursor sync latency | <50ms      |
| Object capacity     | 500+       |
| Concurrent users    | 5+         |
| AI response         | <2 seconds |

## Submission Deliverables

- [ ] GitHub repo (setup guide, architecture, deployed link)
- [ ] Demo video (3-5 min)
- [ ] Pre-Search document
- [ ] AI Development Log (1 page)
- [ ] AI Cost Analysis (dev spend + projections 100/1K/10K/100K users)
- [ ] Deployed application (5+ users, auth)
- [ ] Social post on X or LinkedIn, tag @GauntletAI

## Testing (metrics-first)

Focus on proving performance, not unit test coverage:

1. Latency validation (100 round-trip Ably messages)
2. FPS monitoring (stats.js overlay)
3. 5-tab concurrent user test
4. 500-object stress test
5. Disconnect/reconnect resilience
