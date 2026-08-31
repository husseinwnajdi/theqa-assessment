# Project: Mystery-shopping visit verification (thin slice)

## Stack
Next.js 14 (App Router, TypeScript), FastAPI (Python) for verification 
scoring, Postgres via Prisma, SSE for live dashboard updates.

## Architecture decisions (do not deviate without asking)
- Verification/scoring logic lives ONLY in the Python service. Next.js 
  calls it via HTTP, never reimplements scoring logic in TS.
- Sessions are a state machine: assigned -> active -> ended -> 
  report_submitted -> verified|flagged|inconclusive. Don't add states 
  without updating the diagram.
- "Verified" is never boolean. Always a confidence score (0-100) + 
  reasons array.
- Business dashboard updates via SSE, not polling, not WebSockets.
- Auto-end a session after N minutes without a location ping (heartbeat 
  timeout) instead of leaving it active indefinitely.

## What to hand off to AI vs do myself
- AI: boilerplate (CRUD routes, Prisma schema from my spec, component 
  scaffolding, test scaffolding)
- Me: scoring algorithm logic, state machine transitions, any 
  location-data handling/privacy notices, final review of anything AI 
  touches in the verification service

## Style
- No comments explaining obvious code
- Prefer explicit types over inference in exported functions
- Tag any non-trivial judgment call with // DECISION: <one line> so it's 
  easy to pull into the decision log later
