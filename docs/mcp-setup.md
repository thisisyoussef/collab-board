# MCP Setup for CollabBoard

This document covers which MCPs to use during AI-first development of CollabBoard, why they matter, and how to set them up.

---

## Required MCPs (use at least 2 per PRD)

### 1. Context7 MCP — Library Documentation

**Why:** Fetches up-to-date docs for Socket.IO, react-konva, Firebase, and Anthropic SDK. Prevents AI from hallucinating deprecated APIs.

**Setup in Cursor:**

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

**Usage:** When asking Cursor about Socket.IO rooms/events, Konva transforms, or Firebase Firestore queries, Context7 provides grounded, current API documentation.

**Key libraries to query:**

- `socket.io` / `socket.io-client` — rooms, events, auth handshake, connection lifecycle
- `konva` / `react-konva` — Stage, Layer, shapes, Transformer, refs
- `firebase` — Firestore, Auth, security rules
- `@anthropic-ai/sdk` — Messages API, tool use / function calling

---

### 2. Playwright MCP — Browser Automation & Testing

**Why:** Critical for testing the PRD's 5 collaboration scenarios. Opens multiple browser contexts to simulate 2-5 concurrent users editing the same board.

**Setup in Cursor:**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-playwright@latest"]
    }
  }
}
```

**Usage:**

- Open 2+ browser tabs with different auth sessions
- Verify cursor sync, object sync, presence indicators
- Simulate disconnect/reconnect (network throttling)
- Stress test with 5 concurrent tabs
- Take screenshots for demo video

---

## Recommended MCPs

### 3. Sequential Thinking MCP — Complex Reasoning

**Why:** Useful during Pre-Search and when designing multi-step AI agent commands (SWOT templates, retro boards). Helps think through complex state transitions.

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-sequential-thinking@latest"]
    }
  }
}
```

### 4. GitHub MCP — Repo Management

**Why:** Create issues, PRs, manage the repository directly from Cursor for the required GitHub deliverable.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-github@latest"],
      "env": {
        "GITHUB_TOKEN": "your-github-pat"
      }
    }
  }
}
```

---

## MCP Configuration File

Create `.cursor/mcp.json` in the collab-board project root:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-playwright@latest"]
    }
  }
}
```

---

## MCPs NOT Needed (and why)

| MCP          | Why Skip                                                                    |
| ------------ | --------------------------------------------------------------------------- |
| Supabase MCP | Not using Supabase (chose Firebase + Socket.IO)                             |
| Vercel MCP   | Auto-deploy via git push; no need for MCP control                           |
| Firebase MCP | No official Firebase MCP yet; use Firebase Console + Firestore SDK directly |
| Memory MCP   | 1-week project; Cursor rules + skill provide sufficient context             |
| Sentry MCP   | Optional error tracking; not critical for showcase                          |

---

## AI Development Log Notes

For the required AI Development Log, document:

- **Tools:** Cursor (primary), Claude Code (secondary), MCPs listed above
- **MCP Usage:** Context7 for docs, Playwright for multi-user testing
- **Track:** API calls, tokens consumed, costs for the cost analysis deliverable
