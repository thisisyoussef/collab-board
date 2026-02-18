# Phase I Checkpoint Log

| Story | Commit | Frontend URL | Socket URL | Local Validation | User Checkpoint | Status | Notes |
|---|---|---|---|---|---|---|---|
| US-00 | Uncommitted | https://collab-board-h4cqo9jgj-thisisyoussefs-projects.vercel.app | N/A (starts US-02) | build+lint pass | Approved | Approved | Docs/env pivot + story scaffold done |
| US-01 | Uncommitted | https://collab-board-iota.vercel.app | N/A (starts US-02) | build+lint pass | Passed | Approved | Scope upgraded to product flow: login + dashboard + board CRUD + protected board shell; fix-forward includes create/open reliability, rename responsiveness, Firestore timeout handling, and Firestore Lite transport fallback. Firestore DB/rules and auth domain validated in project setup. |
| US-02 | Uncommitted | https://collab-board-iota.vercel.app | Pending Render URL | build+lint pass; server /health and auth-fail path validated locally | Pending | In Progress | `server/` Socket.IO + Firebase token middleware implemented; frontend `useSocket` + topbar connection status deployed. Waiting for Render service deployment and Vercel `VITE_SOCKET_SERVER_URL` wiring. |
| US-03 |  |  |  |  |  | Pending |  |
| US-04 |  |  |  |  |  | Pending |  |
| US-05 |  |  |  |  |  | Pending |  |
| US-06 |  |  |  |  |  | Pending |  |
| US-07 |  |  |  |  |  | Pending |  |
