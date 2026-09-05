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

## Full visual design pass (design system + both pages redesigned)

```
Do a full visual design pass on the app. Keep all existing logic,
routes, and API calls untouched, this is styling only.

Design system (create src/lib/design-tokens or use Tailwind config):
neutral slate/zinc base, one accent color for primary actions,
color reserved for state only (green/amber/red/slate), real
typographic hierarchy, consistent spacing, rounded corners, subtle
borders instead of heavy shadows, no gradients or generic hero-blob
look.

Shared shell: a minimal shared header component shown on both
/dashboard and /session/[id] so both screens read as one product.

Business dashboard: replace the plain table with card-based rows —
task name prominent, state as a proper badge, confidence score with
a progress bar, a subtle flash animation on live SSE updates, and a
real empty state instead of a blank table.

Participant session page: a properly designed screen per state
(ASSIGNED/ACTIVE/ENDED/report form/final result), live location data
as a real status card, poor-accuracy warning visually distinct but
non-alarming, final result states visually distinct at a glance.

Don't touch: any API route, sessionTransitions.ts, the FastAPI
service, or any test file.
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

## Task-grouped dashboard view (replacing the flat session list)

```
Add a task-grouped view to the dashboard, replacing the flat session
list.

1. New route GET /api/dashboard/tasks-with-sessions — returns all
   Tasks, each with an array of their Sessions (participant, state,
   confidence score + reasons if resolved), most recent task first.
2. Redesign the dashboard's lower section: one card per Task, with
   its Sessions listed underneath — reuse the existing badge/
   ConfidenceBar components, not new ones.
3. A task with zero sessions yet should show clearly ("No
   participants assigned yet") rather than an empty gap.
4. Keep the existing SSE live-update behavior working — a session's
   row within its task card should still update live when verified,
   same as before.

Don't touch the Create Task form, the assign flow, or any session/
scoring logic. This is a read/display change to how existing data is
grouped and shown.

Verify this for real before calling it done: create two tasks at
different coordinates, assign 2-3 sessions across them (mix of
states), confirm the grouping actually renders correctly, and
confirm the SSE live-update still works on a session nested inside a
task card, not just at the top level.
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

## Closing the SSE-emit gaps on start/end and the lazy staleness check

Found by manually testing each transition individually after the ping/
report emit calls were already in place — each of these was its own
gap, not caught by the same fix.

```
Add sessionEvents.emit(sessionId) to the POST /api/sessions/[id]/start
and POST /api/sessions/[id]/end routes, matching the pattern already
used in ping and report. This should make the dashboard's
session-state badge (ASSIGNED → ACTIVE → ENDED) update live via SSE,
not just the final VERIFIED/FLAGGED/INCONCLUSIVE result. Don't touch
session state transition logic itself.

Verify for real: open the dashboard in one tab with SSE connected,
start and then end a session from another tab/curl, confirm the
state badge updates live in the first tab without reload at each
transition.
```

```
In GET /api/sessions/[id], when isStale() triggers the lazy
ACTIVE→ENDED transition, add sessionEvents.emit(sessionId) right
after that update, same pattern as start/end/ping/report. Don't
touch anything else.

Verify for real: set HEARTBEAT_TIMEOUT_MS to 15 seconds (temporary,
as before), open the dashboard in one tab with SSE connected, start a
session in another tab, wait ~20s without ending it, then trigger the
lazy check by loading the session page once. Confirm the dashboard
tab updates to Ended live, without a dashboard reload. Then revert
HEARTBEAT_TIMEOUT_MS back to 5 minutes and confirm via git diff that
only that one line changed back.
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
