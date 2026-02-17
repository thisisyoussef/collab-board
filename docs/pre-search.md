# CollabBoard Pre-Search Document

**Youssef - Gauntlet G4 Week 1**
**Project:** Real-Time Collaborative Whiteboard with AI Agent
**Date:** February 16, 2026

---

## Executive Summary

This pre-search document outlines architectural decisions for building CollabBoard, a production-scale collaborative
whiteboard with AI agent integration. The project emphasizes AI-first development methodology using coding agents, MCPs, and
structured AI workflows.
**Timeline:** 1-week sprint (24-hour MVP, 7-day final submission)
**Hard Requirements:** <100ms object sync, <50ms cursor sync, 5+ concurrent users, 500+ objects capacity

---

## Phase 1: Define Your Constraints

### 1. Scale & Load Profile

**Users at launch:** 30-50 (cohort members + graders)
**In 6 months:** N/A (showcase project, not production SaaS)
**Traffic pattern:** Spiky (demo sessions, grading periods)
**Real-time requirements:** YES - WebSockets mandatory
**Cold start tolerance:** Low - must feel instant for demos
**Reasoning:** This is a graded showcase project optimized for demonstration, not a production system requiring massive
scale. Design decisions prioritize reliable performance for small concurrent groups over horizontal scalability.

---

### 2. Budget & Cost Ceiling

**Monthly spend limit:** $0-7 (free tiers + Render free instance)
**Pay-per-use acceptable:** Yes, but staying within free tier limits where possible
**Trade money for time:** Using managed services (Firebase, Vercel, Render) instead of fully custom infrastructure
**Cost Strategy:**

- Socket.io server on Render: Free tier (spins down after inactivity, ~30s cold start)
- Firebase: Free tier (generous for showcase usage)
- Vercel: Free tier (100GB bandwidth, serverless functions)
- Anthropic Claude: Pay-per-use (~$5 total for development + demos)
  **Total projected cost:** $0-7 for entire project lifecycle

---

### 3. Time to Ship

**MVP timeline:** 24 hours (Tuesday 2 PM deadline)
**Final timeline:** 7 days (Sunday deadline)
**Priority:** Speed-to-market (must pass grading requirements)
**Iteration cadence:** No post-launch iterations needed (one-time showcase)
**Timeline breakdown:**

- Architecture/setup: 10-14 hours
- Core features: 40-50 hours
- Polish/testing: 10-15 hours
- Documentation: 5-10 hours

---

### 4. Compliance & Regulatory Needs

**HIPAA:** Not needed (no healthcare data)
**GDPR:** Covered by vendors (Firebase SOC 2 Type II certified)
**SOC 2:** All vendors already certified
**Data residency:** US by default, acceptable for showcase
**Documentation requirement:** "All services SOC 2 Type II certified. Data retention 30 days for demo purposes."
**Security approach:** Educational exemption applies, but implementing production-ready security patterns (auth, input
validation, TLS encryption) to demonstrate best practices.

---

### 5. Team & Skill Constraints

**Team size:** Solo developer
**Strong skills:** React, product thinking, full-stack app development (asmbl.app, Tamkin)
**Moderate skills:** Firebase, deployment (Railway/Vercel), AI integration
**New areas:** Real-time WebSocket sync, canvas manipulation (Konva.js)
**Development approach:** AI-assisted workflow (Cursor, Claude Code)
**Strengths:** Shipping fast, making product decisions, entrepreneurial mindset
**Learning preference:** Ship fast, iterate based on feedback
**Biggest risk:** Getting stuck on real-time sync edge cases → mitigated by using Socket.io (well-documented, massive community)

---

## Phase 2: Architecture Discovery

### 6. Hosting & Deployment

**Platform:** Vercel (frontend + AI serverless) + Render (Socket.io WebSocket server)
**Architecture:** Split deployment — static frontend on Vercel, persistent WebSocket server on Render
**CI/CD:** Vercel auto-deploy for frontend (Git push), Render auto-deploy for Socket.io server

**Deployment strategy:**

- Frontend: Vercel edge network (static React build, global CDN)
- AI serverless functions: Vercel /api folder
- WebSocket server: Render free tier (Node.js + Socket.io, persistent process)
- Database: Firebase Firestore (client-side SDK)

**Why Vercel + Render over alternatives:**

- Vercel: $0 cost for frontend, edge CDN, instant deploys
- Render: Free tier for web services, supports persistent WebSocket connections
- Combined: Full-stack deployment at $0 cost
- Socket.io requires a persistent server process (Vercel serverless can't hold WebSocket connections)

**Why NOT Vercel-only:**

- Vercel serverless functions are stateless — they can't maintain persistent WebSocket connections
- Socket.io needs a long-running process to manage rooms, presence, and message routing
- Render free tier provides this at $0

**Render free tier considerations:**

- Spins down after 15 min of inactivity (~30s cold start on reconnect)
- Acceptable for showcase (users reconnect automatically)
- Upgrade to $7/month Starter plan if cold starts are a problem during demo

**Time investment:** 30 minutes initial setup, automatic deployments thereafter

---

### 7. Authentication & Authorization

**Auth method:** Google Sign-In only (Firebase Auth)
**Access model:** Share link = edit access (UUID-based board URLs)
**Permissions:** Anyone with link can edit (no roles/granular permissions)
**Presence:** Socket.io rooms + custom presence tracking (show active users + cursor labels)
**Privacy:** Private boards by default, no public gallery
**Reasoning:**

- Google Sign-In: Zero friction for collaborators (one-click access)
- Share links: Common pattern (Figma, Miro, Excalidraw use this)
- No role management: Saves 3-5 hours of complexity, not needed for showcase
- UUID security: 128-bit entropy = impossible to brute force

**User flow:**

1. User A creates board → Gets URL: yourapp.com/board/uuid123
2. User A shares link with Users B & C
3. Users B & C click link → Sign in with Google → Instant edit access
4. All users see each other's cursors, changes sync <100ms

**Time investment:** 4-5 hours total (auth + share links + presence)

**Security:**

- Firebase Auth handles OAuth flow
- Firestore security rules require authentication
- Board IDs are unguessable UUIDs
- Socket.io server validates Firebase auth tokens on connection

---

### 8. Database & Data Layer

**Database:** Firebase Firestore
**Structure:** One document per board with embedded objects
**Caching:** No Redis needed (Socket.io in-memory + Firestore client cache)
**Write strategy:** Debounce writes to Firestore (every 2-5 seconds), Socket.io handles real-time broadcasts
**Data model:**

```javascript
boards / uuid123: {
  ownerId: "userxyz",
  title: "My Board",
  createdAt: timestamp,
  lastModified: timestamp,
  objects: {
    obj_1: { type: "rect", x: 100, y: 200, width: 50, height: 50, color: "#FF0000" },
    obj_2: { type: "circle", x: 300, y: 150, radius: 30, color: "#00FF00" },
    // ... up to 500 objects
  },
};
```

**Why Firestore:**

- Real-time listeners (auto-sync to clients when data changes)
- Works seamlessly with Firebase Auth (same ecosystem)
- Built-in offline support
- Scales automatically
- Firestore doc limit: 1MB (500 objects = ~200-300KB, plenty of room)

**Why NOT PostgreSQL/MongoDB:**

- No complex queries/joins needed
- No ACID transactions across tables
- Firestore real-time listeners eliminate need for custom sync logic

**Read/write optimization:**

- Reads: 1 on board join (cached locally by Firestore SDK)
- Writes: Debounced to 1 write/2-5 seconds (not 100/sec to DB)
- Socket.io handles real-time broadcast (in-memory, not hitting DB)

**Cost with debouncing:**

- Without: 6,000 writes/min × $0.18/100K = expensive
- With: 20 writes/min × $0.18/100K = pennies

**Meets <100ms requirement:** Yes

- Socket.io broadcast: 20-80ms (same-region clients)
- Firestore write (debounced): Doesn't block UI
- Firestore read (on join): 100-200ms (one-time, acceptable)

**Time investment:** 1-2 hours (Firestore rules + data model setup)

---

### 9. Backend/API Architecture

**Backend:** Render (Socket.io server for real-time) + Vercel serverless (AI only)
**Socket.io server:** Handles cursor sync, object sync, presence, room management
**AI calls:** Vercel serverless function in /api/ai/generate (protects API key)
**Client-side:** Canvas rendering, Socket.io client, Firestore SDK, Firebase Auth

**Architecture:**

```
Client-side:
  - Canvas rendering (React + Konva)
  - Socket.io client (real-time sync)
  - Firebase Auth (authentication)
  - Firestore SDK (database reads/writes)

Render (persistent server):
  - Socket.io server
  - Room management (board:${boardId})
  - Cursor broadcasting
  - Object sync broadcasting
  - Presence tracking (who's online)

Vercel serverless (/api folder):
  - AI generation only (protects Anthropic API key)
```

**Why Socket.io over Pusher:**

- **No vendor lock-in** — open source, self-hosted
- **Full control** — custom room logic, presence, message routing
- **No message limits** — Socket.io avoids managed message-tier caps
- **Better for portfolio** — demonstrates real backend engineering
- **Well-documented** — massive community, countless tutorials
- **$0 cost** — Render free tier vs managed realtime plan cliffs

**What the Socket.io server handles:**

- `cursor:move` — broadcast cursor positions to room (skip sender)
- `object:create` / `object:update` / `object:delete` — broadcast object changes
- `join-board` / `leave-board` — room management
- Presence tracking — who's online per board

**Socket.io server example:**

```javascript
import { Server } from "socket.io";
import http from "http";

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  socket.on("join-board", ({ boardId, user }) => {
    socket.join(`board:${boardId}`);
    socket.to(`board:${boardId}`).emit("user:joined", user);
    socket.data = { boardId, user };
  });

  socket.on("cursor:move", (data) => {
    const { boardId } = socket.data;
    socket.to(`board:${boardId}`).emit("cursor:move", data);
  });

  socket.on("object:create", (data) => {
    const { boardId } = socket.data;
    socket.to(`board:${boardId}`).emit("object:create", data);
  });

  socket.on("object:update", (data) => {
    const { boardId } = socket.data;
    socket.to(`board:${boardId}`).emit("object:update", data);
  });

  socket.on("object:delete", (data) => {
    const { boardId } = socket.data;
    socket.to(`board:${boardId}`).emit("object:delete", data);
  });

  socket.on("disconnect", () => {
    const { boardId, user } = socket.data || {};
    if (boardId) {
      socket.to(`board:${boardId}`).emit("user:left", user);
    }
  });
});

server.listen(process.env.PORT || 3001);
```

**AI serverless function (Vercel):**

```javascript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, boardState } = req.body;
  if (!prompt || prompt.length > 500) return res.status(400).json({ error: "Invalid prompt" });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    tools: toolDefinitions,
    messages: [{ role: "user", content: prompt }],
    system: `You are a whiteboard AI assistant. Current board state: ${JSON.stringify(boardState)}`,
  });

  res.json({ toolCalls: message.content.filter((c) => c.type === "tool_use") });
}
```

**Total backend code:** ~80 lines (Socket.io server) + ~30 lines (AI function)
**Time investment:** 2-3 hours

---

### 10. Frontend Framework & Rendering

**Framework:** Vite (not Next.js)
**Rendering:** SPA with React Router
**PWA/Offline:** No (real-time requires internet)
**Performance strategy:** Use refs for canvas updates (bypass React re-renders)

**Why Vite over Next.js:**

- Canvas apps are 100% client-side (nothing to pre-render)
- Real-time collaboration = dynamic data (SSR pointless)
- Faster dev server (HMR in <50ms vs Next.js ~200ms)
- Simpler deployment (static build)
- Smaller bundle (no Next.js overhead)
- Saves 2-3 hours of configuration

**Routes:**

```
/           → Landing/login page
/dashboard  → Board list (user's boards)
/board/:id  → Canvas editor
```

**Critical performance pattern:**

```javascript
// ❌ BAD - React re-renders kill performance
const [objects, setObjects] = useState({});
setObjects({ ...objects, [id]: newData }); // Triggers reconciliation on 500 objects

// ✅ GOOD - Konva manages its own state
const stageRef = useRef(null);
const updateObject = (id, newData) => {
  const shape = stageRef.current.findOne(`#${id}`);
  shape.setAttrs(newData);
  shape.getLayer().batchDraw(); // Single redraw
};
```

**Key principles:**

- Separate Konva state from React state
- Use React only for UI components (toolbar, panels)
- Update canvas directly via refs
- Debounce Socket.io messages to React state
- Memoize heavy components
- Virtual rendering (only render objects in viewport)

**Performance gain:** 60 FPS with 500 objects vs 20 FPS rendering all via React state
**Time investment:** 45 minutes setup (Vite + React Router + react-konva boilerplate)

---

### 11. Third-Party Integrations

**Current services:**

- Socket.io (real-time WebSocket, self-hosted on Render)
- Firebase (auth + database)
- Anthropic Claude (AI agent)
- Vercel (frontend deployment + AI serverless)
- Render (Socket.io server hosting)

**Additional services:**

- Optional: Sentry for error tracking (5 min setup, free tier 10K events/month)

**Analytics:** Skip Vercel Analytics (doesn't track real-time latency)
**Custom metrics required:** Build timestamp-based latency tracking + overlay display

**Pricing cliffs awareness:**

- Render: Free tier (750 hours/month) → $7/month Starter for always-on
- Firebase: Generous free tier → pay-as-you-go beyond (unlikely to hit)
- Claude API: Pay-per-use (~$0.003 per request, estimate $5 total)
- Vercel: 100GB bandwidth free → Pro plan $20/month

**Showcase usage:** All within free tiers

**Vendor lock-in risk:** Very Low

- Socket.io → Open source, runs anywhere (AWS, Railway, Fly.io, etc.)
- Firebase → Could migrate to Supabase (5-8 hours)
- Vercel → Could migrate to Netlify/Railway (2-3 hours)

**Latency tracking implementation:**

```javascript
// Client-side tracking
const sendCursor = (x, y) => {
  const timestamp = Date.now();
  socket.emit("cursor:move", { userId, x, y, sentAt: timestamp });
};

socket.on("cursor:move", (data) => {
  const latency = Date.now() - data.sentAt;
  logMetric("cursor_latency", latency);
  updateCursor(data);
});

// Display overlay
<MetricsOverlay cursorAvg={42} objectAvg={87} cursorMax={68} objectMax={112} />;
```

**Time investment:** 30 minutes for metrics dashboard

---

## Phase 3: Post-Stack Refinement

### 12. Security Vulnerabilities

**Top 3 risks and mitigations:**

**1. Exposed API keys in client**

- Risk: Anthropic API key visible in browser DevTools
- Mitigation: All Claude API calls through `/api` serverless functions only, never expose keys in frontend env vars
- Implementation: Environment variables stored in Vercel dashboard, accessed only server-side

**2. Unvalidated AI prompts → prompt injection**

- Risk: Malicious user sends harmful prompts to Claude API
- Mitigation:
  - Character limit (500 chars max)
  - Rate limit (5 requests/min per user)
  - Input sanitization before sending to Claude
  - Content filtering on responses

**3. Unauthenticated Socket.io connections**

- Risk: Anyone could connect to the Socket.io server and spam events
- Mitigation:
  - Validate Firebase auth token on Socket.io `connection` event
  - Reject unauthenticated connections
  - Rate limit events per socket (e.g., max 60 cursor updates/sec)
- Implementation: Socket.io middleware validates JWT before allowing connection

**Bonus - XSS via user-generated SVG content:**

- Risk: AI-generated SVG contains malicious scripts
- Mitigation: Sanitize SVG strings with DOMPurify before rendering on canvas

**Firestore security rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      // Anyone authenticated can read any board (if they have the link)
      allow read: if request.auth != null;
      // Anyone authenticated can edit any board (link = permission)
      allow write: if request.auth != null;
      // Create boards when signed in
      allow create: if request.auth != null;
    }
  }
}
```

**Socket.io auth middleware:**

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication required"));

  // Verify Firebase auth token
  admin
    .auth()
    .verifyIdToken(token)
    .then((decoded) => {
      socket.data.userId = decoded.uid;
      socket.data.userName = decoded.name || "Anonymous";
      next();
    })
    .catch(() => next(new Error("Invalid token")));
});
```

**Additional security measures:**

- HTTPS/TLS encryption (Vercel + Render handle automatically)
- Firebase Auth token validation on all requests
- CORS restrictions on Socket.io server (only allow frontend origin)
- Input validation on all user-generated content

---

### 13. File Structure & Project Organization

**Recommended structure:**

```
collab-board/
├── src/                    # Frontend (Vite + React)
│   ├── components/         # Canvas.tsx, Toolbar.tsx, ShareButton.tsx
│   ├── hooks/              # useSocket.ts, useFirestore.ts, useCanvas.ts
│   ├── lib/                # socket.ts, firebase.ts, utils.ts
│   ├── pages/              # Dashboard.tsx, Board.tsx, Landing.tsx
│   └── main.tsx
├── server/                 # Socket.io server (deployed to Render)
│   ├── index.ts            # Socket.io server entry point
│   └── package.json        # Server dependencies
├── api/                    # Vercel serverless functions
│   └── ai/
│       └── generate.ts
├── public/
├── docs/
└── vercel.json
```

**Organization principles:**

- Keep it flat (no nested folders for 1-week project)
- Group by feature type (components/hooks/pages), not by route
- Separate Socket.io server in /server directory (own package.json for Render deploy)
- Separate serverless functions in /api directory
- Single lib/ folder for service initialization

**Monorepo vs separate repos:** Single repo with separate deploy targets (Vercel for frontend, Render for server)

---

### 14. Naming Conventions & Code Style

**Naming patterns:**

- **Components:** PascalCase (`Canvas.tsx`, `ShareButton.tsx`, `MetricsOverlay.tsx`)
- **Hooks:** camelCase with `use` prefix (`useSocket.ts`, `useRealTimeSync.ts`, `useCanvas.ts`)
- **Utilities:** camelCase (`generateBoardId.ts`, `sanitizeSvg.ts`, `debounce.ts`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_OBJECTS = 500`, `CURSOR_UPDATE_THROTTLE = 50`)

**Linting setup (5 minutes):**

```bash
npm i -D eslint @eslint/js eslint-plugin-react prettier
npx eslint --init
```

**Code style philosophy:**

- Use Prettier defaults, don't bikeshed formatting rules
- Accept auto-formatting and move on
- Consistency > personal preference
- Focus time on features, not style debates

**TypeScript:** Yes — using TypeScript for type safety with Socket.io events and Konva shapes.

---

### 15. Testing Strategy

**Focus:** Metrics validation, not unit tests

**Required tests:**

**1. Latency validation:**

- Log `Date.now()` on message send/receive
- Run 100 Socket.io message round-trips
- Assert average <100ms for objects, <50ms for cursors
- Tool: Custom logging + stats calculation

**2. FPS monitoring:**

- Use stats.js library overlay
- Render 500 objects on canvas
- Drag/pan/zoom operations
- Assert sustained >55 FPS (buffer below 60 FPS target)

**3. Concurrent user load test:**

- Open 5 browser tabs (or use Puppeteer)
- Connect all to same board
- Verify cursor updates reach all clients within 100ms
- Verify object updates sync correctly

**4. Object capacity stress test:**

- Add 500 objects to board
- Measure Konva render time <16ms per frame (60 FPS)
- Verify no performance degradation

**Why skip unit tests:**

- Performance benchmarks prove it works better than Jest mocks
- 1-week timeline doesn't allow for comprehensive test coverage
- Showcase project prioritizes working demo over test suite
- Manual testing + metrics validation sufficient for grading

**Testing implementation:**

```javascript
// Latency test
const latencies = [];
for (let i = 0; i < 100; i++) {
  const start = Date.now();
  socket.emit("ping-test", { sentAt: start });
  socket.once("pong-test", (data) => {
    latencies.push(Date.now() - data.sentAt);
  });
}
// Assert: avg(latencies) < 100ms

// FPS monitoring
import Stats from "stats.js";
const stats = new Stats();
document.body.appendChild(stats.dom);
requestAnimationFrame(function loop() {
  stats.update();
  requestAnimationFrame(loop);
});
```

**Time investment:** 2-3 hours for test implementation + validation

---

### 16. Recommended Tooling & DX

**Claude Code workflow:**

- Terminal-based development — use `npm run dev` with live reload, check console for errors
- Performance profiling: Add `console.time('render')` / `console.timeEnd('render')` inline
- Use Vercel CLI for deployment status, build logs, env vars without leaving terminal

**Essential browser tools:**

- **React DevTools:** Component tree inspection, props/state debugging
- **Chrome Network tab:** WebSocket frame inspection, verify <100ms latency
- **Chrome Performance tab:** 60 FPS validation, identify rendering bottlenecks

**Performance monitoring:**

- stats.js overlay in development (top-left corner FPS counter)
- Custom metrics dashboard (cursor/object latency averages)
- Console logging for debugging sync issues

**Development workflow:**

1. Run Socket.io server locally: `cd server && npm run dev`
2. Run Vite frontend: `npm run dev`
3. Test in browser with live reload
4. Monitor metrics overlay continuously
5. Performance profiling before each milestone

---

## Final Tech Stack Summary

| Layer              | Technology                     | Time Investment | Reasoning                                                  |
| ------------------ | ------------------------------ | --------------- | ---------------------------------------------------------- |
| **Real-time sync** | Socket.io (on Render)          | 2-3 hours       | Open source, no message limits, full control, $0 cost      |
| **Database**       | Firebase Firestore             | 1-2 hours       | Real-time listeners, Firebase ecosystem, auto-scaling      |
| **Authentication** | Firebase Auth (Google Sign-In) | 30 min          | Zero-friction collaboration, production pattern            |
| **Frontend**       | Vite + React + react-konva     | 4-6 hours       | Fast dev server, canvas library, 60 FPS capable            |
| **AI Backend**     | Vercel serverless (/api)       | 30 min          | AI integration only, protects API key                      |
| **WS Server**      | Render (Node.js)               | 30 min          | Free tier, persistent process for Socket.io                |
| **AI Integration** | Anthropic Claude               | 1-2 hours       | Function calling for board manipulation                    |
| **Deployment**     | Vercel + Render                | 30 min          | Auto-deploy, edge network + persistent server, $0 cost     |
| **Metrics**        | Custom overlay + logging       | 30 min          | Timestamp-based latency tracking                           |

**Total setup/architecture:** 10-14 hours
**Remaining for features/polish:** 66-70 hours of 80-hour sprint

---

## Key Decision Rationale

### 1. Why Socket.io over Pusher?

- **No vendor lock-in** — open source, deploy anywhere
- **No message limits** — Socket.io has no managed message cap
- **Full control** — custom room logic, presence, rate limiting, auth middleware
- **Better for portfolio** — demonstrates backend engineering, not just wiring managed services
- **Massive community** — well-documented, millions of tutorials and examples
- **$0 cost** — Render free tier vs managed realtime paid tier cliffs
- **Tradeoff:** Must manage a server process (mitigated by Render's simple deploy)

### 2. Why Render for Socket.io?

- **Free tier** — 750 hours/month, enough for showcase
- **Persistent process** — unlike Vercel serverless, can hold WebSocket connections
- **Auto-deploy from Git** — push to main = deploy
- **Simple setup** — point to /server directory, set start command
- **Tradeoff:** ~30s cold start after 15 min idle (acceptable for demo, upgrade to $7/month if needed)

### 3. Why Vercel + Render split?

- **Best of both** — Vercel's edge CDN for frontend, Render's persistent process for WebSockets
- **$0 total cost** — both free tiers
- **Separation of concerns** — frontend deploys independently from WebSocket server
- **Tradeoff:** Two deploy targets to manage (mitigated by auto-deploy on both)

### 4. Why Google Sign-In only?

- **Zero friction** for collaborators (one-click access)
- **No password reset flows** needed (saves 2-3 hours)
- **Production pattern** (Figma, Miro use social auth)
- **Tradeoff:** Requires Google account (acceptable for showcase)

### 5. Why one Firestore doc per board?

- **Single read on join** (fast initial load)
- **Atomic updates** (no race conditions)
- **Simpler queries** (no joins needed)
- **Firestore 1MB limit** = 500 objects fits comfortably
- **Tradeoff:** Can't query individual objects (not needed)

### 6. Why skip unit tests?

- **1-week timeline** doesn't allow comprehensive coverage
- **Performance benchmarks** prove requirements better than mocks
- **Manual testing** sufficient for showcase grading
- **Focus on metrics** that graders will verify
- **Tradeoff:** Less confidence in refactors (mitigate with AI-assisted coding)

---

## Risk Assessment & Mitigation

### High Risk: Real-time sync latency

- **Concern:** May not consistently hit <100ms object sync, <50ms cursor sync
- **Mitigation:** Build latency test FIRST (hour 1-4), validate before building features
- **Backup plan:** If same-region latency is too high, optimize payload size / reduce broadcast frequency
- **Confidence:** High (Socket.io typical latency is 10-50ms for same-region connections)

### Medium Risk: Render cold starts

- **Concern:** Free tier spins down after 15 min idle, ~30s to restart
- **Mitigation:** Show "Connecting..." UI state, Socket.io auto-reconnects
- **Backup plan:** Upgrade to Render Starter ($7/month) for always-on if demo requires it
- **Confidence:** Medium (cold start only affects first connection after idle period)

### Medium Risk: Canvas performance with 500 objects

- **Concern:** May drop below 60 FPS with full object load
- **Mitigation:** Virtual rendering (only render viewport), use refs not React state, memoization
- **Backup plan:** Reduce object limit to 300-400 if needed
- **Confidence:** Medium (react-konva proven at this scale with optimization)

### Low Risk: AI integration complexity

- **Concern:** Function calling might be difficult to implement
- **Mitigation:** Simple serverless function, well-documented Anthropic SDK
- **Backup plan:** Reduce AI commands from 6 to 3-4 if time-constrained
- **Confidence:** High (straightforward API integration)

### Low Risk: Authentication edge cases

- **Concern:** OAuth flow or session management bugs
- **Mitigation:** Firebase Auth handles all complexity, production-proven
- **Backup plan:** Anonymous auth if Google Sign-In breaks
- **Confidence:** High (Firebase Auth is battle-tested)

---

## Success Criteria

### MVP (24 hours) - Hard gate:

- ✅ Infinite board with pan/zoom
- ✅ Sticky notes with editable text
- ✅ At least one shape type
- ✅ Create, move, and edit objects
- ✅ Real-time sync between 2+ users
- ✅ Multiplayer cursors with name labels
- ✅ Presence awareness (who's online)
- ✅ User authentication
- ✅ Deployed and publicly accessible

### Final Submission (7 days):

- ✅ All MVP requirements
- ✅ AI agent with 6+ command types
- ✅ Metrics dashboard proving <100ms object, <50ms cursor
- ✅ 5+ concurrent users without degradation
- ✅ 500+ objects capacity
- ✅ Share links working
- ✅ Documentation + demo video
- ✅ Clean UI/UX

### Grading Demo:

- Open metrics overlay showing live latency
- Two browsers side-by-side demonstrating sync
- AI commands working ("create SWOT analysis template")
- 5 browser tabs stress test
- Performance tab showing 60 FPS sustained

---

## Timeline & Milestones

### Hours 1-4: Validate Architecture

- Socket.io server + client connection test
- Measure actual cursor latency (must be <50ms)
- Basic canvas with 1 object syncing
- Measure object latency (must be <100ms)
- **Gate:** If latency passes → continue, if fails → optimize or pivot

### Hours 5-24: MVP Sprint

- Firebase Auth + Google Sign-In (2h)
- Canvas with pan/zoom (3h)
- Sticky notes + shapes (4h)
- Real-time object sync via Socket.io (4h)
- Cursors + presence (3h)
- Deployment to Vercel + Render (1h)
- **Deliverable:** Functioning MVP submitted Tuesday 2 PM

### Hours 25-48: Core Features

- AI serverless function (2h)
- Basic AI commands (4h)
- Share link functionality (2h)
- Metrics dashboard (2h)
- Bug fixes from MVP feedback (4h)

### Hours 49-72: Advanced Features

- Complex AI commands (multi-step) (4h)
- Performance optimization (3h)
- UI polish (4h)
- Testing + validation (3h)

### Hours 73-80: Final Polish

- Documentation (3h)
- Demo video (2h)
- Final testing (2h)
- Submission prep (1h)
- **Deliverable:** Final submission Sunday 10:59 PM

---

## Appendix: Quick Reference

### Environment Variables

**Vercel (frontend + AI):**

```bash
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_SOCKET_URL=https://collab-board-server.onrender.com
ANTHROPIC_API_KEY=sk-ant-xxx  # server-side only
VITE_ENABLE_METRICS=true
```

**Render (Socket.io server):**

```bash
CLIENT_URL=https://collab-board-iota.vercel.app
PORT=3001
```

### Key Commands

```bash
# Frontend development
npm run dev             # Start Vite dev server
npm run build           # Build for production
npm run preview         # Preview production build

# Socket.io server development
cd server && npm run dev  # Start Socket.io server locally

# Deployment
git push origin main    # Auto-deploys frontend to Vercel + server to Render

# Vercel CLI
vercel ls               # Check deployment status
vercel logs <url>       # View runtime logs
vercel env ls           # List environment variables
```

### Critical URLs

- Firebase Console: https://console.firebase.google.com
- Vercel Dashboard: https://vercel.com/dashboard
- Render Dashboard: https://dashboard.render.com
- Anthropic Console: https://console.anthropic.com

---

## Conclusion

This pre-search establishes a clear architectural foundation for CollabBoard. The selected stack (Socket.io + Firebase + Vercel + Render + React + Konva + Claude) balances:

1. **Performance:** Socket.io delivers <50ms cursor sync, <100ms object sync for same-region clients
2. **Simplicity:** Managed hosting (Vercel + Render) eliminates DevOps complexity
3. **Speed:** Can build MVP in 24 hours, full project in 7 days
4. **Cost:** $0-7 total project cost
5. **Portfolio value:** Demonstrates real backend engineering with Socket.io, not just wiring managed services

Key success factors:

- Validate latency FIRST (hours 1-4) before committing to full build
- Use refs to separate Konva state from React state (critical for 60 FPS)
- Debounce Firestore writes (cost optimization)
- Build metrics dashboard early (prove requirements continuously)
- Focus on core requirements, skip nice-to-haves

Ready to execute. Time to build.

---

**Document prepared:** February 16, 2026
**Total pre-search time:** 90 minutes
**Next step:** Submit PDF and begin implementation
