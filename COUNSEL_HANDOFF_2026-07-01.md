# Vantus — Counsel Handoff (2026-07-01)

Handoff from the Counsel session that built the Fulfillment OS + Operations + Agency pages. **Everything below is committed to `main` and live on usevantus.com.** Working tree is clean except two non-code stragglers (`Videos/`, `sprint-recap.html`). Read this, then pick up from the Backlog.

---

## 1. Current state (TL;DR)

- **All work is pushed + deployed.** Latest commit on `main`: `897713e`.
- **All 10 migrations are applied to prod Supabase (`wjcstqqihtebkpyuacop`) and verified** (anon-read checks return 0 rows on locked tables).
- **Every table is RLS-locked** — no more legacy `anon using(true)` policies anywhere. Verified.
- The app builds clean (`npm run build`). Bundle is 741KB single chunk (perf debt, not urgent).

## 2. What shipped this session (commits on `main`)

| Commit | What |
|---|---|
| `67bd700` | Fulfillment OS P1–4: Deliverables **Ledger**, **Approval loop**, **Client scope**, **Brand Manager** |
| `68d6613` | Fulfillment **Reports** (P5) — delivery KPIs |
| `8d26a5b` | **Operations** (AI Assign / Tasks / Team) + security: clients & agent_events lockdown + content client_id backfill |
| `897713e` | Hardening pass + **Client Analytics** + **Billing** (Stripe-ready) |

## 3. New surface (so you know what exists)

**Routes** (`src/ui/routes/`): `LedgerRoute`, `ReportsRoute`, `OperationsRoute`, `ClientAnalyticsRoute`, `BillingRoute`. All prop-driven, inline-styled per `docs/UI_RULES.md`, wired in `src/App.jsx` via `activeNav===` blocks.

**Nav** (`src/utils/constants.js`): COMMAND gained ledger/reports/clientanalytics/operations; new **FINANCE** section holds billing.

**Backend** (`netlify/functions/`): `ops_assign` handler in `agent-action.js` (dump task list → Claude scores + assigns by skill); `getBrandContext` now enriches `brand.voice` with structured pillars/dos/donts (every agent on-brand); `billing-stripe.js` = **STUB, unwired** Stripe seam.

**Frontend helper**: `src/core/approvals.js` (recordApproval / setLedgerFields / markPosted).

**New tables**: `approvals`, `team_members`, `tasks`, `invoices`, `stripe_customers`. **Columns added**: `content_items` (assigned_to, due_date, billable, in_scope, approval_mode, posted_at, platform_post_id, revision_count); `clients` (lane, service_scope, cadence, approval_rule, retainer_amount/status, contacts, onboarding_progress, health, notes, brand_pillars/dos/donts); `connected_accounts` (client_id).

**RLS pattern used everywhere**: admin = `auth.jwt()->>'email' like '%@cloudscenic.com'`; client-scoped = `exists(select 1 from client_users cu where lower(cu.email)=lower(jwt email) and cu.status='approved' and cu.client_id = <table>.client_id)`. Reuse this for any new table.

## 4. Backlog (prioritized)

### P0 — Highest leverage: the tools are built but STARVED OF DATA
Analytics/Billing/Ledger read **zeros** until this is entered (mostly Christian's data-entry, but a bulk-fill UI would help):
- Client **retainers + scope** per client (Edit Client modal) → drives MRR everywhere.
- Map **connected_accounts → client_id** → per-client reach in Analytics.
- Assign deliverable **owners + due dates** → Ledger/Reports health.
- Edit the **team roster** (seeded from mockup) to the real team.

### P1 — Functional gaps worth building
- **AI Assign "chase"**: a scheduled Netlify function (cron) that finds overdue `tasks` and fires `notify.js` to assignee + Danny. Portal promised it; not built.
- **MRR trend chart** in Client Analytics (time-series; `AnalyticsRoute.jsx` has chart boilerplate to reuse).
- **Invoice email**: wire `notify.js` for a real invoice-sent email (currently deferred; see Billing note).

### P2 — Deferred by decision (need infra / owner input)
- **Unified Inbox** (6th portal page) — needs channel integrations (Slack read, inbound email, IG DM, SMS). Slack-first is the recommended entry.
- **Stripe wiring** — Billing is manual; `billing-stripe.js` + `stripe_*` columns are ready. Final flip: add `STRIPE_SECRET_KEY` + `npm i stripe`, implement create-invoice + webhook. No schema change.
- **Auto-posting** — Vantus syncs analytics but can't publish; "Posted" is manual (Mark Posted). Needs platform Content Publishing API.
- **External client approval** — `ClientView` was ripped 6/01; clients can't self-approve. Rebuild if you want the client-facing loop.
- **Perf** — code-split heavy routes (`React.lazy` + `Suspense`).
- **Contracts → auto-invoice** and the **generator suite** (9 portal prompt templates) — never pulled in.

### P3 — Verify (fast)
Live smoke-tests not yet confirmed: AI Assign routing a real task, Billing create-invoice, Analytics MRR reading retainers. Empty-state click-through of all routes.

## 5. Suggested split — Vantus terminal vs Codex

**Give to Codex** (mechanical, well-specified, low-judgment — grunt work on `codex/grunt-<date>` branches):
- **Perf code-splitting** — `React.lazy`/`Suspense` on Ledger/Reports/Operations/Analytics/Billing routes. Pure mechanical.
- **AI Assign "chase" cron** — scheduled function: query overdue `tasks` → call `notify.js`. Well-defined I/O.
- **MRR trend chart** — add a time-series chart to Client Analytics using the existing `AnalyticsRoute` chart boilerplate.
- **Defensive QA sweep** — add null-guards / optional chaining across routes (the audit flagged a few); low-risk hardening.
- **Invoice email in notify.js** — once the copy/spec is given, it's a mechanical add.

**Keep on the Vantus terminal** (judgment / design / security / integration):
- **Unified Inbox** — architecture + channel-integration decisions.
- **Stripe wiring** — secrets, webhooks, payment correctness. Do NOT hand raw keys to Codex.
- **External client approval / ClientView** — auth + security surface.
- Any **design-sensitive UI** — needs the aesthetic judgment (Refero-locked, no AI slop).
- The **P0 data-entry UX** (bulk-fill / setup checklist) — product judgment.

**Codex caveats**: separate 5h burst (gpt-5.5) + weekly limits; auto-downgrades to gpt-5.4-mini when burst is spent — check `/status` first, plan hefty jobs in a burst window. It works on its own branch, so `git fetch` + review before merging to `main`.

## 6. Guardrails / coordination
- **Founder pushes only** — main auto-deploys. Commit locally; Christian pushes (one-shot PAT; shell can't reach keychain).
- **Migrations apply via the Supabase SQL editor** (project `wjcstqqihtebkpyuacop`) — the shell has no service key / DB connection. Additive + idempotent; verify with an anon-read check after.
- **Shared repo** — Counsel and this terminal both touch `main`; `git fetch` before committing.
- Design baseline: `docs/UI_RULES.md` (bg #0d0907, Instrument Serif italic headings, Geist Mono data labels, agent colors). Pure-black Whop, no AI slop.
