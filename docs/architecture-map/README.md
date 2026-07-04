# Vantus Architecture Map

> Regenerated 2026-07-04 via `/architecture-map`. Portable companion to `../../architecture-map.html`.

**Vantus** (repo/internal "warroom") is Cloud Scenic's **agency fulfillment + billing OS** — a multi-tenant client book running content delivery end to end: pipeline with approvals, an AI QC gate, deliverables ledger, monthly report mailer, Stripe billing, and a client vault. React 19 + Vite 8 (Node 22) · Supabase · Netlify Functions · Anthropic Claude. Live at **usevantus.com**, auto-deploys on push to `main`.

**Since the last map (2026-06-04):** the whole fulfillment pivot shipped — Setup, Ledger, Reports, Client Analytics, Operations, Billing + live Stripe, CRM home — and six pages/agents were removed. Then the 7/2 Danny-spec build landed the **QC Agent** (hybrid vision + deterministic fact-checking), **Facts of Record**, and the **monthly report cron**; 7/3 added the **Client Vault** (Stripe-vaulted cards) and a full live test campaign (27/31 green) that also fixed three bugs and two silent config outages.

**View the interactive map:** open `../../architecture-map.html`, or `python3 -m http.server 4747` → `http://localhost:4747/architecture-map.html`.

---

## Notable findings from this map

- **Dead code (3 files):** `QuickActionsDashboard.jsx`, `PlaceholderPage.jsx`, `TypingTask.jsx` are imported at `App.jsx:20/25/26` but rendered nowhere — they ship in the bundle for nothing. Only dead files in `src/`; everything else has live importers.
- **The QC spine is real and proven.** Save into "Need Content Approval" → auto `qc_review` → Google Drive image fetch → sonnet vision + deterministic price/phone/offer-window checks → blocked gates in the Ledger and the edit modal. Verified live 7/3, including reading a wrong price off an attached image.
- **Two config outages were invisible for weeks.** Drive upload NEVER worked in production until 7/3 (`usevantus.com` was missing from the Google OAuth client's origins — zero items ever had files) and ALL email was dead until 7/3 (Resend domain unverified; the earlier API-key fix wasn't enough). Neither surfaced an error anywhere a human looked.
- **Same silent-fallback smell remains in one place:** `_lib/crypto.js:7` stores OAuth tokens in PLAINTEXT if `TOKEN_ENC_KEY` is unset — no startup alarm. Worth a hard fail.
- **Invoice email overlap:** the branded Resend invoice email only sends when Stripe FAILS (`BillingRoute.jsx:104-112`). With Stripe live, clients only ever get Stripe's own hosted-invoice email.
- **status vs stage drift:** approvals advance `status` but not `stage` (`src/core/approvals.js:45-47`) — observed diverging live on 7/3. "Posted" is also a runtime-only status missing from `STATUSES` (`src/utils/constants.js:33`).
- **Model tiering is half-done:** ideation actions moved to sonnet-4-6 and only `scrappy_analyze_performance` uses opus-4-8 (`agent-action.js:1582`) — but `muse_write_content` (captions, a client-facing deliverable) is still on haiku. The agreed rule: tier by who sees the output.
- **Mobile audit (7/4):** zero horizontal overflow at any viewport including 320px stress — but pinch-zoom is disabled app-wide (`index.html:5`), micro-labels render at 8px, and Setup has 51–94 sub-40px tap targets.

## Cluster overview

| Cluster | What lives there |
|---|---|
| **Client (browser)** | `App.jsx` root (auth gate, realtime, QC auto-trigger) · EditContentModal (SOP gates + Drive upload) · Ledger (approval surface) · Setup/Facts · Vault · Billing · Idea Engine · analytics pages · agent chat · 3 dead components |
| **Server entry** | `netlify.toml` `/api/*` redirects · two daily crons (13:00 + 14:00 UTC) · provider webhooks (Stripe, Meta, TikTok, Google) |
| **Netlify Functions** | `agent-action.js` (16-action dispatcher, 1,753 lines) with `qc_review` inside · chat proxy · notify fan-out · billing-stripe (create + vault + webhook) · report mailer · task chaser · 3 sync + 11 OAuth functions · `_lib/` middleware |
| **Supabase data** | 18 tables (content_items, clients+facts, approvals, notifications, client_reports, client_vault, invoices, tasks/team, social graph ×4, cid ×2, identity ×2, deletion log) + 2 storage buckets |
| **External APIs** | Anthropic (3 model tiers) · Google Drive · Resend · Slack · Stripe · Instagram/TikTok/YouTube · Tavily/Apify/Unsplash · n8n |

## Files in this folder

- [critical-path.md](critical-path.md) — the QC gate flow, step by step with file:line
- [nodes.md](nodes.md) — every node catalogued by cluster
- [known-bugs.md](known-bugs.md) — severity-ranked bug registry
- [roadmap.md](roadmap.md) — numbered fixes with approach
- [open-items.md](open-items.md) — the working checkbox punch-list
