# Vantus — Status Board

> Updated 2026-07-12. Status: ✅ shipped+live · ◐ built, needs data/verify · ☐ not started · ⏸ parked

---

## 🚨 Hardening-sprint findings — 2026-07-12 (verified, not assumed)

The 7/12 spot-checks probed every "reportedly fixed" integration. **All three are broken in prod right now:**

**Christian — 10-minute console session fixes all of it:**
- [ ] **Stripe key is INVALID.** `STRIPE_SECRET_KEY` in Netlify is a 20-char non-Stripe-shaped value (dev context: 64-char, also invalid) — Stripe API returns 401. Billing "Create & send" would error today. Paste the real `sk_live_…` (Stripe dashboard → API keys) into Netlify env, all contexts.
- [ ] **Resend key is INVALID → ALL email still dead.** `RESEND_API_KEY` (20-char, not `re_`-shaped) is rejected by Resend. Meanwhile the env list still contains the rogue var **named** `re_jEHHfr94_…` — that looks like the real key pasted as a NAME (7/8 flag, still unresolved). Fix: in Resend, rotate/create a key; put the new value in `RESEND_API_KEY`; DELETE the rogue-named var. Do not reuse the leaked `re_jEHHfr94_…` value — it's burned (visible in env listings + session logs).
- [ ] **Google OAuth origin NEVER got fixed.** Live probe of the exact GIS popup URL: Google still returns `origin_mismatch` — "register the JavaScript origin" — for `https://usevantus.com` on client `844741925554-i2j0…`. Drive upload has never worked in prod. Fix: Google Cloud Console → Credentials → that OAuth client → Authorized JavaScript origins → add `https://usevantus.com` (and `https://majestic-cassata-aa16e9.netlify.app` if drafts should work).
- [ ] **Rotate Supabase cz/dv/ss account passwords** (dashboard, 2 min). The leaked literal was redacted from docs 7/12; rotation retires it for good.
- [ ] **One-shot PAT** → push 6 held local commits (3 from 7/9 + Fix #7 + docs + CSP).

**Shipped this sprint (7/12, local commits awaiting push+deploy):**
- [x] **Fix #7 (admin half)** — Reports + Client Analytics fetch their own slim 90-day-windowed rows; global content blob bounded to unposted + posted ≤90d; `account_posts` jsonb no longer ships to the browser. (`4fe5c97`)
- [x] **CSP hardened** — `'unsafe-inline'` dropped from style-src (the styled-jsx justification was wrong; LoginScreen's runtime style injection moved to globals.css, GIS button stylesheet hash-allowlisted). Verified zero violations on a draft deploy. (`3758a98`)
- [x] **Stash cleared** — `stash@{0}` was NOT Higgsfield (that WIP was untracked, never stashed, and is lost); the portal.html rewrite it held is archived on `archive/portal-html-wip-2026-05-26`. Fix #9 resolved as moot. (`d8f7b0c`)
- [x] **Credential literal redacted** from HANDOFF + architecture-map docs. (`d8f7b0c`)

**Blocked until keys fixed:** the controlled $1 Stripe proof invoice (Fix #5) — pointless until `STRIPE_SECRET_KEY` is real; Resend domain-verified check — API rejects the stored key before it can even list domains.

---

## 🔧 Open action queue — 2026-07-09 (three lanes)

Triaged out of the 7/8 Creative OS kit handoff + a Netlify credit-hold on git-triggered deploys (worked around via CLI deploy this session). Almost everything open is Christian-only account/billing/data work.

**Claude Code (me, `main`) — cleanup**
- [x] Untrack `.netlify/functions/manifest.json` (was committed before `.gitignore` rule; stops the phantom dirty state every session).
- [x] CLI-deploy proven as the workaround while Netlify server builds are credit-blocked (`netlify deploy --build --prod`).
- [x] Netlify diagnosis: site is on the **free Personal team `cz-mwalysu`**, NOT the Cloud Scenic **Pro** team. No card failure. Build minutes fine (6 used) → tripped cap is bandwidth/usage. Real fix = **transfer usevantus.com to the Cloud Scenic Pro team** (`cloudscenic`, dv@).

**Codex — thin right now**
- No real code task. Email "no client email" warning is a NON-bug (`FactsAndReports.jsx:246` already keys off `!c.primary_email`); mailer already falls back to owner + Slack notice.
- Optional (flag only): make `send-monthly-reports.js` hard-refuse when `primary_email` missing instead of owner-fallback. Low value.

**Christian — human-only (account / billing / secrets / data)**
- [ ] Flip **Gemini billing** in Google AI Studio → clears `429 quota exceeded`, revives all 7 VL generators.
- [ ] Clear **Netlify credit hold** on `majestic-cassata` → restores git-triggered auto-deploy.
- [ ] Unset + rotate the **rogue Resend-key-named env var** (7/8 security flag).
- [ ] **Revoke the GitHub PAT** exposed in the 7/9 session chat.
- [ ] Connect **per-client social OAuth**: `@DynastyStaffing`, `@Parlor.Bar`, `@Vital.Lyfe` (needs client logins).
- [ ] Enter **real retainer numbers** (replace Dynasty $20k / Parlour $2k / VitalLyfe $8k placeholders; gates Dynasty auto-send).
- [ ] Data check: any client showing the email warning just needs its `primary_email` set (code is correct).

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
