# Phase I Checkpoint Log

| Story | Commit | Frontend URL | Socket URL | Local Validation | User Checkpoint | Status | Notes |
|---|---|---|---|---|---|---|---|
| US-00 | Uncommitted | https://collab-board-h4cqo9jgj-thisisyoussefs-projects.vercel.app | N/A (starts US-02) | build+lint pass | Approved | Approved | Docs/env pivot + story scaffold done |
| US-01 | Uncommitted | https://collab-board-iota.vercel.app | N/A (starts US-02) | build+lint pass | Passed | Approved | Scope upgraded to product flow: login + dashboard + board CRUD + protected board shell; fix-forward includes create/open reliability, rename responsiveness, Firestore timeout handling, and Firestore Lite transport fallback. Firestore DB/rules and auth domain validated in project setup. |
| US-02 | Uncommitted | https://collab-board-iota.vercel.app | https://collab-board-0948.onrender.com | build+lint pass; server /health and auth-fail path validated locally | Pending | In Progress | `server/` Socket.IO + Firebase token middleware implemented; frontend `useSocket` + topbar connection status deployed. Vercel socket URL configured and redeployed; waiting for final Render Firebase Admin env verification + user checkpoint test. |
| US-03 | fa0bd1c | https://collab-board-iota.vercel.app | https://collab-board-0948.onrender.com | lint+test+build pass | Pending | In Progress | Presence room flow + topbar avatars implemented (`join-board`, `presence:snapshot`, `user:joined`, `user:left`); pushed to `main` and manually deployed to Vercel production alias; waiting for manual multi-tab checkpoint. |
| US-04 | 99e5571 | https://collab-board-iota.vercel.app | https://collab-board-0948.onrender.com | lint+test+build pass | Passed (follow-up logged) | Approved | Cursor sync implemented with Socket.IO volatile transport, Konva remote cursor layer, 50ms client throttle, and latency metrics overlay; pushed to `main` and manually deployed to Vercel production alias. Follow-ups tracked in `docs/user-stories/post-story-followups.md` for stale cursor on tab blur and minor latency spikes. |
| US-05 |  |  |  |  |  | Pending |  |
| US-06 |  |  |  |  |  | Pending |  |
| US-07 |  |  |  |  |  | Pending |  |
