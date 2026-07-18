# Vantus — Status Board

> Updated 2026-07-18. Status: ✅ shipped+live · ◐ built, needs data/verify · ☐ not started · ⏸ parked

---

## 🚨 Re-verified live state — 2026-07-18 (Netlify env re-audited today)

Re-audited the linked Netlify env (names + length/prefix only; value reads are classifier-blocked, as intended). **State changed since 7/12 — the three keys are now EMPTY, not malformed.** Someone cleared the bad values but never pasted good ones, so all three integrations are still dead, and the security item is still open:

- `RESEND_API_KEY` → **empty** (was a bad 20-char value on 7/12). Email still dead.
- `STRIPE_SECRET_KEY` → **empty** (was bad 20/64-char). Billing "Create & send" still errors.
- `STRIPE_WEBHOOK_SECRET` → **empty**. Paid-sync webhook can't verify signatures.
- Rogue var **named** `re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH` → **STILL PRESENT** (now empty-valued). Its NAME is a burned Resend key, visible in every env listing = compromised. Delete the var + revoke that key in Resend.
- Healthy for reference: `SUPABASE_SERVICE_KEY` is the new `sb_…` format (len 41); Anthropic/Slack/Tavily/Apify/Meta/TikTok/YT/Google keys all present and correctly shaped.

Verified today: repo **builds clean** (`npm run build`, 219ms, 533KB bundle); site **still on the free `cz-mwalysu` team** (auto-deploy still credit-blocked); **9 commits** now sit local-only awaiting a PAT push.

**Christian — ~15-minute console session clears the whole board:**
- [ ] **Paste real `STRIPE_SECRET_KEY`** (`sk_live_…`, Stripe → API keys) + **`STRIPE_WEBHOOK_SECRET`** into Netlify env, all contexts. Both are empty now.
- [ ] **Paste real `RESEND_API_KEY`** (`re_…`, generate fresh in Resend). Currently empty.
- [ ] **Delete the rogue `re_jEHHfr94_…` env var** AND revoke that key in Resend (it's exposed in plaintext as a var name).
- [ ] **Register Google OAuth JS origin** — Google Cloud Console → Credentials → client `844741925554-…` → Authorized JavaScript origins → add `https://usevantus.com` (+ `https://majestic-cassata-aa16e9.netlify.app` for drafts). Live probe on 7/12 still returned `origin_mismatch`; Drive upload has never worked in prod.
- [ ] **Transfer usevantus.com → Cloud Scenic Pro team** (Netlify → site → Site config → General → Danger zone → Transfer site). Unblocks git auto-deploy; retires the manual CLI-deploy workaround. 3–5 min.
- [ ] **Flip Gemini billing** in AI Studio → clears 429, revives the 7 VL generators.
- [ ] **Rotate Supabase cz/dv/ss account passwords** (dashboard, 2 min) — retires the old leaked literal.
- [ ] **Revoke the GitHub PAT** exposed in a prior session's chat.
- [ ] **One-shot PAT** → I push the 9 held local commits (3 from 7/9 + Fix #7 + docs + CSP + handoffs).

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
