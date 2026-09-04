# Mystery-shopping visit verification (thin slice)

Two services:

- **Next.js 14** (App Router, TypeScript) — root of this repo. Business
  dashboard, participant-facing app, and API routes. Uses Prisma to talk
  to Postgres directly for CRUD; calls the verification service over
  HTTP for anything scoring-related.
- **verification-service** (`/verification-service`) — FastAPI (Python).
  Owns all verification/scoring logic. Next.js never reimplements this
  logic in TypeScript (see [CLAUDE.md](./CLAUDE.md)).

> **Both services must be running at the same time**, in separate
> terminals, for the app to work end-to-end — the Next.js report route
> calls the verification service directly. If a report submission fails
> with a 502, check that the verification service is actually still
> running.

See [CLAUDE.md](./CLAUDE.md) for architecture decisions and the session state machine.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- A running Postgres instance

## 1. Environment variables

Copy the example env file and adjust as needed:

```bash
cp .env.example .env
```

Includes `DATABASE_URL` (point it at your running Postgres instance)
and `VERIFICATION_SERVICE_URL` (defaults to `http://localhost:8000` for
local dev — only change this if you run the verification service on a
different port or host).

## 2. Next.js app (root)

```bash
npm install
npx prisma generate   # regenerate the Prisma client after schema changes
npx prisma migrate dev --name init   # creates tables from prisma/schema.prisma
npm run dev
```

Runs on [http://localhost:3000](http://localhost:3000).

- Health check: `GET http://localhost:3000/api/health` → `{"status":"ok"}`

## 3. Verification service (`/verification-service`)

```bash
cd verification-service
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Runs on [http://localhost:8000](http://localhost:8000).

- Health check: `GET http://localhost:8000/health` → `{"status":"ok"}`

## Tests

Next.js (Vitest):

```bash
npm test
```

Verification service (pytest):

```bash
cd verification-service
pip install -r requirements-dev.txt   # adds pytest on top of requirements.txt
pytest
```

## Notes

- Prisma is pinned to `6.19.3`. Prisma 7 removed support for the
  `datasource { url = env("DATABASE_URL") }` syntax used in
  `prisma/schema.prisma` in favor of a `prisma.config.ts` + driver
  adapter setup — revisit that migration deliberately later rather than
  picking it up via an unpinned `npm install`.
- See [CLAUDE.md](./CLAUDE.md) for architecture decisions, the session
  state machine, and what's meant to be handed to AI vs. done by hand.

## Trying it out

1. Visit http://localhost:3000/dashboard
2. Use "Create Task" to add a task with a title, description, and
   target coordinates (get real lat/lng from Google Maps — right-click
   a location → copy coordinates)
3. Assign the task to a participant (any name/email) — this generates
   a shareable session link
4. Open that link to see the participant-facing flow: start the visit,
   allow location access, end the visit, submit a report
5. Watch the dashboard update live as the report is scored