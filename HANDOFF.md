# Vantus Handoff Brief — 2026-05-23

## Project
Cloud Scenic × VitalLyfe "Vantus" — content operations dashboard.
**Live:** https://usevantus.com (Let's Encrypt SSL, Cloudflare-registered, Netlify-hosted)
**Fallback URL:** https://majestic-cassata-aa16e9.netlify.app (kept active)
**GitHub:** https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to `main`)
**Internal name:** "warroom" (per `package.json` — kept for repo + Netlify subdomain consistency)

## Stack
- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` and `netlify.toml`)
- **Backend:** Supabase (`wjcstqqihtebkpyuacop`) — tables: `content_items`, `profiles`, `cid_posts`, **`agent_events`** (NEW), **`notifications`** (NEW)
- **Netlify Functions:** `/api/chat`, `/api/agent-action`, `/api/notify`, `/api/cid-scrape`, `/api/apify-scrape`, `/api/unsplash`, `/api/higgsfield`
- **Anthropic model:** `claude-haiku-4-5-20251001` (upgraded from deprecated haiku-3 after Move 2 exposed every agent call failing)
- **Workflows:** n8n cloud at `https://cloudscenic.app.n8n.cloud`, workflow "VitalLyfe Vantus — Content Sync" (ID `3WXHHEiMz9rMnBEn`) — published + live

## Env Vars (Netlify, all set)
`ANTHROPIC_API_KEY` · `SUPABASE_SERVICE_KEY` · `SUPABASE_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `TAVILY_API_KEY` · `N8N_WEBHOOK_URL` · `SLACK_WEBHOOK_URL` · `SLACK_BOT_TOKEN` · `CID_BEARER_TOKEN` · Resend key

## Current Nav (UI sidebar)
- **COMMAND:** Dashboard, Task Board, Agents, Competitor Intel, Ideal Customer
- **CONTENT:** Pipeline (was Instagram/TikTok/YouTube — now unified with platform tabs), Production (was Content Tracker)
- **CREATIVE:** Higgsfield Studio *(nav only; component not yet wired — see Dirty WIP)*
- **APPS:** Apps, Settings
  - Apps page lists toggleable modules: Brief → Content (moved here from CONTENT nav), ArtGrid Scout, Shot Reference, Hero Generator, Ad ROI Hub, Team Broadcast, References, Skills, SOPs, plus dormant ones (Scraping Ops, Analytics, Cost Governance, Automation Center)

## Agent Actions (`netlify/functions/agent-action.js`)
muse_write_content · muse_from_brief · muse_generate_calendar · muse_save_calendar · muse_ig_ideas · overseer_scan · sean_briefing · lacey_advance · lacey_trigger_n8n · sam_health · artgrid_scout · scrappy_research · scrappy_muse_collab · scrappy_hook_analysis · cid_build_brief · cid_ab_variations

Every invocation now writes one row to `agent_events` via SERVICE_KEY (success/error/skipped).

## Brain Trilogy Status (per Counsel's brief)
| Move | What | Status |
| --- | --- | --- |
| **1** — Cortex wiring | Pull agent brand voice + SOPs from Supabase-backed Cortex entries instead of hardcoded `seed.agents.js` / `memory.js` | ⏸ **Pending.** Blocker: `~/Desktop/Agent Cortex/wiki/clients/vitallyfe/` doesn't exist yet. Either populate the wiki OR bootstrap initial content from `~/.openclaw/workspace/CLAUDE.md`. `scripts/sync-cortex.mjs` exists (stub) but uncommitted |
| **2** — `agent_events` | Real history of agent invocations replacing fake ACTIVITY_POOL theater | ✅ **Live.** Migration deployed. Logging proven via test invocations. ActivityFeed self-fetches + realtime |
| **3** — Notifications persistence | Durable client-action notifications, survive refresh, dedupe via unique constraint | ✅ **Live.** Migration deployed. notify.js inserts. Panel reads from DB + realtime |

## ⚠️ Security Posture — KNOW THIS

- **Auth is currently BYPASSED** in App.jsx. Anyone hitting usevantus.com lands in the admin Vantus dashboard with fallback email `admin@cloudscenic.com`. This is intentional, temporary — to be reversed when Google OAuth debugging resumes.
- **Google OAuth is half-configured.** Supabase Google provider enabled with Client ID + Secret. Google Cloud OAuth client exists with correct redirect URI. **Last failure:** "Unable to exchange external code" — likely Client Secret mismatch between Supabase and Google. Need to check Supabase auth-logs for the exact Google rejection reason next.
- **`/api/setup` is REMOVED** (was leaking hardcoded admin password `Cloudai25%` from setup.js — leaked in git history, file + redirect both deleted)
- **Supabase admin passwords NOT rotated** yet. Old `Cloudai25%` is in git history forever. Switching fully to Google OAuth means this becomes irrelevant. Until then: low-but-nonzero risk.
- **RLS posture:** `agent_events` + `notifications` have `admins read all` policies (auth.jwt email like `%@cloudscenic.com`) AND temporary `anon read` policies tagged with TODO comments to remove when auth is restored.
- **Functions have NO caller auth** (`/api/chat`, `/api/agent-action`, `/api/notify`, etc.) — anyone on internet can POST. Only `/api/cid-scrape` checks a bearer token. Worth fixing.

## Dirty / Uncommitted WIP (intentional)
- `src/apps/higgsfield/HiggsfieldStudio.jsx` (untracked) — Higgsfield Studio frontend, half-built
- `netlify/functions/higgsfield.js` (untracked) — Higgsfield backend
- `src/apps/apps.config.js` (M) — Higgsfield added to DEFAULT_APPS
- `src/utils/constants.js` (M) — CREATIVE/Higgsfield section in nav
- `public/portal.html` (M) — 1,920-line WIP diff (Cloud Scenic OS portal embedded here?)
- `scripts/sync-cortex.mjs` (untracked) — Counsel's Move 1 stub from another session
- `src/ui/layout/PasswordGate.jsx` (untracked) — dormant temporary access gate, not imported
- `.claude/` (untracked) — local dev config

When Higgsfield is ready to ship: commit `HiggsfieldStudio.jsx` + `higgsfield.js` + the apps.config.js / constants.js modifications + re-add the import + render in `src/App.jsx` ALL IN ONE COMMIT. Splitting them broke CI last time (UNRESOLVED_IMPORT).

## What Was Built This Session (2026-05-22 → 2026-05-23)
1. Repo tidy + reorganization (`docs/`, `tools/`, `(experimental)/`, `START HERE.md`, `.netlify/` untracked from git)
2. Extracted 5 inline components from App.jsx to `src/ui/`
3. **Security:** restored auth gate, deleted `/api/setup` endpoint (leaked password)
4. Node 22 pinned for Netlify CI (Vite 8 needs >=20.19)
5. Removed broken HiggsfieldStudio import that was killing CI builds
6. Google OAuth attempted — Supabase + Google Cloud configured but exchange step fails (debugging postponed)
7. Auth bypassed temporarily so the app stays usable
8. UI walkthrough fixes: readable agent text, removed AI-logo platform boxes, task edit/delete on OpsBoard
9. Unified Instagram/TikTok/YouTube into one "Pipeline" page with platform tabs
10. Renamed Content/Content Tracker → Pipeline/Production
11. Moved Task Board CONTENT → COMMAND, moved Brief → Content nav → Apps page
12. Switched notification panel from in-memory to DB-backed (Move 3)
13. **Move 2 + Move 3 live** with migrations deployed
14. Anthropic model upgraded `haiku-3-haiku-20240307` → `claude-haiku-4-5-20251001`
15. Fixed `createPortal` import bug that was silently breaking notification panel
16. Custom domain `usevantus.com` registered at Cloudflare, DNS configured, Netlify SSL provisioned
17. Page title changed to just "Vantus"
18. Supabase Site URL updated to `https://usevantus.com`

## What's NOT Built / Open Items
- **Re-enable Google OAuth** (debugging — likely a Client Secret mismatch; check Supabase auth-logs)
- **Brain Move 1** (Cortex wiring) — see blocker above
- **Caller auth on Netlify functions** (chat, agent-action, notify, etc.) — security hardening item from the audit
- **`content_items` table migration** — code references the table but no migration file exists; schema lives in Supabase but not in version control
- **Rotate Supabase admin passwords** (only matters until full Google OAuth migration)
- **Tighten CORS** (currently `*` on every function)
- **Add CSP / HSTS / Referrer-Policy security headers** to netlify.toml
- **External tracker → n8n trigger** (SharePoint/Airtable side)
- **Vantus → n8n → Slack notification workflow** (Vantus → Slack already works direct via SLACK_WEBHOOK_URL; n8n routing is the open piece)
- **Slack relay endpoint** (`/api/slack-relay`) — partially designed but not built (would let external callers post to the war room via Vantus)
- **Update Google Cloud OAuth client** — add `https://usevantus.com` to Authorized JavaScript Origins when auth comes back

## Strategic Context
- **Client:** VitalLyfe (Natalia = approver, Jon = JC, Danny = Cloud Scenic ops)
- **Active campaigns:** Tierra Bomba at $100/day, influencer seeding ~27–30 confirmed
- **External tracker:** influencer list in SharePoint, NOT in Vantus
- **Slack:** posts go to `#vitallyfe-war-room` as "VitalLyfe War Room" bot via `SLACK_WEBHOOK_URL`. Claude.ai Slack app NOT invited to that channel (would need `/invite @Claude`)

## Sister Project
Cloud Scenic OS lives at `~/Desktop/Software builds/Cloud Scenic OS/` — separate codebase, Portal Build Companion agent owns it, single-page HTML deployed at `https://majestic-cassata-aa16e9.netlify.app/portal.html`. Don't mix the two.

## Key Files (Vantus)
- `src/App.jsx` — root component (~1100 lines, includes the unified Content/Pipeline switch + notifications useEffect)
- `src/ui/dashboard/ActivityFeed.jsx` — DB-backed real-time feed
- `src/ui/dashboard/OpsBoard.jsx` — Task Board with edit/delete
- `src/ui/layout/LoginScreen.jsx` — Google OAuth button (currently unused due to auth bypass)
- `netlify/functions/agent-action.js` — all 16 agent actions + agent_events logging
- `netlify/functions/notify.js` — client-action notifications (+ persistence to `notifications` table)
- `supabase/migrations/20260523_agent_events.sql` — agent history
- `supabase/migrations/20260523_notifications.sql` — durable notifications
- `docs/REFACTOR_PLAN.md` — Counsel's pre-existing refactor roadmap (mostly executed)
- `START HERE.md` — quick-orient nav for cold opens
