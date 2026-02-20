# AGENTS.md — collab-board

These instructions define the default behavior for this repository.

## Core Workflow Defaults

- Always use TDD for implementation work:
  - Write or update tests first.
  - Run tests and observe failure.
  - Implement minimal code to pass.
  - Refactor while keeping tests green.
- When resolving bugs, check logs before editing code:
  - Inspect relevant server logs, client/browser logs, test logs, and build/runtime error output.
  - Summarize concrete log evidence before proposing fixes.
- Before making any code changes for a review request, review the plan thoroughly and discuss tradeoffs first.

## Engineering Preferences (Must Guide Recommendations)

- DRY is important; flag repetition aggressively.
- Well-tested code is non-negotiable; prefer too many tests over too few.
- Code should be engineered enough: avoid fragile hacks and avoid premature abstraction.
- Prefer handling more edge cases, not fewer.
- Bias toward explicit over clever.

## Mandatory Interactive Review Flow

When the user asks for architecture/code-quality/test/performance review, use this sequence and do not skip gates.

### 0) Before starting any review section

Ask the user to choose exactly one:

1. BIG CHANGE: interactive review one section at a time (Architecture -> Code Quality -> Tests -> Performance), with at most 4 top issues per section.
2. SMALL CHANGE: interactive review with exactly one question/issue per section.

Do not proceed until the user picks one.

### 1) Section order and pacing

Review in this order only:

1. Architecture
2. Code Quality
3. Tests
4. Performance

After each section, pause and ask for user feedback/approval before moving to the next section.

### 2) Required analysis points by section

- Architecture: system design and boundaries, dependency graph/coupling, data flow bottlenecks, scaling and SPOFs, security architecture (auth/data access/API boundaries).
- Code Quality: organization/module structure, DRY violations, error handling and edge cases, technical debt, over- vs under-engineering.
- Tests: coverage gaps (unit/integration/e2e), assertion quality, missing edge-case tests, untested failure paths.
- Performance: N+1/database access patterns, memory concerns, caching opportunities, slow/high-complexity paths.

### 3) For every issue found

- Number issues (`Issue 1`, `Issue 2`, ...).
- Provide concrete file and line references.
- Provide 2-3 options labeled with letters (`A`, `B`, `C`), including "do nothing" when reasonable.
- For each option, include:
  - implementation effort
  - risk
  - impact on other code
  - maintenance burden
- Put the recommended option first.
- Give an opinionated recommendation and explain why using the engineering preferences above.
- Explicitly ask for user input before assuming direction.

### 4) Option labeling when asking follow-up questions

When asking the user to choose, clearly label each choice with both issue number and option letter (example: `Issue 2 - Option A`).

If an `AskUserQuestion` tool is unavailable, ask the same decision question explicitly in plain text and wait for the user response.
