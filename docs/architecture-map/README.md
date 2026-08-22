# Vantus — Architecture Map

> Snapshot **2026-08-21** · regenerated after the Phase D (Economics) ship.
> Interactive version: open `architecture-map.html` at the repo root, or `python3 -m http.server 4747` → http://localhost:4747/architecture-map.html

Vantus is Cloud Scenic's multi-tenant **agency fulfillment + billing OS**: a React 19 + Vite single-page app on Netlify (auto-deploys from `main`), Netlify serverless functions for everything privileged, and Supabase (Postgres + Auth + Storage + Realtime) as the data layer. It runs client delivery end to end — content pipeline with immutable approval receipts, AI agents with paper trails, billing, and a "truth layer" that proves what was approved and what actually published.

**54 nodes · 67 wires · 6 clusters.**

## Notable findings from this map

- 🔴 **All AI is down right now.** The Anthropic API account's prepaid credit balance is $0 (observed 2026-08-21, `netlify/functions/agent-action/_shared.js:161`). Every AI action — QC review, Muse, Scrappy, Content Intel, the new Scope Sentinel, AI Assign — returns an error until the account is topped up. One console action un-gates all of them.
- 🟡 **Email is ARMED.** Proven live end-to-end on 8/21 (`netlify/functions/notify.js:304`): approval links, reports, and digests really deliver from notifications@cloudscenic.com. There is no dry-run safety net anymore — the first client-facing send should be a deliberate moment.
- 🟡 **Stripe is installed but unproven.** Both keys sit in the production env as secrets, but they were flagged malformed on 7/12 and have never been validated since; the invoice create-path has never produced a real invoice (`netlify/functions/billing-stripe.js:22`).
- 🟡 **Drive upload has never worked in prod.** Google's OAuth client was never told `usevantus.com` is an authorized JavaScript origin (`index.html:11` loads the GIS script; the fix is one console field).
- **Dead/parked code located.** ShipWorld3D + its 3 world-modules and 2 legacy 2D renderers are in-repo but unmounted (deliberate — `src/ui/routes/ShipRoute.jsx:120`), plus the `ripped out features/` and `(experimental)/` archive folders.
- **Hot paths.** Everything client-side rides `src/App.jsx` (1,622 lines, all app state, no test suite), and every agent action rides the `netlify/functions/agent-action.js` dispatcher. These are the two files to be most careful in.
- **Two mirrored writers, on purpose.** Approval logic exists twice: browser-side `src/core/approvals.js` (recordApproval) and server-side `netlify/functions/approval-decision.js` (executeDecision). They capture the approved version on both paths and **must change together**.
- **Inert by design.** `verify-publishes`' auto-verify join is fully built but nothing writes `platform_post_id` yet (`netlify/functions/verify-publishes.js:13`) — it goes live with the Phase C Sprout wiring.

## Cluster overview

| Cluster | What lives there | Key nodes |
|---|---|---|
| **Client shell** | boot, auth, session plumbing | `index.html`, `App.jsx` (setupSession), `constants.js` NAV, `apiFetch` |
| **Routes (UI)** | one node per screen | Dashboard/Activation, Pipeline, Ledger+TruthDrawer, Approvals, Scope Sentinel*, Profitability*, Vault+Secrets*, Ship, Content Intel |
| **Core logic** | shared browser-side rules | approvals.js, versions.js, truth.js (stale-facts gate), audit.js, activation.js, ship sim |
| **Serverless** | 33 Netlify functions | agent-action dispatcher, notify, approval-decision, billing-stripe, vault-secrets*, sentinel*, 7-cron fleet, oauth/sync |
| **Data (Supabase)** | ~30 tables grouped | content spine, clients book, truth layer, intel tables, Phase D economics tables* |
| **External APIs** | third parties | Anthropic (blocked), Resend (live), Stripe (unproven), Slack, Google, IG/TikTok/YT, dynasty-lead-finder |

\* new on 2026-08-21 (Phase D).

## Files in this folder

- [critical-path.md](critical-path.md) — the approval-loop spine, step by step with file:line
- [nodes.md](nodes.md) — every node catalogued, grouped by cluster
- [known-bugs.md](known-bugs.md) — severity-ranked, file:line cited
- [roadmap.md](roadmap.md) — numbered fixes (#1-#11) with approach
- [open-items.md](open-items.md) — the working checkbox punch-list (start here to plan a week)
