# Submission Artifacts (Phase III)

This folder tracks the final submission package required by the PRD.

## Artifact Index

| Deliverable | Required by PRD | Path | Status | Notes |
|---|---|---|---|---|
| GitHub repository + setup + architecture + deployed link | Yes | [README.md](../../README.md) | Complete | Live URL, conflict resolution, setup instructions, architecture diagram |
| Demo video (3-5 min) | Yes | [demo-video-notes.md](demo-video-notes.md) | Drafted | Record and add hosted video URL before final submission |
| Pre-Search document | Yes | [pre-search.md](../pre-search.md) | Complete | Architecture decisions documented |
| AI Development Log (1 page) | Yes | [ai-development-log.md](ai-development-log.md) | Complete | CLAUDE.md-driven workflow, MCP usage, prompts, code analysis |
| AI Cost Analysis | Yes | [ai-cost-analysis.md](ai-cost-analysis.md) | Complete | Dev costs + projections (100-100K users) + sensitivity analysis |
| Deployed application (public) | Yes | [https://collab-board-iota.vercel.app](https://collab-board-iota.vercel.app) | Complete | Production on Vercel |
| Deployed realtime backend | Supporting | [https://collab-board-0948.onrender.com](https://collab-board-0948.onrender.com) | Complete | Socket.IO on Render (free tier, 30s cold start) |
| Social post (X or LinkedIn) | Yes | [social-post-draft.md](social-post-draft.md) | Ready to Post | Drafts finalized with live links, publish before submission |
| AI A/B benchmark reports | Supporting | [ab-results/](ab-results/) | Complete | Multi-provider benchmark via GitHub Actions + Vercel endpoint |

## Final Pre-Submit Checklist

1. [x] Phase II + Phase III checkpoints marked complete
2. [x] Public frontend URL, socket URL, and auth flow working
3. [ ] Record final video URL in this file
4. [x] Replace all `TODO` placeholders in artifact docs
5. [x] `npm run lint && npm test && npm run build` pass
6. [x] Social post includes: project summary, core features, demo proof, and `@GauntletAI`

## Final Links

- Final demo video URL: `TODO — record before submission`
- Final repository URL: https://github.com/thisisyoussef/collab-board
- Final social post URL: `TODO — publish before submission`
