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

**Monthly spend limit:** $0 (free tiers only)
**Pay-per-use acceptable:** Yes, but staying within free tier limits
**Trade money for time:** Using managed services (Ably, Firebase, Vercel) instead of custom infrastructure
**Cost Strategy:**

- Ably: Free tier (6M messages/month)
- Firebase: Free tier (generous for showcase usage)
- Vercel: Free tier (100GB bandwidth, serverless functions)
- Anthropic Claude: Pay-per-use (~$5 total for development + demos)
  **Total projected cost:** $0-5 for entire project lifecycle

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
**GDPR:** Covered by vendors (Ably, Firebase are SOC 2 Type II certified)
**SOC 2:** All vendors already certified
**Data residency:** US by default, acceptable for showcase
**Documentation requirement:** "All services SOC 2 Type II certified. Data retention 30 days for demo purposes.
"
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
**Biggest risk:** Getting stuck on real-time sync edge cases â†’ mitigated by using Ably managed service

---

## Phase 2: Architecture Discovery

### 6. Hosting & Deployment

**Platform:** Vercel (all-in-one deployment)
**Architecture:** Frontend + serverless functions in single repository
**CI/CD:** Vercel auto-deploy (Git push = automatic deployment)
**Deployment strategy:**

- Frontend: Vercel edge network (static React build, global CDN)
- Serverless functions: /api folder for AI integration
- No custom backend server needed (Ably + Firebase handle real-time + persistence)
  **Why Vercel over alternatives:**
- $0 cost vs Railway ($5/month minimum)
- Edge network = faster global performance (50-150ms vs 200-800ms)
- Simpler architecture (no backend server to manage)
- Familiar Git-based deployment
- Better for portfolio (industry standard)
  **Time investment:** 15 minutes initial setup, automatic deployments thereafter
  **Considerations:**
- 200ms serverless cold starts on AI functions (negligible vs 2-5s Claude API calls)
- No persistent WebSocket connections needed (Ably handles this)
- No background jobs required for showcase

---

### 7. Authentication & Authorization

**Auth method:** Google Sign-In only (Firebase Auth)
**Access model:** Share link = edit access (UUID-based board URLs)
**Permissions:** Anyone with link can edit (no roles/granular permissions)
**Presence:** Ably presence API (show active users + cursor labels)
**Privacy:** Private boards by default, no public gallery
**Reasoning:**

- Google Sign-In: Zero friction for collaborators (one-click access)
- Share links: Common pattern (Figma, Miro, Excalidraw use this)
- No role management: Saves 3-5 hours of complexity, not needed for showcase
- UUID security: 128-bit entropy = impossible to brute force
  **User flow:**

1. User A creates board â†’ Gets URL: yourapp.com/board/uuid123
2. User A shares link with Users B & C
3. Users B & C click link â†’ Sign in with Google â†’ Instant edit access
4. All users see each other's cursors, changes sync <100ms
   **Time investment:** 4-5 hours total (auth + share links + presence)
   **Security:**

- Firebase Auth handles OAuth flow
- Firestore security rules require authentication
- Board IDs are unguessable UUIDs
- ## "Security through obscurity" acceptable for showcase (production pattern)

### 8. Database & Data Layer

**Database:** Firebase Firestore
**Structure:** One document per board with embedded objects
**Caching:** No Redis needed (Ably in-memory + Firestore client cache)
**Write strategy:** Debounce writes to Firestore (every 2-5 seconds), Ably handles real-time broadcasts
**Data model:**

```javascript
boards/uuid123: {
ownerId: "user
xyz"
,
_
title: "My Board"
,
createdAt: timestamp,
lastModified: timestamp,
objects: {
"obj_
1": { type: "rect"
, x: 100, y: 200, width: 50, height: 50, color: "#FF0000" },
"obj_
2": { type: "circle"
// ... up to 500 objects
, x: 300, y: 150, radius: 30, color: "#00FF00" },
}
}
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
- Ably handles real-time writes (in-memory, not hitting DB)
  **Cost with debouncing:**
- Without: 6,000 writes/min Ã— $0.18/100K = expensive
- With: 20 writes/min Ã— $0.18/100K = pennies
  **Meets <100ms requirement:** Yes
- Ably broadcast: 30-60ms
- Firestore write (debounced): Doesn't block UI
- Firestore read (on join): 100-200ms (one-time, acceptable)
  **Time investment:** 1-2 hours (Firestore rules + data model setup)

---

### 9. Backend/API Architecture

**Backend:** None (serverless only)
**AI calls:** Vercel serverless function in /api/ai/generate (protects API key)
**Client-side:** Canvas rendering, Ably SDK, Firestore SDK, Firebase Auth
**Background jobs:** Skip for showcase (no cleanup needed)
**Architecture:**

```
Client-side:
- Canvas rendering (React + Konva)
- Ably connection (real-time sync)
- Firebase Auth (authentication)
- Firestore SDK (database reads/writes)
Serverless (/api folder):
- AI generation only (protects Anthropic API key)
No traditional backend server needed.
```

**Why serverless for AI:**

- Keeps API key secret (server-side environment variable)
- Rate limiting capability (prevent abuse)
- Cost control (monitor API usage)
- Input validation/sanitization
  **What we DON'T need:**
- REST API for CRUD operations (Firestore SDK handles this client-side)
- WebSocket server (Ably handles this)
- Auth endpoints (Firebase handles this)
- File uploads, image processing, email sending (not in requirements)
  **Minimal serverless function example:**

```javascript
// /api/ai/generate-shape.js
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({
apiKey: process.env.ANTHROPIC
API
KEY
_
_
});
export default async function handler(req, res) {
if (req.method !==
'POST') {
return res.status(405).json({ error: 'Method not allowed' });
}
const { prompt } = req.body;
// Validation
if (!prompt || prompt.length > 500) {
return res.status(400).json({ error: 'Invalid prompt' });
}
try {
const message = await anthropic.messages.create({
model: 'claude-sonnet-4-20250514'
,
max
tokens: 1000,
_
messages: [{
role: 'user'
,
content:
`Generate a whiteboard element for: ${prompt}`
}]
});
res.json({
result: message.content[0].text,
id: crypto.randomUUID()
});
} catch (error) {
res.status(500).json({ error: 'AI generation failed' });
}
}
```

**Total backend code:** ~50 lines
**Time investment:** 30 minutes

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
/ â†’ Landing/login page
/dashboard â†’ Board list (user's boards)
/board/:id â†’ Canvas editor
```

**Critical performance pattern:**

```javascript
// â Œ BAD - React re-renders kill performance
const [objects, setObjects] = useState({});
setObjects({ ...objects, [id]: newData }); // Triggers reconciliation on 500 objects
// âœ… GOOD - Konva manages its own state
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
- Debounce Ably messages to React state
- Memoize heavy components
- Virtual rendering (only render objects in viewport)
  **Performance gain:** 60 FPS with 500 objects vs 20 FPS rendering all via React state
  **Time investment:** 45 minutes setup (Vite + React Router + react-konva boilerplate)

---

### 11. Third-Party Integrations

**Current services:**

- Ably (real-time WebSocket)
- Firebase (auth + database)
- Anthropic Claude (AI agent)
- Vercel (deployment)
  **Additional services:**
- Optional: Sentry for error tracking (5 min setup, free tier 10K events/month)
  **Analytics:** Skip Vercel Analytics (doesn't track real-time latency)
  **Custom metrics required:** Build timestamp-based latency tracking + overlay display
  **Pricing cliffs awareness:**
- Ably: 6M messages/month free â†’ $29/month for 15M messages
- Firebase: Generous free tier â†’ pay-as-you-go beyond (unlikely to hit)
- Claude API: Pay-per-use (~$0.003 per request, estimate $5 total)
- Vercel: 100GB bandwidth free â†’ Pro plan $20/month
  **Showcase usage:** All within free tiers
  **Vendor lock-in risk:** Low
- Ably â†’ Could migrate to Socket.io (10-15 hours)
- Firebase â†’ Could migrate to Supabase (5-8 hours)
- Vercel â†’ Could migrate to Netlify/Railway (2-3 hours)
- Acceptable risk for showcase project
  **Latency tracking implementation:**

```javascript
// Client-side tracking
const sendCursor = (x, y) => {
const timestamp = Date.now();
channel.publish('cursor'
, { userId, x, y, sentAt: timestamp });
};
channel.subscribe('cursor'
, (msg) => {
const latency = Date.now() - msg.data.sentAt;
logMetric('cursor
latency'
, latency);
_
updateCursor(msg.data);
});
// Display overlay
<MetricsOverlay
cursorAvg={42}
objectAvg={87}
cursorMax={68}
objectMax={112}
/>
```

## **Time investment:** 30 minutes for metrics dashboard

## Phase 3: Post-Stack Refinement

### 12. Security Vulnerabilities

**Top 3 risks and mitigations:**
**1. Exposed API keys in client**

- Risk: Anthropic API key visible in browser DevTools
- Mitigation: All Claude API calls through `/api`
  serverless functions only, never expose keys in frontend env vars
- Implementation: Environment variables stored in Vercel dashboard, accessed only server-side
  **2. Unvalidated AI prompts â†’ prompt injection**
- Risk: Malicious user sends harmful prompts to Claude API
- Mitigation:
- Character limit (500 chars max)
- Rate limit (5 requests/min per user)
- Input sanitization before sending to Claude
- Content filtering on responses
  **3. Board access via UUID guessing**
- Risk: Attacker tries to brute force board IDs
- Mitigation:
- Use crypto.randomUUID() (128-bit entropy = 2^128 possible values)
- Firestore security rules requiring authentication
- Implementation: Mathematically impossible to brute force
  **Bonus - XSS via user-generated SVG content:**
- Risk: AI-generated SVG contains malicious scripts
- Mitigation: Sanitize SVG strings with DOMPurify before rendering on canvas
  **Firestore security rules:**

```javascript
rules
version =
'2';
_
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

**Additional security measures:**

- HTTPS/TLS encryption (Vercel handles automatically)
- Firebase Auth token validation on all requests
- CORS restrictions in serverless functions
- Input validation on all user-generated content

---

### 13. File Structure & Project Organization

**Recommended structure:**

```
vite-app/
â”œâ”€â”€ src/
â”
‚ â”œâ”€â”€ components/ # Canvas.jsx, Toolbar.jsx, ShareButton.jsx
â”
‚ â”œâ”€â”€ hooks/ # useAbly.js, useFirestore.js, useCanvas.js
â”
‚ â”œâ”€â”€ lib/ # ably.js, firebase.js, utils.js
â”
‚ â”œâ”€â”€ pages/ # Dashboard.jsx, Board.jsx, Landing.jsx
â”
‚ â””â”€â”€ main.jsx # Entry point
â”
‚
â”œâ”€â”€ api/ # Serverless functions
â”
‚ â””â”€â”€ ai/
â”
‚ â””â”€â”€ generate.js # Claude API integration
â”
‚
â”œâ”€â”€ public/ # Static assets
â”
‚
â”œâ”€â”€ .cursorrules # Cursor AI context
â”œâ”€â”€ vercel.json # Deployment config
â””â”€â”€ package.json
```

**Organization principles:**

- Keep it flat (no nested folders for 1-week project)
- Group by feature type (components/hooks/pages), not by route
- Separate serverless functions in /api directory
- Single lib/ folder for service initialization
  **Monorepo vs separate repos:** Single repo (simpler for Vercel deployment)

---

### 14. Naming Conventions & Code Style

**Naming patterns:**

- **Components:** PascalCase (`Canvas.jsx
`
  ,
  `ShareButton.jsx
`
  ,
  `MetricsOverlay.jsx
`)
- **Hooks:** camelCase with `
`
  use
  prefix (`useAbly.js`
  `,
useRealTimeSync.js`
  `
  ,
  useCanvas.js
- **Utilities:** camelCase (`generateBoardId.js`
  `,
sanitizeSvg.js`
  ,
  `debounce.js
`)
- **Constants:** UPPER
  SNAKE
  CASE (`MAX
OBJECTS = 500`
  ,
  `CURSOR
UPDATE
THROTTLE = 50`)
  \_
  \_
  \_
  \_
  \_
  **Linting setup (5 minutes):**

```bash
npm i -D eslint @eslint/js eslint-plugin-react prettier
npx eslint --init # Choose: React, browser, Airbnb style guide
```

**Code style philosophy:**

- Use Prettier defaults, don't bikeshed formatting rules
- Accept auto-formatting and move on
- Consistency > personal preference
- Focus time on features, not style debates
  `)
  **TypeScript vs JavaScript:** JavaScript (faster development, type safety not critical for 1-week showcase)

---

### 15. Testing Strategy

**Focus:** Metrics validation, not unit tests
**Required tests:**
**1. Latency validation:**

- Log
  `Date.now()`
  on message send/receive
- Run 100 Ably message round-trips
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
channel.publish('test'
channel.once('test'
, () => {
latencies.push(Date.now() - start);
, { data: i, sentAt: start });
});
}
// Assert: avg(latencies) < 100ms
// FPS monitoring
import Stats from 'stats.js';
const stats = new Stats();
document.body.appendChild(stats.dom);
requestAnimationFrame(function loop() {
stats.update();
requestAnimationFrame(loop);
});
```

## **Time investment:** 2-3 hours for test implementation + validation

### 16. Recommended Tooling & DX

**Cursor-specific setup:**

- Enable Cursor Rules file (`.cursorrules`) with stack context: "React + Vite + Konva + Ably + Firebase"
- Use Cursor's "Chat with codebase" for navigating Konva/Ably APIs instead of manual docs searching
- Composer mode for multi-file refactors (e.g., moving objects from React state to Konva refs)
  **Claude Code workflow:**
- Terminal-based development - use
  `npm run dev`
  with live reload, check console for errors
- Skip browser extensions - use browser DevTools Console + Network tab for Ably WebSocket monitoring
- Performance profiling: Add `
console.time('render')` / `
console.timeEnd('render')` inline, let Claude Code suggest
  optimizations based on logs
  **Essential browser tools:**
- **React DevTools:** Component tree inspection, props/state debugging
- **Ably Realtime Inspector:** Web-based at ably.com/dashboard, view message flow in real-time
- **Chrome Performance tab:** 60 FPS validation, identify rendering bottlenecks
- **Network tab:** WebSocket frame inspection, verify <100ms latency
  **Performance monitoring:**
- stats.js overlay in development (top-left corner FPS counter)
- Custom metrics dashboard (cursor/object latency averages)
- Console logging for debugging sync issues
  **Development workflow:**

1. Use Cursor Composer for scaffolding components
2. Test in browser with live reload
3. Monitor metrics overlay continuously
4. Use Claude Code for debugging sync issues
5. Performance profiling before each milestone

---

## Final Tech Stack Summary

| Layer              | Technology                     | Time Investment | Reasoning                                                 |
| ------------------ | ------------------------------ | --------------- | --------------------------------------------------------- |
| **Real-time sync** | Ably                           | 1-2 hours       | Guaranteed <50ms cursors, <100ms objects, managed service |
| **Database**       | Firebase Firestore             | 1-2 hours       | Real-time listeners, Firebase ecosystem, auto-scaling     |
| **Authentication** | Firebase Auth (Google Sign-In) | 30 min          | Zero-friction collaboration, production pattern           |
| **Frontend**       | Vite + React + react-konva     | 4-6 hours       | Fast dev server, canvas library, 60 FPS capable           |
| **Backend**        | Vercel serverless (/api)       | 30 min          | AI integration only, no traditional server needed         |
| **AI Integration** | Anthropic Claude               | 1-2 hours       | Function calling for board manipulation                   |
| **Deployment**     | Vercel                         | 15 min          | Auto-deploy, edge network, $0 cost                        |
| **Metrics**        | Custom overlay + logging       | 30 min          | Timestamp-based latency tracking                          |

**Total setup/architecture:** 10-14 hours
**Remaining for features/polish:** 66-70 hours of 80-hour sprint

---

## Key Decision Rationale

### 1. Why Ably over custom WebSocket?

- **Saves 20-30 hours** of implementation (connection management, presence, reconnection)
- **Guaranteed latency** (<50ms documented in SLA)
- **Built-in presence API** (who's online, cursor labels)
- **Production-proven** (used by scale apps)
- **Tradeoff:** Slight vendor lock-in, but acceptable for showcase with migration path

### 2. Why Vercel serverless over traditional backend?

- **No server to manage** (Ably + Firebase handle real-time + persistence)
- **$0 cost** vs Railway $5/month minimum
- **Simpler architecture** (fewer moving parts)
- **Industry standard** (better for portfolio)
- **Tradeoff:** 200ms cold starts (negligible for 2-5s AI calls)

### 3. Why Google Sign-In only?

- **Zero friction** for collaborators (one-click access)
- **No password reset flows** needed (saves 2-3 hours)
- **Production pattern** (Figma, Miro use social auth)
- **Tradeoff:** Requires Google account (acceptable for showcase)

### 4. Why one Firestore doc per board?

- **Single read on join** (fast initial load)
- **Atomic updates** (no race conditions)
- **Simpler queries** (no joins needed)
- **Firestore 1MB limit** = 500 objects fits comfortably
- **Tradeoff:** Can't query individual objects (not needed)

### 5. Why skip unit tests?

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
- **Backup plan:** If Ably fails, custom Socket.io (adds 15-20 hours, but fallback exists)
- **Confidence:** High (Ably's published benchmarks show 20-80ms typical)

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

- âœ… Infinite board with pan/zoom
- âœ… Sticky notes with editable text
- âœ… At least one shape type
- âœ… Create, move, and edit objects
- âœ… Real-time sync between 2+ users
- âœ… Multiplayer cursors with name labels
- âœ… Presence awareness (who's online)
- âœ… User authentication
- âœ… Deployed and publicly accessible

### Final Submission (7 days):

- âœ… All MVP requirements
- âœ… AI agent with 6+ command types
- âœ… Metrics dashboard proving <100ms object, <50ms cursor
- âœ… 5+ concurrent users without degradation
- âœ… 500+ objects capacity
- âœ… Share links working
- âœ… Documentation + demo video
- âœ… Clean UI/UX

### Grading Demo:

- Open metrics overlay showing live latency
- Two browsers side-by-side demonstrating sync
- AI commands working ("create SWOT analysis template")
- 5 browser tabs stress test
- Performance tab showing 60 FPS sustained

---

## Timeline & Milestones

### Hours 1-4: Validate Architecture

- Ably connection + echo test
- Measure actual cursor latency (must be <50ms)
- Basic canvas with 1 object syncing
- Measure object latency (must be <100ms)
- **Gate:** If latency passes â†’ continue, if fails â†’ pivot to backup

### Hours 5-24: MVP Sprint

- Firebase Auth + Google Sign-In (2h)
- Canvas with pan/zoom (3h)
- Sticky notes + shapes (4h)
- Real-time object sync (4h)
- Cursors + presence (3h)
- Deployment (1h)
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

### Environment Variables (Vercel)

```bash
# Required
VITE
FIREBASE
API
KEY=xxx
_
_
_
VITE
FIREBASE
AUTH
DOMAIN=xxx.firebaseapp.com
_
_
_
VITE
FIREBASE
PROJECT
ID=xxx
_
_
_
VITE
ABLY
API
KEY=xxx
_
_
_
ANTHROPIC
API
KEY=sk-ant-xxx (server-side only)
_
_
# Optional
VITE
ENABLE
_
SENTRY
```

METRICS=true
_
DSN=xxx (if using error tracking)
_

### Key Commands

````bash
# Development
npm run dev npm run build npm run preview vercel dev # Deployment
git push origin main # Testing
npm run test ```
# Start Vite dev server
# Build for production
# Preview production build
# Test serverless functions locally
# Auto-deploys to Vercel
# Run latency validation
### Critical URLs
- Ably Dashboard: https://ably.com/dashboard
- Firebase Console: https://console.firebase.google.com
- Vercel Dashboard: https://vercel.com/dashboard
- Anthropic Console: https://console.anthropic.com
---
## Conclusion
This pre-search establishes a clear architectural foundation for CollabBoard. The selected stack (Ably + Firebase + Vercel +
React + Konva + Claude) balances:
1.
2.
3.
4.
5.
**Performance:** Guaranteed to meet <100ms object, <50ms cursor requirements
**Simplicity:** Managed services eliminate infrastructure complexity
**Speed:** Can build MVP in 24 hours, full project in 7 days
**Cost:** $0-5 total project cost
**Learning:** Demonstrates modern real-time collaboration patterns
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
````
