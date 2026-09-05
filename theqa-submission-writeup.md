# Mystery-Shopping Visit Verification — System Design & Decision Log

## System overview

A working slice covering the full flow: task creation -> assignment ->
active session with live location tracking and live proximity checking
-> report submission -> automated confidence-scored verification -> live
business dashboard, grouped by task.

**Stack:** Next.js 14 (App Router, TypeScript) for the participant flow,
API routes, and business dashboard; a separate FastAPI (Python) service
owns confidence-scoring logic; Postgres via Prisma; Server-Sent Events
for live dashboard updates.

**Why a separate Python service for scoring**, rather than doing it in
Next.js: it's the one piece of genuinely non-trivial logic in the system
(proximity weighting, GPS-accuracy weighting, outlier/spoofing
detection), and keeping it behind an HTTP boundary means the algorithm
can be tested, versioned, and reasoned about independently of the
request/response plumbing around it. It also demonstrates the
TypeScript + Python requirement naturally rather than artificially.

*(Architecture diagram: see docs/architecture-diagram.svg)*

## The core design decision: confidence, not a boolean

Every session resolves to a `confidenceScore` (0-100) plus a
human-readable `reasons` list, mapped to `VERIFIED` (>=70),
`INCONCLUSIVE` (40-69), or `FLAGGED` (<40) -- never a bare yes/no.
Device GPS is spoofable, so treating "at the location" as a fact the
system can assert with certainty would overstate what the data
supports. A confidence score with a visible reasons trail gives the
business side something they can actually use to make a judgment call.

## Closing a real spec-compliance gap: checking proximity *while active*

On a re-read of the brief against what was actually built, I found the
proximity check was originally only computed retroactively, once, at
report-submission time -- not "while the session is active," as the
brief's step 3 explicitly requires. I closed this properly rather than
leaving it as a known gap:

- Every location ping now computes a live distance-to-target and
  in/out-of-range flag, stored on the session and pushed live to the
  **business dashboard** in real time.
- This is deliberately **not** shown to the participant. Surfacing a
  live "you're in range" signal to the person being checked would let
  them game it -- wait for green, then relax -- rather than genuinely
  complete the task. The business side having live visibility while a
  session is active satisfies the letter and spirit of the requirement
  without creating that incentive. Enforced not just in the UI but at
  the query level (the participant-facing API response has these
  fields explicitly omitted, verified by inspecting the raw JSON).
- Architecturally, this live check is a simple geometric primitive
  (haversine distance), computed directly in TypeScript rather than
  round-tripped to the Python service on every ping. I treat this as
  distinct from the "scoring logic" CLAUDE.md reserves for the Python
  service -- that's the weighted confidence algorithm (proximity %,
  accuracy weighting, outlier detection, report-text penalty) that runs
  once at report time. A live per-ping distance check is a different
  kind of computation, and adding a cross-service round trip every
  ~20 seconds for a one-line distance formula would be a real latency
  cost for no real benefit.

## Where I'd push back on the brief

The spec doesn't mention GPS spoofing, and I think that's a real gap
worth naming. Pure trust in device-reported GPS doesn't hold up "with
thousands of active sessions" without some abuse resistance. Two cheap
mitigations are in place -- flagging pings with an implausible speed
jump between consecutive readings, and the live proximity check itself
making the check continuous rather than a single retroactive snapshot --
but a real system would need more: mock-location detection, possibly
triangulation sanity checks against cell/WiFi data. Scoped out
explicitly as a known limitation, not silently ignored.

## How this would hold up at thousands of active sessions

Honestly: not well as-is, and I think naming that plainly is more useful
than pretending otherwise. The specific bottleneck is the SSE live-update
mechanism -- `sessionEvents` is an in-memory event emitter living inside
a single Next.js process. It works correctly for one server instance,
but it would not fan out across multiple instances behind a load
balancer, which is exactly what "thousands of active sessions" would
require. A dashboard client connected to instance A would never see an
event emitted from instance B.

The fix is well-understood and not architecturally disruptive: swap the
in-memory emitter for Redis pub/sub (or Postgres `LISTEN`/`NOTIFY`,
already available since Postgres is already in the stack) so any
instance can publish and any instance's SSE connections can subscribe.
I didn't build this because it adds real infrastructure (a Redis
instance, or non-trivial `LISTEN`/`NOTIFY` connection handling) for a
thin slice that's never actually running behind more than one process,
but it's the first thing I'd change before this went anywhere near
production scale.

The database and API layer scale more gracefully by comparison --
Postgres with proper indexing on `Session.state` and `Task.id` handles
thousands of rows without difficulty, and the stateless Next.js API
routes and FastAPI service both scale horizontally without code changes,
it's specifically the live-update fan-out that doesn't.

## Testing beyond the happy path

Everything below was verified against real conditions, not assumed:

- **Genuine `VERIFIED` from real device GPS** -- a task was created at
  real coordinates (via the dashboard's task-creation form, not the
  original seed data, which pointed at a landmark thousands of km from
  where testing actually happened -- a gap caught and fixed mid-build),
  walked through the full real browser flow, and produced a real
  80/100 confidence score from actual device pings, not synthetic data.
- **Location permission denied** -- tested by actually clicking "Block"
  on the browser's permission prompt. Session continues in a degraded
  state (clear warning shown, no crash), resolves cleanly to
  `FLAGGED`/"no location pings recorded."
- **Session auto-ending after inactivity** -- the 5-minute heartbeat
  timeout was verified by temporarily lowering it, triggering a real
  transition, and confirming both the state change and its live
  propagation to the dashboard, then reverted (confirmed via `git diff`
  that only the test value changed back).
- **A cross-service failure mid-request** -- the FastAPI scoring service
  going down between a report being recorded and its score being
  computed is a realistic production failure mode, not a hypothetical.
  Found via a real, unplanned outage during testing; the initial fix
  was insufficiently verified (looked correct, wasn't proven against a
  real induced failure) and only actually closed on a second pass, this
  time by scripting the real failure (kill the service, submit, confirm
  rollback, restart, retry, confirm success) before calling it done.
- **A recurring pattern, not a one-off**: the dashboard's live-update
  mechanism required an explicit "notify" call at *every* code path
  that changes session state -- session start, end, ping, report
  submission, and the lazy staleness check each needed their own call,
  and each gap was only found by manually testing that specific
  transition. This became a named principle applied consistently once
  recognized, rather than four separate bugs treated as unrelated.

## Decision log

**1. Confidence score + reasons, never a boolean "verified."**
Alternative considered: a simple pass/fail against a radius check.
Rejected because it overstates certainty the location data doesn't
support -- GPS is imprecise and spoofable, so a hard boolean would be
dishonest about what the system can actually know.

**2. Server-Sent Events for live dashboard updates, not WebSockets or
polling.** Alternatives considered: WebSockets (bidirectional, but the
dashboard only ever *receives* updates, never sends anything back) and
polling (simpler, but adds latency and needless repeated load).
Rejected both -- SSE fits a one-directional server-to-client stream
exactly, with less implementation overhead than WebSockets and less
latency than polling.

**3. Report submission had to survive the scoring service failing
mid-request, not just returning an error.** Alternative considered:
leave a failed scoring call as an opaque error with no cleanup (the
original, insufficiently-tested first attempt). Rejected once a real
outage during testing showed it left sessions permanently stuck --
a `Report` created but no path to retry. The corrected version wraps
the scoring call in a transaction-backed rollback (delete the orphaned
report, revert state to `ENDED`) and was verified against a scripted,
real service outage before being called done, not just read for
correctness.

**4. Live proximity checking is surfaced on the business dashboard,
not the participant view.** Alternative considered: show the
participant a live in-range/out-of-range signal directly. Rejected
because it would let them game the check -- wait until the signal
turns green, then stop making a genuine effort to be at the location.
The business side having live visibility while a session is active
satisfies the brief's "while active" proximity requirement without
creating that incentive.

**5. Auth is explicitly out of scope for this thin slice.**
Alternative considered: minimal ID-in-URL gating, or a full login
system. Rejected both -- the brief's flow never mentions auth, and
building even a minimal version would pull focus from the verification
logic actually being evaluated. Session links (with the ID embedded)
are the access mechanism instead; a real product obviously needs real
auth, and that gap is named rather than quietly ignored.

## AI process notes

Full CLAUDE.md is submitted as-used, unedited. Prompts and task
breakdowns used throughout the build are in `PROMPTS.md`.

**Where I overrode the agent, per my own CLAUDE.md**: the confidence-
scoring algorithm and all session state-machine logic were written by
me directly; Claude Code built the request/response plumbing around
code I supplied, consistent with what CLAUDE.md marks as "mine, not
AI's."

**Where the agent caught something I'd have missed**: a Prisma version
mismatch that would have broken the CLI mid-build; a nested FastAPI
entry point that broke my first run command; a missing `timestamp`
field in my own `/score` API spec; a Tailwind content-glob bug that
silently zeroed out every state color despite a fully green build,
caught only because it visually verified with a real screenshot instead
of trusting build output; and, repeatedly, root-causing "it looks
right" claims by actually scripting real failures (a killed service, a
denied permission prompt, a real network outage) rather than stopping
at a clean type-check.

**Where the agent was honest about its own limits**: it explicitly
flagged that it had no real browser available to it for testing
interactive permission prompts, and that it couldn't reliably freeze a
specific CSS animation frame via scripted screenshots -- both stated
plainly rather than claimed as verified when they weren't.
