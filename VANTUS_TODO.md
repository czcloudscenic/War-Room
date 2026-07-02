# Vantus — Status Board

> Updated 2026-07-01. Status: ✅ shipped+live · ◐ built, needs data/verify · ☐ not started · ⏸ parked

---

## ✅ Shipped & live (usevantus.com)

**Fulfillment OS**
- **Clients** — CRM home: per-client workspace card (setup %, status counts, POC, activity).
- **Setup** — data-entry cockpit: retainers/scope, connected-account→client mapping, bulk owner+due-date assignment, team roster edit.
- **Ledger** — deliverables board (owner, due date, approval state, "did it post?" check).
- **Reports** — delivery KPIs (first-pass approval %, on-time %, posting rate, avg revisions).
- **Operations** — task board + team roster; AI Assign; daily overdue **chase cron** (`chase-overdue-tasks`).
- **Client Analytics** — MRR, revenue trend chart, reach per client, delivery health.
- **Billing** — invoices + **Stripe wired** (`billing-stripe.js`): hosted invoices on send, webhook auto-marks paid.
- Approval loop (`src/core/approvals.js`), Brand Manager (per-client pillars/dos/donts → agent context).

**Infra / cleanup**
- Multi-tenant RLS locked on every table (verified anon = 0 rows).
- Code-split + null-guard sweep; route-chunk prefetch for instant nav (~531KB bundle).
- Owner-assign migration `20260701_assigned_to_team_members.sql` (assigned_to → team_members).
- Removed pages: Ad ROI Hub, References, ArtGrid, Cost Governance, Ideal Customer, Competitor Intel, Analytics.
- Removed Artgrid agent (team = Sean/Muse/Scrappy). Deleted `tools/`. `npm audit` clean.

## ◐ Built — needs data or verification

- **P0 data entry** (Christian): retainers per client, social-account→client mappings, deliverable owners+due dates, real team roster. Pages read light until entered — do it on the **Setup** page.
- **Stripe create-path** unproven — first real invoice validates it (test skipped 2026-07-01). Each client needs `primary_email`.

## ⏸ Parked (fully scoped, pull forward anytime)

- **ClientView** — external client self-approval portal (backend 100% built; old UI in `ripped out features/client-view/`).
- **Unified Inbox** — Slack-first, then email/IG DM/SMS. Mostly greenfield.
- **Content Template Engine** — the two viral prompts (Content Analyzer + Script Template Builder) → Template Library feeding Idea Engine.
- **Auto-posting** — needs a platform Content Publishing API + per-client tokens (separate infra).
- **In-page customization** — per-page config (columns/KPIs/sections). Design pass planned.

## Notes

- Placeholder apps kept for now: **Scraping Ops**, **Automation Center** (empty `AppPlaceholder` shells).
- `ripped out features/analytics-page/` — extracted Analytics page for reuse elsewhere; delete once ported.
- Deploy: founder pushes `main`; Netlify auto-deploys. Shell can't reach keychain → one-shot PAT per push.
