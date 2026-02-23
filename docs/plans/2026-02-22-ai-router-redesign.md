# AI Router Redesign — 2-Tier Keyword Router

## Problem

Performance optimizations (token reduction, prompt splitting, model downgrading) broke the AI agent's ability to handle complex and creative commands. The classifier `isLikelyComplexPlanPrompt()` was inverted to default-complex, which fixed templates but made simple commands slow/expensive. Meanwhile, creative composition commands ("draw a cat") route to complex but get a template-only prompt that produces single shapes instead of multi-shape drawings.

## Solution

2-tier keyword-based router with an enriched complex prompt that handles templates, creative composition, and layout/manipulation commands.

### Tier 1 — Simple

- **Model:** Haiku / GPT-4o-mini
- **Tokens:** 2048
- **Prompt:** Minimal single-tool guidance
- **Routes when ALL true:** simple verb + explicit board primitive + < 100 chars + no qualifiers

### Tier 2 — Complex (default)

- **Model:** Sonnet / GPT-4.1
- **Tokens:** 4096
- **Prompt:** Rich guidance covering templates, creative composition, layout, and manipulation
- **Routes:** Everything else

### Classifier Logic

1. Check explicit complex keywords first (swot, grid, arrange, retro, etc.) → complex
2. Check NxM patterns, N stages/columns → complex
3. Check if prompt names a board primitive + simple verb + short + no qualifiers → simple
4. Default → complex

### Complex Prompt Additions

1. **Creative composition:** Compose drawings from multiple shapes. Circles for round features, rectangles for bodies, lines for details.
2. **Litigation-themed defaults:** When templates don't specify content, use litigation placeholders.
3. **Layout/manipulation:** Call getBoardState first, compute positions mathematically.

### Evaluation Routing Table

| Prompt | Route |
|--------|-------|
| "Add a yellow sticky note that says 'User Research'" | Simple |
| "Create a blue rectangle at position 100, 200" | Simple |
| "Add a frame called 'Sprint Planning'" | Simple |
| "Change the sticky note color to green" | Simple |
| "Move all the pink sticky notes to the right side" | Complex |
| "Resize the frame to fit its contents" | Complex |
| "Arrange these sticky notes in a grid" | Complex |
| "Create a 2x3 grid of sticky notes for pros and cons" | Complex |
| "Space these elements evenly" | Complex |
| "Create a SWOT analysis template with four quadrants" | Complex |
| "Build a user journey map with 5 stages" | Complex |
| "Set up a retrospective board" | Complex |
| "Draw a cat" | Complex |

### Files Changed

- `api/ai/generate.ts` — classifier function + complex system prompt
