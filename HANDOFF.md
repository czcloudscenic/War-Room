# Vantus Handoff Brief — 2026-06-01 (post-rip pass + IG-analyzer pivot prep)

## 2026-06-01 session — Major rip + de-hardcoding pass

**Why:** The original Vantus premise was "log in to your IG/TT/YT/LinkedIn accounts, have AI analyze your analytics and generate better content ideas." The actual built app drifted into a VitalLyfe-specific content-ops dashboard. This session ripped the agency-shaped weight and de-VitalLyfe'd everything so the codebase is ready for the self-serve IG OAuth pivot.

### Ripped (preserved under `ripped out features/`)
- **Apps:** Brief → Content (brief-gen), Shot Reference, Hero Generator
- **Agents:** Lacey (Runner), Ali (Developer), Sam (Monitor), Overseer (SOP Guardian) — kept Sean, Muse, Scrappy, Artgrid
- **Routes:** TrackerRoute (redundant), TaskboardRoute (empty ops theater), SopsRoute (VitalLyfe 7-step SOP)
- **External-client portal:** `ClientView.jsx` (1,298 lines) + preview-mode overlay + 2 "Client View" trigger buttons + `seed.content.js` (VITAL_LYFE_SOP). Approved external clients now route to the main app — RLS already scopes them per `client_id`.

Backups: `ripped out features/{apps,agents,routes,client-view}/` + `working ripped out features/` (full pre-rip production build snapshot for fallback).

### De-hardcoded
Anything VitalLyfe-specific now flows through `clients.brand_voice_md` at request time, parsed into a `brand.pillars` array via new `parsePillars()` helper in `agent-action.js`:
- `muse_ig_ideas` + `muse_generate_calendar` + `scrappy_research` — pillars/voice come from client context, not hardcoded
- `notify.js` email + Slack branding — pulls `clients.name` per call ("Cloud Scenic × {client}" / "{client} Vantus"), falls back to "Vantus"
- `ContentRoute` IG/TT/YT subtitles — pull `currentClient.ig_handle / slug / name`
- `LoginScreen` tagline — "VitalLyfe Content Operations" → "Content Operations Dashboard"
- `CIDPage` AI prompt + ~10 UI labels — "VitalLyfe Adaptation/Version/Ready" → "Brand Adaptation/Version/Ready"
- `ArtgridScout` AI prompt — brand-agnostic, takes voice from context
- `AdROIHub` AI persona — generic Ad Analyst (was "Sam"). Seed campaigns + placeholder also generic.
- `constants.js` — `PILLARS_LIST` is generic placeholders, `CAMPAIGNS = []`
- `App.jsx` — Muse memory seed neutered, new-item template uses client slug
- `ICPPage` — `DEFAULT_CLIENTS = []` (was hardcoded VitalLyfe profile)
- `ReferencesPage` — `INITIAL_REFS = []` (was 4 Drip Campaign seeds)
- `seed.ops.js` — dead-agent task entries (Lacey/Ali/Overseer) stripped
- Various placeholders (`teammate@example.com`, `e.g. your brand name`, generic campaign examples)

Only residue: a single historical comment in `src/core/memory.js` about the long-removed `seedMuseMemory()`. Not live.

### Auth-lock fix (stuckGuard tightening)
**Bug:** Opening Vantus in a second tab kicked the user out of both. Cause: `stuckGuard` setTimeout in `App.jsx` fired unconditionally at 4s — even if `getSession()` resolved at 3.9s, the guard still wiped tokens and reloaded.
**Fix:** Cancel the guard the moment auth resolves (both `getSession().then()` and `onAuthStateChange`). Bumped timeout 4s → 8s for slow networks. Recovery still runs if auth genuinely hangs.

### Build delta
- Modules: 103 → 93
- JS bundle: 798KB → 628KB (~21% lighter)
- pdf-worker chunk (1.2MB): GONE (was used by ripped brief-gen)

### What still uses VitalLyfe as data (not behavior)
- The `clients` row for VitalLyfe in Supabase — still has `brand_voice_md` seeded from migration `20260526_seed_vitallyfe_brand_voice.sql`. Useful as the working test client.
- HANDOFF.md (this doc) still references it as the historical client.

### What the new "user" model looks like (next sprint)
Replace agency-style `clients` rows + invite allowlist with:
- IG/TT/YT/LinkedIn OAuth-per-user
- New `ig_accounts` (and sibling `tt_accounts`, etc.) tables: `user_id`, `account_id`, `access_token`, `handle`, `meta`
- Worker that pulls recent posts + insights (top performers, engagement, hashtags, themes)
- Retarget `muse_ig_ideas` to read user's top posts + caption themes, generate 5 ideas grounded in their actual account
- Add Higgsfield account linking (already stashed)
- Self-serve sign-up — kill the "pending approval" gate

---

# Vantus Handoff Brief — 2026-05-26 PM (evening — post 3-agent collab session)

## Project
Cloud Scenic × VitalLyfe "Vantus" — content operations dashboard.
**Live:** https://usevantus.com (Let's Encrypt SSL, Cloudflare-registered, Netlify-hosted)
**Fallback URL:** https://majestic-cassata-aa16e9.netlify.app (kept active)
**GitHub:** https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to `main`)
**Internal name:** "warroom" (per `package.json` — kept for repo + Netlify subdomain consistency)

## Stack
- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` and `netlify.toml`). `src/App.jsx` now 1,342 lines (was 1,676 — Codex split out 6 route components into `src/ui/routes/` as Fix #2).
- **Backend:** Supabase (`wjcstqqihtebkpyuacop`) — tables: `content_items` (versioned), `profiles`, `cid_library` + `cid_performance` (real CID tables), `agent_events`, `notifications`, `clients`, `client_users`. (`cid_posts` was a phantom — never existed; migration + caller deleted 2026-05-26 PM.)
- **Netlify Functions:** `/api/chat`, `/api/agent-action`, `/api/notify`, `/api/apify-scrape`, `/api/unsplash` — plus shared helpers `_lib/requireUser.js` (auth + cors) and `_lib/rateLimit.js` (in-memory sliding window). (`/api/cid-scrape` removed 2026-05-26 PM — zero callers + queried phantom table. Higgsfield function is stashed.)
- **Anthropic models:** `claude-haiku-4-5-20251001` (server-side functions) + `claude-sonnet-4-6` (frontend /api/chat callers — bumped from retired `claude-sonnet-4-20250514` on 2026-05-26)
- **Workflows:** n8n cloud at `https://cloudscenic.app.n8n.cloud`, workflow "VitalLyfe Vantus — Content Sync" (ID `3WXHHEiMz9rMnBEn`) — published + live. Per-client routing via `clients.n8n_webhook_url` (Fix #7).

## Env Vars (Netlify, all set)
`ANTHROPIC_API_KEY` · `SUPABASE_SERVICE_KEY` · `SUPABASE_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `TAVILY_API_KEY` · `N8N_WEBHOOK_URL` · `SLACK_WEBHOOK_URL` (global fallback) · `SLACK_BOT_TOKEN` · `RESEND_API_KEY`

(`CID_BEARER_TOKEN` deleted 2026-05-26 PM — orphaned after cid-scrape removal.)

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

**Function-level auth: live.** All 5 protected functions reject anon callers via `_lib/requireUser.js`. (cid-scrape.js was deleted 2026-05-26 PM in the closed-by-removal cleanup — was the only function on the legacy bearer-token pattern.)

**Email/password auth: DISABLED 2026-05-26 PM.** Supabase Auth → Providers → Email toggle flipped off. Leaked `Cloudai25%` password from git history is now genuinely inert — only Google OAuth remains for cz/dv/ss admin sign-in. Magic-link fallback also disabled (acceptable since Google is the intended path).

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
- `style-src 'unsafe-inline'` in CSP — required by current inline-style patterns. Tighten when inline styles get factored out.

(Password rotation debt closed 2026-05-26 PM — better fix than rotation: email/password auth provider disabled entirely. Password leak in git history is now inert.)

## Per-client Routing (all live as of 2026-05-26)
- **Slack:** `clients.slack_webhook_url` column. `notify.js` prefers it; falls back to global `SLACK_WEBHOOK_URL`. (Fix #6, commit `702f867`)
- **n8n:** `clients.n8n_webhook_url` column. `notify.js` reads it in the same Supabase fetch as Slack (one roundtrip pulls both); falls back to global env. (Fix #7, commit `2bb8958`)
- **Brand voice:** `clients.brand_voice_md` column. `agent-action.js getBrandContext(client_id)` reads it per request, passes to every handler. Per-request override via `payload.voiceOverride`. (Move 1 / Fix #3, commit `767cb93`)

## Dirty / Stashed WIP (intentional)

**All Higgsfield + sync-cortex WIP lives in `stash@{0}` (label: "pre-codex-fix2 wip").** Stashed before Codex ran the App.jsx split so Codex would refactor against a clean tree; never popped back. Working tree is clean apart from anything new this session.

Inspect with `git stash show -u stash@{0}`. Contents:
- `src/apps/higgsfield/HiggsfieldStudio.jsx` (untracked) — Higgsfield Studio frontend, half-built
- `netlify/functions/higgsfield.js` (untracked) — Higgsfield backend
- `src/apps/apps.config.js` (M) — Higgsfield added to DEFAULT_APPS
- `src/utils/constants.js` (M) — CREATIVE/Higgsfield section in nav
- `public/portal.html` (M) — 1,920-line WIP diff
- `scripts/sync-cortex.mjs` (untracked) — Counsel's Move 1 sync stub
- `.claude/commands/*.md` + `.claude/settings.json` (untracked) — local dev config
- `.netlify/` function zips + `netlify.toml` snapshot + `logo/vantus_icon_*.png` (untracked) — incidental build/asset noise, not feature work

`src/ui/layout/PasswordGate.jsx` from earlier HANDOFFs was never created (no git history, not in stash). Drop the mention if it comes up again.

When resuming Higgsfield:
1. `git stash pop` — expect conflicts on `src/utils/constants.js` and `src/apps/apps.config.js` if Codex's split touched them; resolve manually.
2. Re-evaluate `public/portal.html` (1,920-line diff predates the React-side hardening; may be partly stale).
3. Ship Higgsfield as one commit: `HiggsfieldStudio.jsx` + `higgsfield.js` + `apps.config.js` edit + `constants.js` edit + the import + render in `src/App.jsx`.
4. `sync-cortex.mjs` can ship separately once the wiki schema is signed off (see [[project_cortex_vantus_bridge]]).

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
| `90beaa6` | `chore(cleanup)`: drop unused INITIAL_CONTENT seed array (Fix #14 partial) + drop matching App.jsx import + regenerate arch map docs |

**What unlocked:** brain trilogy complete. Multi-tenancy is real end-to-end — adding a new client via AddClient modal + filling `brand_voice_md` gets them their own agent voice automatically. Security posture moved from "auth gate only" to "auth + RLS + CORS + rate limits + CSP". App.jsx finally splittable. Three migrations applied to live Supabase by founder (brand voice seed, content_items baseline, content_items client_rls, cid_library rename) — all verified before code push.

**Codex workflow established:** I work main, Codex grinds on `codex/grunt-<date>` feature branches. Brief Codex with exact line numbers + dirty-WIP out-of-scope list + CODEX_NOTES.md as the report. Use `git push origin HEAD:main` to dodge stale local main refs.

### 2026-05-26 PM (evening) — 3 closed-by-removal cleanups + Codex Fix #4 grind + 3-agent collab pattern proven

| Commit | What |
| --- | --- |
| `a22df04` | `chore(cleanup)`: close cid_posts dead chain + document email/password auth disable. Live SQL probe confirmed `cid_posts` table never existed; `cid-scrape.js` + `003_cid_posts.sql` deleted; arch map + 5 markdown bundle files synced; +88/-171 lines |
| (out-of-band) | **Supabase Auth → Providers → Email** toggle flipped off in dashboard. Cloudai25% leak in git history now inert. Only Google OAuth path remains. |
| (out-of-band) | **Netlify env var `CID_BEARER_TOKEN`** deleted — orphaned after cid-scrape removal. |
| Codex on `codex/grunt-2026-05-27` | `refactor(agent-action)`: Fix #4 — split 1,317-line monolith into 16 handler files under `netlify/functions/agent-action/handlers/`. agent-action.js now 309-line router. 19 commits, build green after each. CODEX_NOTES.md has full report. **Awaiting founder review + merge.** |

**3-agent collab pattern proven at scale:** Main Claude (this tab) drove diagnostics + briefs + arch-map updates. Counsel Claude (parallel tab) shipped `90beaa6` (INITIAL_CONTENT cleanup, caught dead import before I did) + `9955cd3` (HANDOFF rewrite to fix stale "Dirty WIP" claim). Codex GPT-5.5 ground through Fix #4 on its own branch. Zero conflicts across all three. See [[project_vantus_counsel_workflow]] for the workflow notes.

**Codex burst budget behavior:** 5h burst limit (gpt-5.5 quality) caps Codex on big refactors. When exhausted, auto-downgrades to gpt-5.4-mini. Weekly limit is separate (much more generous). Resets are timed per-window (today's was 01:51). Plan big Codex jobs around burst windows.

**Codex standing contract:** "use `codex/grunt-YYYY-MM-DD` today's date, NEVER push to remote, founder reviews + merges manually." My initial Fix #4 brief overrode both (asked for a specific branch name + push) — Codex correctly refused both via CODEX_NOTES.md and asked for confirmation. Briefs should respect the contract; only override when explicitly needed.

**Next session queue (briefs already drafted at `/tmp/`):**
- `/tmp/codex-brief-deadcode.md` — dead code sweep across `src/`. Ready to fire when Codex burst returns.
- `/tmp/codex-brief-app-state.md` — App.jsx state extraction into custom hooks (skeleton; needs parallel Claude tab to produce state map at `/tmp/app-state-map.md` first, paste into brief).
- `/tmp/other-claude-prompt.md` — prompt for a parallel Claude tab to do the state mapping prep.

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

**Sprint-scale:**
- **Fix #4** — ✅ **DONE on `codex/grunt-2026-05-27`, awaiting founder merge.** 1,317-line agent-action.js → 309-line router + 16 handler files under `netlify/functions/agent-action/handlers/`. 19 commits, build green after each. Reviewed safe by main Claude. Merge with `git checkout main && git merge codex/grunt-2026-05-27 && git push origin main`.
- **App.jsx state extraction** — next big Codex job (~12 hooks under `src/hooks/`). Brief skeleton drafted at `/tmp/codex-brief-app-state.md`; needs the state-cluster mapping section filled in by a parallel Claude tab first (prompt at `/tmp/other-claude-prompt.md`).
- **Fix #12** — Back OpsBoard with a DB-backed `tasks` table (new migration + UI rewrite). ~1 hr. Not Codex-shaped (needs UI browser testing).
- **Fix #13** — Per-user client assignments. Counsel + main both flagged as ambiguous: could mean access (already done via `client_users.status='approved'`), role-per-client (add `assignment_role` column), or primary-contact-per-client (different concept). **Defer until the actual pain forces the question** — small team + one flagship client doesn't surface this yet.

**Decision-bound:**
- **Fix #9** — Ship or delete Higgsfield. UI + function are stashed in `stash@{0}` (not in working tree — see Dirty / Stashed WIP). To ship: pop stash, resolve conflicts on `apps.config.js`/`constants.js`, commit all 5 files together (UI + backend + apps.config edit + constants edit + App.jsx import/render). To abandon: `git stash drop stash@{0}` (deletes the Higgsfield WIP permanently — confirm first). Decision is the work; code change is small either way.

**Polish:**
- **Vantus-bot Slack app** for agent-attributed messages (currently posts as signed-in user via MCP).
- **Fix #14** — INITIAL_CONTENT seed array removed 2026-05-26 (commit `90beaa6`). `seed.content.js` now only exports `VITAL_LYFE_SOP`, still rendered by `SopsRoute` + `ClientView`. Per-client SOP schema decision is the remaining work before this constant can move into the DB.
- **Dead code sweep across `src/`** — brief drafted at `/tmp/codex-brief-deadcode.md`. Fire when Codex burst returns.
- **External tracker → n8n trigger** (SharePoint/Airtable side).
- Tighten `style-src 'unsafe-inline'` in CSP when inline-style React patterns get factored out.

**Cortex bridge (forward design — not built):**
- `wiki/clients/<slug>/brand-voice.md` → `clients.brand_voice_md` push pipeline via `scripts/sync-cortex.mjs` (stub lives in `stash@{0}`, not in working tree). DO NOT create `wiki/clients/` until founder signs off on the schema. See `~/.claude/projects/-Users-chrisz/memory/project_cortex_vantus_bridge.md`.

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
- `netlify/functions/agent-action.js` — **On `main`:** 1,317-line monolith. **On `codex/grunt-2026-05-27` (awaiting merge):** 309-line router that imports 16 handlers from `netlify/functions/agent-action/handlers/`. Once merged, this becomes the post-Fix #4 shape.
- `netlify/functions/agent-action/handlers/` — **Codex branch only, awaiting merge.** 16 per-handler files (one per agent action). See CODEX_NOTES.md on the branch for the full list + extraction commits.
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
- `docs/architecture-map/open-items.md` — checkbox punch-list. Current open count: 3 MED bugs + 2 LOW track-only + 4 numbered fixes. (#4 closed on codex branch awaiting merge; cid_posts LOW closed-by-removal; rotate-passwords closed-by-auth-disable.)
- `sprint-recap.html` — **NEW 2026-05-26 PM evening (untracked).** Single-page animated dashboard summarizing the day's work — 4 ticker counters, before/after agent-action.js shrinking bar, 3-agent collab cards, commit timeline, live ticker. Built as a video prop; keep or delete. Open at `http://localhost:4747/sprint-recap.html` if `python3 -m http.server 4747` is running from repo root.
- `docs/REFACTOR_PLAN.md` — pre-existing refactor roadmap.
- `START HERE.md` — quick-orient nav for cold opens.
- `CODEX_NOTES.md` — Codex's report from the Fix #2 split run (2026-05-26).
