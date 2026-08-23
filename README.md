# The Good Couch — Lead Automation App

Automates the lead lifecycle for a couch-pickup resale business: website form → AI-assisted
texting (Quo) → owner-approved disposition → quote → Todoist scheduling.

See `goodcouchappspec.md`-style project brief for full product context. This repo is being
built incrementally following the suggested session order:

1. **Repo scaffold + Postgres schema + migrations**
2. **Quo webhook receiver + outbound send endpoint** ← this session
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
| `QUO_FROM_NUMBER` | Your Quo business number (E.164), used as the default outbound sender |
| `QUO_WEBHOOK_SIGNING_KEY` | `whsec_...` secret shown when you create the webhook in the Quo dashboard |
| `QUO_API_BASE_URL` | Override only if Quo's API host differs from the default (`https://api.quo.com`) |
| `TODOIST_API_TOKEN` | Todoist scheduling API |

## Deploying to Railway

The repo is an npm workspaces monorepo (root + `server/`), so build/start must run from the
**repository root**, not from `server/` — a root-level `railway.json` pins this explicitly
(`npm ci && npm run build` to build, `npm run start` to run), so Nixpacks doesn't have to guess.

1. Create a new Railway project from this GitHub repo. Leave the service's **Root Directory**
   at the repo root (blank/default) — do not point it at `server/`, or the workspace install
   will break.
2. Add a Postgres plugin/service in the same Railway project; it sets `DATABASE_URL`
   automatically for services in that project.
3. Set the remaining secrets from the table above as environment variables on the service.
4. After the first successful deploy, run migrations once against the Railway Postgres
   instance — either via `railway run npm run migrate` (Railway CLI) or a one-off shell in the
   Railway dashboard. Re-run it after every deploy that adds new migration files.
5. Once deployed, register a webhook in the Quo dashboard pointed at
   `https://<your-railway-url>/webhooks/quo`, subscribed to `message.received`, and copy its
   `whsec_...` signing key into `QUO_WEBHOOK_SIGNING_KEY`.
