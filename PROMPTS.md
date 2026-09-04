# Prompts and task breakdowns used

This build was driven by specific, scoped prompts to Claude Code rather
than open-ended requests. Below are the ones that most shaped the final
architecture, in roughly the order they were used. Minor follow-up
clarifications and one-line fixes are omitted for length; these are the
ones that defined a real piece of the system.

## Scaffolding

```
Scaffold this project from scratch based on CLAUDE.md:

1. Next.js 14 app (App Router, TypeScript) in the root
2. A separate /verification-service folder with a FastAPI app (Python)
3. Set up Prisma with the schema below, using Postgres
4. Basic folder structure only — don't implement business logic yet,
   just get both apps running with a health-check route each
5. A root README with setup/run instructions for both services

Ask me before installing anything unusual or making structural
decisions not covered in CLAUDE.md.
```

## Verification scoring service (route plumbing only — scoring logic written by hand)

```
I've already created the scoring function myself (score_visit / 
haversine_meters), per CLAUDE.md — scoring logic is mine, not AI's. 
Implement POST /score: parse the request, call my function, validate 
the result back into the response shape. Don't modify the scoring 
logic itself, only the request/response plumbing around it.
```

## Session state machine (transitions written by hand, routes generated)

```
I've already created lib/sessionTransitions.ts myself with my state 
machine logic, per CLAUDE.md. Scaffold these routes AROUND it — call 
its functions for all state logic, don't reimplement any transition 
rules in the route handlers:

GET /api/sessions/[id], POST .../start, .../ping, .../end, .../report

All routes: validate the session exists (404 if not), return clear 
error messages on InvalidTransitionError (400, not 500).
```

## Live business dashboard (SSE)

```
Build the business dashboard with live updates via SSE.

1. Create src/lib/sessionEvents.ts: an in-memory event emitter with 
   emit(sessionId) and subscribe(callback)
2. Emit on every route that changes session state
3. GET /api/dashboard/sessions and GET /api/dashboard/stream (SSE)
4. A dashboard page that opens an EventSource and updates in place, 
   no full refetch

Don't reimplement any session state transition logic, just read and 
display what's already in the database.
```

## Participant-facing session page

```
Build the participant-facing session page at src/app/session/[id]/page.tsx.

Behavior by session state (ASSIGNED/ACTIVE/ENDED/final), including:
- watchPosition while ACTIVE, pinging every 20s
- Permission-denied handling: show a clear message, let the session 
  continue rather than blocking
- Poor GPS accuracy (>100m): visible warning, non-blocking
- Don't reimplement any state transition logic

Verify for real: click through the actual flow in a browser, confirm 
the location prompt fires and pings actually reach the server.
```

## Task creation (added after auditing the build against the brief)

```
Add task creation to the business dashboard.

1. POST /api/dashboard/tasks — creates a Task, no session yet
2. POST /api/dashboard/tasks/[id]/assign — upserts a Participant by 
   email, creates a Session in ASSIGNED state, returns the session ID
3. A Create Task form (plain lat/lng number inputs, no map picker — 
   out of scope) and an assign mini-form per task, showing the 
   resulting shareable session link

Verify for real: create a task, assign it, confirm the generated 
session link actually resolves.
```

## Live proximity check (closing a real spec-compliance gap)

```
Add a live proximity check that runs while a session is ACTIVE, per 
the spec's step 3.

1. On every ping, compute haversine distance to the task's target, 
   store lastPingDistanceMeters and lastPingInRange on Session
2. This is a lightweight geometric primitive, NOT the confidence-
   scoring algorithm — keep it in plain TS, don't call FastAPI for it
3. Surface it live on the business dashboard only
4. Do NOT expose this to the participant-facing page at all — no 
   distance, no in-range signal. This is intentional: showing it to 
   the participant would let them game the check.

Verify for real: ping from coordinates far from target, confirm 
out-of-range shows live on the dashboard; ping from within radius, 
confirm it flips live via SSE. Confirm the participant page shows no 
trace of this data.
```

## Offline ping resilience

```
Add local ping resilience to the participant session page, answering 
the brief's explicit question about connection loss.

1. Queue failed pings in localStorage (network failures only, not bad 
   HTTP statuses — those can't be fixed by retrying)
2. Flush on the browser's online event and a periodic interval
3. Show a small "N pings queued" indicator

Verify for real: simulate a network outage (DevTools offline / 
Playwright setOffline), confirm pings queue instead of dropping, 
confirm they land in the database once reconnected.
```

## Fixing the report-submission rollback (second pass, after the first fix was found to be unverified)

```
Review the report route. The rollback-on-scoring-failure logic does 
not appear to be triggering correctly — a real repro left a session 
permanently stuck. Find and fix the bug. Then verify it for real, not 
just by reading the code:

1. Stop the verification service
2. Submit a report, confirm 502 and confirm the session state actually 
   reverted (not stuck)
3. Restart the service, retry, confirm it now succeeds cleanly

Report the actual before/after session state you observed at each 
step, not just that the code looks right.
```

## A note on the pattern behind these prompts

The common thread across most of these, especially from the midpoint of
the build onward, is an explicit verification step baked into the
prompt itself: "verify for real," "confirm via git status," "report
what you actually observed." This wasn't incidental — an early fix (the
report-submission rollback) was type-checked and spot-tested but never
proven against a real induced failure, and it turned out not to
actually work. After that, every subsequent prompt for anything
state-changing or failure-mode-related asked for a scripted real
reproduction before being called done, not just a clean build.
