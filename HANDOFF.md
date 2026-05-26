# Vantus Handoff Brief — 2026-05-26 (post Move 1 sprint)

## Project
Cloud Scenic × VitalLyfe "Vantus" — content operations dashboard.
**Live:** https://usevantus.com (Let's Encrypt SSL, Cloudflare-registered, Netlify-hosted)
**Fallback URL:** https://majestic-cassata-aa16e9.netlify.app (kept active)
**GitHub:** https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to `main`)
**Internal name:** "warroom" (per `package.json` — kept for repo + Netlify subdomain consistency)

## Stack
- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` and `netlify.toml`). `src/App.jsx` now 1,342 lines (was 1,676 — Codex split out 6 route components into `src/ui/routes/` as Fix #2).
- **Backend:** Supabase (`wjcstqqihtebkpyuacop`) — tables: `content_items` (now versioned!), `profiles`, `cid_posts`, `cid_library` (column renamed Fix #3.1), `agent_events`, `notifications`, `clients`, `client_users`
- **Netlify Functions:** `/api/chat`, `/api/agent-action`, `/api/notify`, `/api/cid-scrape`, `/api/apify-scrape`, `/api/unsplash`, `/api/higgsfield` (untracked) — plus shared helpers `_lib/requireUser.js` (auth + cors) and `_lib/rateLimit.js` (NEW 2026-05-26 — in-memory sliding window)
- **Anthropic models:** `claude-haiku-4-5-20251001` (server-side functions) + `claude-sonnet-4-6` (frontend /api/chat callers — bumped from retired `claude-sonnet-4-20250514` on 2026-05-26)
- **Workflows:** n8n cloud at `https://cloudscenic.app.n8n.cloud`, workflow "VitalLyfe Vantus — Content Sync" (ID `3WXHHEiMz9rMnBEn`) — published + live. Per-client routing via `clients.n8n_webhook_url` (Fix #7).

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
| **1** — Cortex wiring | Per-client agent brand voice from `clients.brand_voice_md` | ✅ **Live 2026-05-26** (commit `767cb93`). `agent-action.js:94 getBrandContext(client_id)` reads `clients.brand_voice_md` per request; 12 prompt sites interpolate `${brand.name}` + `${brand.voice}`; dynamic `#${brand.name}` hashtags; dead `seedMuseMemory` removed. VitalLyfe seeded via `20260526_seed_vitallyfe_brand_voice.sql`. **Per-request voice override** also wired in `agent-action.js` (payload.voiceOverride replaces brand.voice for that call) + `AgentChatPage.jsx` exposes a textarea — useful for "try a punchier tone" runs. |
| **2** — `agent_events` | Real history of agent invocations | ✅ Live |
| **3** — Notifications persistence | Durable, deduped, realtime | ✅ Live |

**Brain trilogy complete.** Forward layer: Cortex wiki entries (`wiki/clients/<slug>/brand-voice.md`) push into `clients.brand_voice_md` via `scripts/sync-cortex.mjs` (stub exists, schema not finalized — don't create the directory until founder signs off on the convention).

## ✅ Security Posture (REWRITTEN 2026-05-26 PM — hardening sweep complete)

**Auth: live.** Four-way branch in `App.jsx setupSession()` (L72) — admin / approved external client / pending invite (realtime unlock) / unknown blocked.

**Function-level auth: live.** All 5 protected functions reject anon callers via `_lib/requireUser.js`. `cid-scrape.js` keeps its pre-existing bearer gate.

**Client-side auth injection: live.** `src/services/apiFetch.js` attaches the access token on every protected call (26 sites). `AgentChatPage` now also passes `currentClient.id` as `client_id` so the backend resolves brand voice correctly (fixed 2026-05-26 — Move 1 was silently using fallback before this prop wiring).

**RLS posture:**
- Temp anon policies fully cleared. Admin policies (@cloudscenic.com email check) on every table.
- `client_users` — admins full r/w; approved clients read their own row(s); realtime enabled.
- `content_items` — admins full r/w; approved clients scoped SELECT+UPDATE to their `client_id` (via `EXISTS` subquery against `client_users`); INSERT/DELETE admin-only; legacy "Allow all for now" anon policy DROPPED (Fix #10.1, `20260526_content_items_client_rls.sql`). Anon REST probe with anon key now returns 0 rows.

**Security hardening sweep (Fix-batch shipped 2026-05-26 PM, commit `8e59968`):**
- **CORS** locked from `*` to allowlist regex via `_lib/requireUser.js cors(event)` — matches `usevantus.com` + `(deploy-preview-*--)?majestic-cassata-aa16e9.netlify.app`. All 6 functions rewritten. `Vary: Origin`.
- **Rate limits** via new `_lib/rateLimit.js` — in-memory sliding window keyed on `user.id:endpoint`. `/api/chat` 30/min, `/api/agent-action` 60/min. Cold starts reset (acceptable since auth+RLS are primary defense).
- **Headers** in `netlify.toml`: HSTS preload (1y, includeSubDomains, preload), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), tight CSP whitelisting only Anthropic + Supabase REST+WSS + Resend + Slack hooks + n8n cloud + Tavily + Apify + Unsplash images. `style-src 'unsafe-inline'` retained for inline-style React patterns (tighten when factored out — separate task).
- **Auth-lock contention** auto-recovers now (Fix #15). On stuckGuard fire: clears `sb-*-auth-token` localStorage keys, sets one-shot `sessionStorage` flag to prevent reload loops, then `location.reload()`. Manual `localStorage.clear() + reload` workaround retired.

**Remaining open security debt (low urgency):**
- Supabase admin passwords (`Cloudai25%` in git history) not rotated — pure password login isn't used in practice; rotate when convenient.
- `style-src 'unsafe-inline'` in CSP — required by current inline-style patterns.

## Per-client Routing (all live as of 2026-05-26)
- **Slack:** `clients.slack_webhook_url` column. `notify.js` prefers it; falls back to global `SLACK_WEBHOOK_URL`. (Fix #6, commit `702f867`)
- **n8n:** `clients.n8n_webhook_url` column. `notify.js` reads it in the same Supabase fetch as Slack (one roundtrip pulls both); falls back to global env. (Fix #7, commit `2bb8958`)
- **Brand voice:** `clients.brand_voice_md` column. `agent-action.js getBrandContext(client_id)` reads it per request, passes to every handler. Per-request override via `payload.voiceOverride`. (Move 1 / Fix #3, commit `767cb93`)

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

### 2026-05-26 PM — Move 1 sprint (9 fixes shipped + security sweep + Codex App.jsx split)

Massive session. Closed half the open punch-list in one afternoon.

| Commit | What |
| --- | --- |
| `767cb93` | `feat(brand)`: per-client brand voice from clients.brand_voice_md (Move 1 / Fix #3). New `getBrandContext` helper + 12 prompt sites refactored + dynamic hashtags + `seedMuseMemory` removed + VitalLyfe SQL seed |
| `22cc58f` | `feat(brand)`: per-request voice override + bump 9 deprecated frontend models (`claude-sonnet-4-20250514` → `claude-sonnet-4-6`; `claude-3-haiku-20240307` → `claude-haiku-4-5-20251001`) |
| `0c163dd` | `fix(brand)`: pass currentClient into AgentChatPage (post-Move-1 regression — `client_id: null` was reaching backend) |
| `2b43364` | `fix(auth)`: auto-recover from supabase-js auth-lock deadlock (Fix #15). stuckGuard clears `sb-*-auth-token` keys + reloads; one-shot sessionStorage flag prevents reload loops |
| `ed46c31` | `chore(schema)`: content_items baseline migration (Fix #10) — 25 cols + FK + indexes + RLS captured in `20260526_content_items_baseline.sql`. Surfaced wide-open "Allow all for now" policy as security debt |
| `5a51b00` | `fix(rls)`: scoped client policies on content_items + drop wide-open anon (Fix #10.1) — `20260526_content_items_client_rls.sql`. Anon REST returns 0 rows now |
| `2bb8958` | `feat(notify)`: per-client n8n routing + consolidated slack+n8n into one Supabase fetch (Fix #7) |
| `4b54630` | `chore(cleanup)`: delete dead `src/agents/` folder (Fix #8) — 8 files, 96 lines |
| `183d53f` | `chore(cleanup)`: cid_library column rename `vitallyfe_adaptation` → `client_adaptation` (Fix #3.1) + close Fix #11 (pdfjs already dynamic) + arch map sync |
| Codex on `codex/grunt-2026-05-26` | `refactor(App)`: extract 6 route components to `src/ui/routes/` (Fix #2). App.jsx 1,676 → 1,342 lines. 7 commits (`4ee755b` Dashboard, `6589b78` Agents, `bee8946` Content, `f2d384c` Tracker, `94eae54` Taskboard, `c4f2cc5` Sops, `e57e951` notes) |
| `8e59968` | `security`: CORS allowlist + per-user rate limits + CSP/HSTS/Permissions/Referrer (security hardening sweep) |

**What unlocked:** brain trilogy complete. Multi-tenancy is real end-to-end — adding a new client via AddClient modal + filling `brand_voice_md` gets them their own agent voice automatically. Security posture moved from "auth gate only" to "auth + RLS + CORS + rate limits + CSP". App.jsx finally splittable. Three migrations applied to live Supabase by founder (brand voice seed, content_items baseline, content_items client_rls, cid_library rename) — all verified before code push.

**Codex workflow established:** I work main, Codex grinds on `codex/grunt-<date>` feature branches. Brief Codex with exact line numbers + dirty-WIP out-of-scope list + CODEX_NOTES.md as the report. Use `git push origin HEAD:main` to dodge stale local main refs.

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

**Sprint-scale (queue to Codex when ready):**
- **Fix #4** — Split `agent-action.js` (1,317 lines) into per-handler files. Same shape as Codex's Fix #2 App.jsx split — clear mechanical refactor, no judgment calls, perfect Codex candidate. Brief would look just like the App.jsx one.
- **Fix #12** — Back OpsBoard with a DB-backed `tasks` table (new migration + UI rewrite). ~1 hr.
- **Fix #13** — Per-user client assignments table (now unblocked by OAuth).

**Decision-bound:**
- **Fix #9** — Ship or delete Higgsfield. UI + function still untracked; must commit all 5 files together (UI + backend + apps.config edit + constants edit + App.jsx import/render) or `rm` them all. Decision is the work; code change is small either way.

**Polish:**
- **Vantus-bot Slack app** for agent-attributed messages (currently posts as signed-in user via MCP).
- **Fix #14** — Decouple `seed.content.js` from VitalLyfe (or remove — DB is authoritative now).
- **External tracker → n8n trigger** (SharePoint/Airtable side).
- Rotate Supabase admin passwords (very low urgency — OAuth is sole path used).
- Tighten `style-src 'unsafe-inline'` in CSP when inline-style React patterns get factored out.

**Cortex bridge (forward design — not built):**
- `wiki/clients/<slug>/brand-voice.md` → `clients.brand_voice_md` push pipeline via `scripts/sync-cortex.mjs` (stub already exists in working tree). DO NOT create `wiki/clients/` until founder signs off on the schema. See `~/.claude/projects/-Users-chrisz/memory/project_cortex_vantus_bridge.md`.

## Strategic Context
- **Client:** VitalLyfe (Natalia = approver, Jon = JC, Danny = Cloud Scenic ops)
- **Active campaigns:** Tierra Bomba at $100/day, influencer seeding ~27–30 confirmed
- **External tracker:** influencer list in SharePoint, NOT in Vantus
- **Slack:** posts go to `#vitallyfe-war-room` as "VitalLyfe War Room" bot via `SLACK_WEBHOOK_URL`

## Sister Project
Cloud Scenic OS lives at `~/Desktop/Software builds/Cloud Scenic OS/` — separate codebase, Portal Build Companion agent owns it. Don't mix the two.

## Key Files (Vantus)
- `src/App.jsx` — root component (1,342 lines, post Codex Fix #2 split). Owns all state; routes are dumb presentation.
- `src/ui/routes/` — 6 extracted route components (DashboardRoute · AgentsRoute · ContentRoute · TrackerRoute · TaskboardRoute · SopsRoute). Codex 2026-05-26 Fix #2.
- `src/services/apiFetch.js` — auth-aware fetch wrapper. Attaches `Bearer <access_token>` to every protected call.
- `src/services/supabaseClient.js` — Supabase singleton.
- `src/ui/clients/AddClientModal.jsx` — client CRUD + team management. Embeds ClientTeamPanel.
- `src/ui/clients/ClientTeamPanel.jsx` — invite/approve/reject UI.
- `src/ui/layout/LoginScreen.jsx` — Google OAuth button.
- `src/ui/agents/AgentChatPage.jsx` — chat panel. Passes `currentClient.id` as `client_id` for brand voice resolution. Voice-override textarea above quick actions.
- `netlify/functions/_lib/requireUser.js` — shared auth gate + per-request `cors(event)` (allowlist regex).
- `netlify/functions/_lib/rateLimit.js` — NEW 2026-05-26. In-memory sliding-window per-user rate limit.
- `netlify/functions/agent-action.js` — 16 agent actions (1,317 lines — Fix #4 to split). `getBrandContext` at L94. Rate-limit 60/min/user.
- `netlify/functions/chat.js` — Anthropic proxy. Rate-limit 30/min/user.
- `netlify/functions/notify.js` — client notifications + per-client Slack + per-client n8n (single consolidated Supabase fetch).
- `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql` — VitalLyfe brand voice seed (Move 1).
- `supabase/migrations/20260526_content_items_baseline.sql` — full content_items DDL (Fix #10).
- `supabase/migrations/20260526_content_items_client_rls.sql` — scoped client RLS + drop anon policy (Fix #10.1).
- `supabase/migrations/20260526_cid_library_rename_adaptation.sql` — column rename (Fix #3.1, idempotent DO block).
- `supabase/migrations/20260525_*.sql` — auth restore batch (client_users, slack_webhook, admin RLS, drop temp anon).
- `netlify.toml` — security headers (HSTS, CSP, Referrer-Policy, Permissions-Policy) added 2026-05-26.
- `architecture-map.html` — interactive system map (regenerated 2026-05-26 with all today's changes).
- `docs/architecture-map/` — portable markdown export (README · critical-path · nodes · known-bugs · roadmap · open-items).
- `docs/architecture-map/open-items.md` — checkbox punch-list. Current open count: 1 bug + 3 fixes = 4 items.
- `docs/REFACTOR_PLAN.md` — pre-existing refactor roadmap.
- `START HERE.md` — quick-orient nav for cold opens.
- `CODEX_NOTES.md` — Codex's report from the Fix #2 split run (2026-05-26).
