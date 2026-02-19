# Demo Video Notes (3-5 Minutes)

This script skeleton matches PRD expectations: real-time collaboration, AI commands, and architecture.

## Runtime Targets

- Total duration: 3:00 to 5:00
- Screen capture: deployed app
- Must show: multiplayer sync + AI command execution

## Time-Boxed Script

### 0:00-0:20 Intro

- "Welcome to CollabBoard, a real-time collaborative whiteboard with an AI board agent."
- "Today I’ll show core board editing, multiplayer sync, and AI-generated board actions."

### 0:20-1:10 Core Board Features

- Create sticky note, shape, connector, and text.
- Move/resize objects and show selection behavior.
- Mention persistence: refresh and state remains.

### 1:10-2:00 Multiplayer Collaboration

- Open second browser/user.
- Show presence avatars and cursor labels.
- Move/create objects from both sessions and narrate live sync.

### 2:00-3:10 AI Agent Commands

- Show command center.
- Run one command from each category:
  1. Creation: "Add a yellow sticky note that says User Research"
  2. Manipulation: "Change the sticky note color to green"
  3. Layout: "Arrange these notes in a grid"
  4. Complex: "Create a SWOT analysis template"
- Mention preview/apply flow and shared AI results across users.

### 3:10-4:10 Architecture + Reliability

- Brief stack callout:
  - Frontend: React + Konva
  - Realtime: Socket.IO on Render
  - Persistence/Auth: Firebase
  - AI endpoint: Vercel serverless
- Mention reconnect behavior and performance targets.

### 4:10-4:40 Close

- "That’s CollabBoard: real-time collaboration plus AI-assisted board building."
- "Links to repo, deployed app, and documentation are in the submission package."

## Recording Checklist

1. Use production URLs.
2. Disable notifications and close unrelated tabs.
3. Keep cursor visible and zoom legible.
4. Run through prompts once before recording.
5. Verify audio levels and trim dead time.
