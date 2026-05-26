# Vantus Handoff Brief — 2026-05-26

## Project
Cloud Scenic × VitalLyfe "Vantus" — content operations dashboard.
**Live:** https://usevantus.com (Let's Encrypt SSL, Cloudflare-registered, Netlify-hosted)
**Fallback URL:** https://majestic-cassata-aa16e9.netlify.app (kept active)
**GitHub:** https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to `main`)
**Internal name:** "warroom" (per `package.json` — kept for repo + Netlify subdomain consistency)

## Stack
- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` and `netlify.toml`)
- **Backend:** Supabase (`wjcstqqihtebkpyuacop`) — tables: `content_items`, `profiles`, `cid_posts`, `agent_events`, `notifications`, `clients`, **`client_users`** (NEW 2026-05-25)
- **Netlify Functions:** `/api/chat`, `/api/agent-action`, `/api/notify`, `/api/cid-scrape`, `/api/apify-scrape`, `/api/unsplash`, `/api/higgsfield` (untracked) — plus shared helper `netlify/functions/_lib/requireUser.js`
- **Anthropic model:** `claude-haiku-4-5-20251001`
- **Workflows:** n8n cloud at `https://cloudscenic.app.n8n.cloud`, workflow "VitalLyfe Vantus — Content Sync" (ID `3WXHHEiMz9rMnBEn`) — published + live

## Env Vars (Netlify, all set)
`ANTHROPIC_API_KEY` · `SUPABASE_SERVICE_KEY` · `SUPABASE_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `TAVILY_API_KEY` · `N8N_WEBHOOK_URL` · `SLACK_WEBHOOK_URL` (global fallback) · `SLACK_BOT_TOKEN` · `CID_BEARER_TOKEN` · `RESEND_API_KEY`

## Current Nav (UI sidebar)
- **COMMAND:** Dashboard, Task Board, Agents, Competitor Intel, Ideal Customer
- **CONTENT:** Pipeline (unified Instagram/TikTok/YouTube with platform tabs), Production (was Content Tracker)
- **CREATIVE:** Higgsfield Studio *(nav only; component still untracked — see Dirty WIP)*
- **APPS:** Apps, Settings
  - Apps page lists toggleable modules: Brief → Content, ArtGrid Scout, Shot Reference, Hero Generator, Ad ROI Hub, Team Broadcast, References, Skills, SOPs, plus dormant ones

## Agent Actions (`netlify/functions/agent-action.js`)
muse_write_content · muse_from_brief · muse_generate_calendar · muse_save_calendar · muse_ig_ideas · overseer_scan · sean_briefing · lacey_advance · lacey_trigger_n8n · sam_health · artgrid_scout · scrappy_research · scrappy_muse_collab · scrappy_hook_analysis · cid_build_brief · cid_ab_variations

Every invocation writes one row to `agent_events` via SERVICE_KEY (success/error/skipped). **All calls now require an authenticated session** (via `requireUser`).

## Brain Trilogy Status
| Move | What | Status |
| --- | --- | --- |
| **1** — Cortex wiring | Pull agent brand voice + SOPs from `clients.brand_voice_md` instead of hardcoded `seed.agents.js` / `memory.js` | ⏸ **Still pending.** Blocker unchanged — `~/Desktop/Agent Cortex/wiki/clients/vitallyfe/` doesn't exist; `scripts/sync-cortex.mjs` exists as a stub but uncommitted. Next session's top candidate. |
| **2** — `agent_events` | Real history of agent invocations | ✅ Live |
| **3** — Notifications persistence | Durable, deduped, realtime | ✅ Live |

## ✅ Security Posture (REWRITTEN 2026-05-26)

**Auth: live.** Google OAuth restored 2026-05-25. `App.jsx` now distinguishes four paths:
1. **Admin** (@cloudscenic.com) → full Vantus
2. **Approved external client** (`client_users.status='approved'`) → ClientView scoped to their `client_id`
3. **Pending invite** → `PendingApprovalScreen` (auto-unlocks via realtime when admin approves)
4. **Unknown** → blocked with "you're not invited" message

**Function-level auth: live.** All 5 protected functions (`chat`, `agent-action`, `notify`, `apify-scrape`, `unsplash`) now reject anonymous callers via the shared helper at `netlify/functions/_lib/requireUser.js`. `cid-scrape.js` keeps its pre-existing bearer-token gate.

**Client-side auth header injection: live.** `src/services/apiFetch.js` wraps `fetch()` to attach the user's `access_token`. 26 call sites across 11 client files now use it.

**RLS posture:**
- All temp anon policies dropped 2026-05-25 (commit `852d915`). Authenticated admin policies in place across `agent_events`, `notifications`, `clients`, `content_items`, `client-logos` bucket.
- `client_users` table — admins full read/write; approved clients can read their own row(s); realtime enabled so approval triggers UI unlock without refresh.

**Open security debt:**
- **Supabase admin passwords NOT rotated** (`Cloudai25%` in git history). Less urgent now — full Google OAuth path is the only login route in practice.
- **CORS still `*`** on every function — worth tightening but lower priority.
- **CSP / HSTS / Referrer-Policy headers** not in `netlify.toml`.
- **No rate limits** on `/api/chat` etc. — auth gate stops anonymous abuse but authenticated misuse uncapped.
- **supabase-js auth lock contention** — multi-tab usevantus.com or stale localStorage hangs `getSession()` / `signOut()`. Mitigated by a 4s `stuckGuard` timeout but the underlying issue persists. Workaround: `localStorage.clear(); location.reload();`.

## Per-client Routing
- **Slack:** `clients.slack_webhook_url` column (NEW 2026-05-25). `notify.js` prefers it when `client_id` is in the payload; falls back to global `SLACK_WEBHOOK_URL`. Edit Client modal exposes the field under "Optional integrations".
- **n8n:** still global `N8N_WEBHOOK_URL`. Per-client routing TBD (Fix #7).
- **Brand voice:** still hardcoded VitalLyfe in `agent-action.js` + `memory.js`. Brain Move 1 to come.

## Dirty / Uncommitted WIP (intentional)
- `src/apps/higgsfield/HiggsfieldStudio.jsx` (untracked) — Higgsfield Studio frontend, half-built
- `netlify/functions/higgsfield.js` (untracked) — Higgsfield backend
- `src/apps/apps.config.js` (M) — Higgsfield added to DEFAULT_APPS
- `src/utils/constants.js` (M) — CREATIVE/Higgsfield section in nav
- `public/portal.html` (M) — 1,920-line WIP diff
- `scripts/sync-cortex.mjs` (untracked) — Counsel's Move 1 stub
- `src/ui/layout/PasswordGate.jsx` (untracked) — dormant temporary access gate, not imported
- `.claude/` (untracked) — local dev config

When Higgsfield ships: commit `HiggsfieldStudio.jsx` + `higgsfield.js` + the apps.config.js / constants.js modifications + the import + render in `src/App.jsx` ALL IN ONE COMMIT.

## Session log

### 2026-05-25 — Auth restore + invite flow + per-client Slack
Eight commits, four high-severity bugs closed, full external-client invite flow shipped.

| Commit | What |
| --- | --- |
| `307b64f` | `fix(auth)`: dedupe setupSession + render UI immediately on session resolve |
| `8e5095e` | `feat(auth)`: re-enable auth gate + add admin RLS policies (Fix #1) |
| `852d915` | `chore(rls)`: drop temp anon policies now OAuth is live (Fix #1 tail) |
| `2a9c9c1` | `feat(auth)`: caller auth on 5 functions + client_users invite/allowlist flow (Fix #2) |
| `d0acec3` | `fix(auth)`: flip checking=false in onAuthStateChange + 4s stuckGuard (hotfix) |
| `19b6235` | `feat(invite)`: admin team panel inside Edit Client modal (Fix #2.5) |
| `702f867` | `feat(slack)`: per-client webhook routing in notify.js (Fix #4) |
| `d7f0b27` | `docs(map)`: regenerate architecture map after fixes |

**What unlocked:** real multi-tenancy. We can now invite external client teammates (e.g. Natalia at VitalLyfe) via the UI; they get a "pending" screen until we approve in the team panel; on approval their dashboard unlocks via realtime. Per-client Slack routing means future clients won't pollute #vitallyfe-war-room.

### 2026-05-22 → 2026-05-23 (preserved for context)
Repo tidy, component extraction, security audit, Move 2 + Move 3 deployed, custom domain set up, Anthropic model upgrade, mobile nav fixes, multi-tenant `clients` table seeded with VitalLyfe.

## What's NOT Built / Open Items

**High-value next moves:**
- **Brain Move 1** (Cortex wiring) — replace hardcoded VitalLyfe brand voice in `agent-action.js:138-144` + `memory.js:75-81` with per-client lookup from `clients.brand_voice_md`. Makes multi-tenancy real for agent prompts.
- **`content_items` migration file** — schema lives only in live Supabase; drift risk.

**Polish / debt:**
- Auto-recover from supabase-js auth lock errors in `setupSession` (currently relies on user clearing localStorage manually)
- Vantus-bot Slack app for agent-attributed messages (currently MCP posts as the signed-in user)
- Per-client n8n routing (parallel to Slack — Fix #7)
- Split `App.jsx` into smaller components (Phase 3.x of `docs/REFACTOR_PLAN.md`)
- Split `agent-action.js` 16 handlers into per-handler files
- Dynamic-import `pdfjs-dist` in BriefGenPage (saves 405KB)
- Tighten CORS, add CSP/HSTS/Referrer-Policy headers
- Rotate Supabase admin passwords (low urgency)
- External tracker → n8n trigger (SharePoint/Airtable side)

**Dead-code cleanup:**
- `src/agents/` folder — 8 files, zero importers (Fix #8)
- Decide Higgsfield: ship the WIP files together or delete them (Fix #9)

## Strategic Context
- **Client:** VitalLyfe (Natalia = approver, Jon = JC, Danny = Cloud Scenic ops)
- **Active campaigns:** Tierra Bomba at $100/day, influencer seeding ~27–30 confirmed
- **External tracker:** influencer list in SharePoint, NOT in Vantus
- **Slack:** posts go to `#vitallyfe-war-room` as "VitalLyfe War Room" bot via `SLACK_WEBHOOK_URL`

## Sister Project
Cloud Scenic OS lives at `~/Desktop/Software builds/Cloud Scenic OS/` — separate codebase, Portal Build Companion agent owns it. Don't mix the two.

## Key Files (Vantus)
- `src/App.jsx` — root component (~1,500 lines)
- `src/services/apiFetch.js` — auth-aware fetch wrapper (NEW)
- `src/services/supabaseClient.js` — Supabase singleton
- `src/ui/clients/AddClientModal.jsx` — client CRUD + team management
- `src/ui/clients/ClientTeamPanel.jsx` — invite/approve/reject UI (NEW)
- `src/ui/layout/LoginScreen.jsx` — Google OAuth button
- `netlify/functions/_lib/requireUser.js` — shared auth gate (NEW)
- `netlify/functions/agent-action.js` — all 16 agent actions + agent_events logging
- `netlify/functions/notify.js` — client-action notifications + per-client Slack routing
- `supabase/migrations/20260525_client_users_allowlist.sql` — invite/allowlist table (NEW)
- `supabase/migrations/20260525_clients_slack_webhook.sql` — per-client Slack column (NEW)
- `supabase/migrations/20260525_admin_rls_for_oauth.sql` — admin RLS policies (NEW)
- `supabase/migrations/20260525_drop_temp_anon_policies.sql` — anon policy cleanup (NEW)
- `architecture-map.html` — interactive system map (regenerated 2026-05-26)
- `docs/architecture-map/` — portable markdown export of the map
- `docs/architecture-map/open-items.md` — checkbox punch-list
- `docs/REFACTOR_PLAN.md` — pre-existing refactor roadmap
- `START HERE.md` — quick-orient nav for cold opens
