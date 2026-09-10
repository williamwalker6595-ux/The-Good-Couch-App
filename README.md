# The Good Couch — Lead Automation App

Automates the lead lifecycle for a couch-pickup resale business: website form → AI-assisted
texting (Quo) → owner-approved disposition → quote → Todoist scheduling.

See `goodcouchappspec.md`-style project brief for full product context. This repo is being
built incrementally following the suggested session order:

1. **Repo scaffold + Postgres schema + migrations**
2. **Quo webhook receiver + outbound send endpoint**
3. **Lead intake endpoint + basic dashboard (read-only)**
4. **Condition assessment extraction (AI)** ← this session
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

web/               React + TypeScript dashboard (Vite)
  src/
    api.ts         Typed fetch client for the backend's read-only endpoints
    pages/         LeadListPage, LeadDetailPage
    components/    Shared UI pieces (StatusBadge)
```

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

API endpoints so far:

- `POST /webhooks/lead-intake` — creates a lead from a website form submission (name, phone,
  address, source)
- `GET /leads` — list leads, optional `?status=` filter
- `GET /leads/:leadId` — lead detail
- `GET /leads/:leadId/messages` — conversation thread (also `POST` to send an outbound message)
- `GET /leads/:leadId/condition-assessment` — latest condition assessment, or `null`
- `POST /leads/:leadId/condition-assessment/extract` — re-run AI extraction now and store a
  new condition assessment (requires `ANTHROPIC_API_KEY`)
- `GET /leads/:leadId/disposition` — latest disposition, or `null`
- `POST /webhooks/quo` — Quo inbound message webhook (also auto-runs condition extraction for
  the lead after logging the message, if `ANTHROPIC_API_KEY` is set)

## AI condition extraction

`server/src/ai/conditionExtraction.ts` sends the lead's full conversation transcript to
Claude (`claude-opus-5`, via `output_config.format` + a Zod schema for guaranteed-shape JSON)
and extracts `smoking_household`, `pets`, `blemishes`, `odors`, `stains`, `notes`,
`pickup_address`, and `seat_count`. Only information explicitly stated in the conversation is
extracted — the model is instructed to use `null` rather than guess (the last two fields feed
the quote calculator below, so they're held to an even stricter "only if unambiguous" bar).
`photo_refs` is populated directly from the inbound messages' media URLs (not model-generated,
to avoid hallucinated links). Each run inserts a new `condition_assessments` row rather than
overwriting the previous one, so the history is kept. A newly-extracted `pickup_address` is
written to the lead's `address` column, but only if one isn't already on file.

Without `ANTHROPIC_API_KEY` set, the webhook still logs messages normally — extraction is
just skipped (logged once as a warning-free no-op check, not an error).

## Pickup fee calculator

`server/src/quotes/calculateQuote.ts` computes the exact fee for `mileage`/`full`
dispositions once a lead has an address (and, for `full`, a `seat_count`):

- **Mileage**: `$3/mi × driving distance + $20`
- **Full**: `$3/mi × driving distance + $40 + $20 × seat/section count`

Driving distance comes from the Google Maps Distance Matrix API (real road distance, not
straight-line), from the shop address (`8475 W Colfax Ave, Lakewood, CO`, a constant in that
file) to the lead's address. The AI in `dispositionSuggestion.ts` still decides *which* type
applies (free/mileage/full) from playbook signals — the calculator only replaces the dollar
figure once that type is chosen. If the address or seat count isn't available yet, or the
Maps API call fails, the suggestion keeps the AI's rough estimate but flags it in `reasoning`
and caps `confidence` at 0.4 so it's obviously unverified in the approval UI.

## Running the dashboard

```bash
npm run dev:web
```

Starts the Vite dev server (default `http://localhost:5173`) pointed at the API via
`web/.env.development`'s `VITE_API_BASE_URL` (defaults to `http://localhost:3000`). It's a
read-only view for now: a lead list with a status filter, and a lead detail page showing the
conversation thread, condition assessment, and suggested disposition (empty states until the
AI extraction/disposition sessions are built).

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
| `GOOGLE_MAPS_API_KEY` | Distance Matrix API — driving-distance pickup fee calculation. Enable "Distance Matrix API" and billing on the Google Cloud project the key belongs to. |

## Deploying to Railway

The repo is an npm workspaces monorepo (root + `server/`), so build/start must run from the
**repository root**, not from `server/` — a root-level `railway.json` pins this explicitly
(`npm run build` to build, `npm run start` to run), so Nixpacks doesn't have to guess.

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

### Deploying the dashboard

The dashboard (`web/`) is a separate Railway **service** in the same project, built as a
static site and served by the `serve` package — it is not part of the API server's deploy.
Vite bakes `VITE_API_BASE_URL` into the built JS at build time, so it must be set on this
service (not the server service) before building.

Both services build from the same repo root, but they need **different** build/start commands.
The server's commands live in the root `railway.json`, which Railway applies by default — if
the dashboard service is only told its commands via the Settings → Build/Deploy text fields
(not a committed config file), an auto-deploy can silently fall back to the root `railway.json`
(the server's commands) instead, breaking the dashboard until you manually redeploy. To avoid
that, point the dashboard service at its own committed config file, `railway.web.json`, instead
of typing the commands into the UI:

1. In the same Railway project, add a new service from the same GitHub repo.
2. Leave this service's **Root Directory** blank (repo root) — same as the server service.
   Building from `web/` in isolation hits a real npm bug with Vite/Rolldown's native
   optional-dependency binaries (npm/cli#4828) because there's no lockfile scoped to `web/`
   alone; building from root uses the same resolved root `package-lock.json` the server
   build already uses successfully.
3. In this service's **Settings → Config as Code** (or **Source**, depending on Railway's
   current UI), set the **Config File Path** to `railway.web.json`. Leave the Build/Deploy
   custom command fields blank — the config file, not the UI fields, should be the source of
   truth, so it survives every deploy (push-triggered or manual) consistently.
4. Set `VITE_API_BASE_URL` on this service to the server service's public URL, e.g.
   `https://<server-service>.up.railway.app` (no trailing slash). Find that URL on the server
   service's Settings → Networking tab. Vite bakes this into the built JS at build time, so
   it must be set before deploying.
5. Deploy. Under Settings → Networking on this new service, generate a public domain — that
   URL is the dashboard.

If your dashboard service was set up before this change (with the commands typed into the
Build/Deploy fields), switch it to `railway.web.json` via Config File Path and clear the old
custom command fields — otherwise the two can still drift out of sync.
