# The Good Couch — Lead Automation App

Automates the lead lifecycle for a couch-pickup resale business: website form → AI-assisted
texting (Quo) → owner-approved disposition → quote → Todoist scheduling.

See `goodcouchappspec.md`-style project brief for full product context. This repo is being
built incrementally following the suggested session order:

1. **Repo scaffold + Postgres schema + migrations** ← this session
2. Quo webhook receiver + outbound send endpoint
3. Lead intake endpoint + basic dashboard (read-only)
4. Condition assessment extraction (AI)
5. Disposition suggestion (AI) + approval UI
6. Quote send + accept/decline/counter handling
7. Todoist integration on acceptance
8. Playbook/example-transcript tuning

## Repo layout

```
server/           Node.js + TypeScript + Express API
  src/
    config/       Environment loading
    db/           Postgres pool + migrations (node-pg-migrate)
    routes/       Express route handlers
    app.ts        Express app wiring
    index.ts      Process entrypoint
```

A `web/` workspace (React + TypeScript dashboard) will be added in the session that builds
the dashboard (step 3 in the build order above).

## Prerequisites

- Node.js 20+
- A running Postgres instance (local or managed)

## Setup

```bash
npm install
cp server/.env.example server/.env
# edit server/.env and set DATABASE_URL (and other secrets as they're needed)
```

## Database migrations

Migrations live in `server/src/db/migrations` and are run with
[node-pg-migrate](https://github.com/salsita/node-pg-migrate).

```bash
npm run migrate        # apply all pending migrations
npm run migrate:down   # roll back the most recent migration
```

Current schema (see `server/src/db/migrations`):

- `leads` — core lead record and status
- `conversation_messages` — inbound/outbound Quo message log
- `condition_assessments` — extracted couch condition info per lead
- `dispositions` — free/mileage/full suggestions and owner approvals
- `quote_responses` — customer accept/decline/counter on a sent quote
- `schedule_slots` — Todoist pickup task linkage

## Running the API

```bash
npm run dev
```

Starts the Express server on `PORT` (default `3000`) with a `GET /health` endpoint that
checks DB connectivity.

## Secrets

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `ANTHROPIC_API_KEY` | Claude API — conversation drafting, extraction, disposition suggestion |
| `QUO_API_KEY` | Quo texting API |
| `TODOIST_API_TOKEN` | Todoist scheduling API |
