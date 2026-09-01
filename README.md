# Mystery-shopping visit verification (thin slice)

Two services:

- **Next.js 14** (App Router, TypeScript) — root of this repo. Business
  dashboard, participant-facing app, and API routes. Uses Prisma to talk
  to Postgres directly for CRUD; calls the verification service over
  HTTP for anything scoring-related.
- **verification-service** (`/verification-service`) — FastAPI (Python).
  Owns all verification/scoring logic. Next.js never reimplements this
  logic in TypeScript (see [CLAUDE.md](./CLAUDE.md)).

See [CLAUDE.md](./CLAUDE.md) for architecture decisions and the session state machine.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- A running Postgres instance

## 1. Postgres

Point `DATABASE_URL` at a running Postgres database. Copy the example
env file and adjust as needed:

```bash
cp .env.example .env
```

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
