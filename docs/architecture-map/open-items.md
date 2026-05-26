# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-05-26 (post Move 1 · #15 · #10/10.1 · #7 · #8 · #11 · #3.1 · #2 App.jsx split · security sweep) · **Total open:** 1 bug + 3 fixes = 4 items

```
🔴 High:   0    │   ✅ Done:  18  (Fix #1 OAuth, Fix #2 App.jsx split (Codex),
🟡 Med:    2    │                  Fix #3 Move 1, Fix #3.1 cid_library rename,
🟢 Low:    1    │                  Fix #5 caller auth, Fix #6 per-client Slack,
                │                  Fix #7 per-client n8n, Fix #8 delete dead src/agents/,
                │                  Fix #10 baseline + #10.1 scoped RLS, Fix #11 pdfjs dynamic,
                │                  Fix #15 auth-lock recovery, security hardening sweep
                │                  (CORS + rate limits + CSP/HSTS/Permissions/Referrer),
                │                  5 temp anon RLS policies, Google secret rotation)
                │   📋 Fixes:  3 open (12 closed)
```

---

## 🔴 HIGH — fix this week

_None open as of 2026-05-26. The week-of work shipped 2026-05-25 — see ✅ block below._

---

## 🟡 MED — fix when planning next refactor

- [ ] **App.jsx · 1,646-line component**
  Cognitive load + harder to test in isolation. Phase 3.x of `docs/REFACTOR_PLAN.md` was meant to split this; never done.
  → Touches: `src/App.jsx` · Fix #2

- [x] ~~**App.jsx · L204 — supabase-js auth-lock contention**~~ ✅ closed 2026-05-26 (Fix #15)
  Auto-recovery now fires when stuckGuard hits 4s: clears just the `sb-*-auth-token` keys, sets a one-shot `sessionStorage` flag (prevents reload loops), then `location.reload()`. Manual `localStorage.clear()` workaround retired.

- [ ] **agent-action.js · L1302 — monolith**
  16 action handlers + Anthropic wrapper + Supabase helpers + Slack notifier + agent_events logger all in one file. Editing one action means scrolling past walls of unrelated code.
  → Touches: `netlify/functions/agent-action.js` · Fix #4

- [x] ~~**agent-action.js · 12 hardcoded VitalLyfe prompts**~~ ✅ closed 2026-05-26 (Fix #3 / Move 1)
- [x] ~~**memory.js · L77-81 hardcoded Muse pre-seed**~~ ✅ closed 2026-05-26 (Fix #3 / Move 1)

- [ ] **OpsBoard.jsx — tasks in memory only**
  Refresh resets the board. Multi-user can't share a task list. Needs a DB table.
  → Touches: `src/ui/dashboard/OpsBoard.jsx`, new `supabase/migrations/<date>_tasks.sql` · Fix #12

- [x] ~~**content_items — no migration file**~~ ✅ closed 2026-05-26 (Fix #10 baseline + Fix #10.1 scoped RLS)
  Baseline migration at `supabase/migrations/20260526_content_items_baseline.sql` (25 columns, FK to clients, client_idx, RLS + 3 policies). Follow-up `20260526_content_items_client_rls.sql` adds scoped SELECT+UPDATE for approved `client_users` and drops the wide-open `"Allow all for now"` policy. Anon callers no longer get any content_items rows.

- [x] ~~**Per-client n8n routing**~~ ✅ closed 2026-05-26 (Fix #7)
  `notify.js` now reads `slack_webhook_url` and `n8n_webhook_url` from the client row in one Supabase fetch (was two roundtrips), each falling back to the global env var. Mirrors the Slack pattern shipped 2026-05-25 (commit 702f867) plus a small efficiency win.

---

## 🟢 LOW — track, no urgency

- [ ] **Vantus Slack bot — agent-attributed messages**
  Right now Claude MCP posts as the signed-in user. Set up a real "Vantus" Slack app with bot token → `SLACK_BOT_TOKEN` env → switch `notify.js` + future agent posts to `chat.postMessage`. Would also unlock channel-id routing (re-using the dormant `slack_channel_id` column).
  → Touches: new Slack app + `netlify/functions/notify.js`

- [ ] **cid_posts table — 404 on REST count probe**
  Table may exist with stricter RLS than other tables. Verify in Supabase dashboard.
  → Touches: `supabase/migrations/003_cid_posts.sql` (verify policies)

- [x] ~~**briefgen — 405 KB pdfjs bundle bloat**~~ ✅ closed 2026-05-26 (already shipped — `BriefGenPage.jsx:7` does `await import('pdfjs-dist')` inside `extractPdfText`; build output confirms pdfjs is in its own 405 KB chunk, not bundled into the main 796 KB index)
- [x] ~~**src/agents/ — entire folder is dead code**~~ ✅ closed 2026-05-26 (Fix #8 — `rm -rf src/agents/` — 8 files, 96 lines deleted; build passed)

- [ ] **higgsfield · UI + function untracked**
  `src/apps/higgsfield/HiggsfieldStudio.jsx` + `netlify/functions/higgsfield.js` both in working tree but not git. Plus dirty edits to `src/apps/apps.config.js` and `src/utils/constants.js`. Must ship together (broke CI last time when split) or be deleted together.
  → Touches: those 4 files + `src/App.jsx` import · Fix #9

- [ ] **/api/higgsfield · 404 in production**
  Function not deployed. UI references would fail. Resolved by Fix #9 either direction.

- [x] ~~**CORS still `*` on every function + no rate limits**~~ ✅ closed 2026-05-26 (security sweep)
  CORS allowlist in `_lib/requireUser.js` `cors(event)` matches usevantus.com + the Netlify subdomain + deploy previews. All 6 functions rewritten to call it. New `_lib/rateLimit.js` sliding-window helper wired into /api/chat (30/min/user) and /api/agent-action (60/min/user).
- [x] ~~**CSP / HSTS / Referrer-Policy headers missing**~~ ✅ closed 2026-05-26 (security sweep)
  Added to `netlify.toml`: HSTS preload, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), plus a tight CSP whitelisting only Anthropic/Supabase/Resend/Slack/n8n/Tavily/Apify/Unsplash origins.

- [ ] **Rotate Supabase admin passwords**
  `Cloudai25%` still in git history. Lower urgency now that Google OAuth is the only login path used in practice — but the password path technically still works.
  → Accounts: `cz@`, `dv@`, `ss@` cloudscenic.com

---

## 📋 Numbered Roadmap Fixes (open)

Cross-references map node badges + the items above.

- [x] ~~**#1** — Re-enable Google OAuth + auth gate~~ ✅ commit `8e5095e` + hotfix `d0acec3`
- [x] ~~**#2** — Split App.jsx into smaller components~~ ✅ 2026-05-26 (Codex extracted 6 route components to `src/ui/routes/`; App.jsx 1,676 → 1,342 lines; commits `4ee755b`/`6589b78`/`bee8946`/`f2d384c`/`94eae54`/`c4f2cc5`/`e57e951`)
- [x] ~~**#3** — Brain Move 1: per-client agent voice from `clients.brand_voice_md`~~ ✅ 2026-05-26 (getBrandContext + 12 prompt sites + memory.js seed removal + VitalLyfe SQL seed)
- [ ] **#4** — Split `agent-action.js` into per-handler files → keep as router only
- [x] ~~**#5** — Caller auth on all 5 functions~~ ✅ commit `2a9c9c1` (shared `_lib/requireUser.js`)
- [x] ~~**#6** — Per-client Slack routing~~ ✅ commit `702f867` (`clients.slack_webhook_url`)
- [x] ~~**#7** — Per-client n8n webhook routing in `notify.js`~~ ✅ 2026-05-26 (one combined Supabase fetch for slack+n8n URLs; each falls back to env)
- [x] ~~**#8** — Delete `src/agents/` dead-code folder~~ ✅ 2026-05-26 (`rm -rf src/agents/`; 8 files, 96 lines)
- [ ] **#9** — Ship or delete Higgsfield (both files + nav edits together)
- [x] ~~**#10** — Write `content_items` migration~~ ✅ 2026-05-26 (`20260526_content_items_baseline.sql`)
- [x] ~~**#10.1** — Drop wide-open `"Allow all for now"` policy on content_items~~ ✅ 2026-05-26 (`20260526_content_items_client_rls.sql` adds scoped client policies + drops the wide-open one)
- [x] ~~**#11** — Dynamic-import `pdfjs-dist` in BriefGenPage~~ ✅ already shipped — `BriefGenPage.jsx:7` uses `await import('pdfjs-dist')`; pdfjs lives in its own 405 KB chunk
- [ ] **#12** — Back OpsBoard with a `tasks` table in Supabase
- [ ] **#13** — Per-user client assignments table (now that OAuth is live, this is unblocked)
- [ ] **#14** — Decouple `seed.content.js` from VitalLyfe (or remove — DB is authoritative now)
- [x] ~~**#15** — Auto-recover from supabase-js auth-lock errors~~ ✅ 2026-05-26 (App.jsx stuckGuard now clears sb-auth-token keys + reloads; one-shot sessionStorage flag prevents reload loops)

---

## ✅ Closed 2026-05-26 (Move 1 + leftovers)

- [x] ~~**Fix #3 — Brain Move 1: per-client brand voice**~~
  New `getBrandContext(client_id)` in `agent-action.js:94` fetches `clients.name` + `clients.brand_voice_md` per request. 12 prompt sites refactored to interpolate `${brand.name}` and `${brand.voice}` instead of hardcoded "VitalLyfe / cinematic, calm, purposeful". Dynamic `#${brand.name}` hashtag templates replace `#VitalLyfe` in 3 places. Dead `seedMuseMemory()` removed from `memory.js`. VitalLyfe seeded via `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql`.

- [x] ~~**Fix #3.1 — Rename cid_library.vitallyfe_adaptation → client_adaptation**~~
  Last hardcoded VitalLyfe reference at the agent layer closed. SQL migration: `20260526_cid_library_rename_adaptation.sql` (idempotent — uses `information_schema` check). Three insert sites in `agent-action.js:959-961` updated. Header comment refreshed.

- [x] ~~**Fix #8 — Delete dead src/agents/ folder**~~
  `rm -rf src/agents/` — 8 files, 96 lines. Confirmed zero importers before delete. Build passed clean.

- [x] ~~**Fix #11 — Dynamic-import pdfjs-dist**~~
  Already shipped before this session. `BriefGenPage.jsx:7` does `await import('pdfjs-dist')` inside `extractPdfText`. Vite output confirms pdfjs is in its own 405 KB chunk (`pdf-*.js`), not bundled into the main index. Arch map finding ("main bundle is 777 KB, bulk is pdfjs") was stale — closed in docs only.

- [x] ~~**Fix #2 — Split App.jsx into smaller components (Codex)**~~
  6 route components extracted to `src/ui/routes/`: DashboardRoute (130), AgentsRoute (6), ContentRoute (104), TrackerRoute (117), TaskboardRoute (12), SopsRoute (85). App.jsx 1,676 → 1,342 lines. Build passed after every commit. Highest prop count: TrackerRoute at 13 (under 15-smell threshold). Commits: `4ee755b`, `6589b78`, `bee8946`, `f2d384c`, `94eae54`, `c4f2cc5`, `e57e951`.

- [x] ~~**Security hardening sweep — CORS + rate limits + CSP/HSTS/Permissions/Referrer**~~
  - `_lib/requireUser.js cors(event)` builds per-request CORS from an allowlist regex matching usevantus.com + the Netlify subdomain + deploy previews. All 6 functions rewritten (was `*` on every one).
  - New `_lib/rateLimit.js`: in-memory sliding window keyed on `user.id:endpoint`. Wired into `/api/chat` (30/min) and `/api/agent-action` (60/min). Cold starts reset — acceptable since authentic abuse is already capped by Anthropic + auth.
  - `netlify.toml` headers: HSTS preload (1y), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), and a tight CSP whitelisting only the real external origins (Anthropic, Supabase, Resend, Slack, n8n, Tavily, Apify, Unsplash).

## ✅ Closed 2026-05-25 (kept for history)

- [x] ~~**Fix #1 — Auth bypass in App.jsx + Google OAuth fails**~~
  Auth gate restored, OAuth flow verified. Four-way branch live: admin / approved client / pending invite (realtime unlock) / unknown blocked.
  → Commits: `307b64f` (dedupe setupSession), `8e5095e` (gate + admin RLS), `d0acec3` (4s stuckGuard hotfix)

- [x] ~~**Fix #5 — Caller auth on 5 functions**~~
  Shared helper `netlify/functions/_lib/requireUser.js` validates Supabase JWT. Admin (@cloudscenic.com) OR approved `client_users` row required. Client side stamps every fetch via `src/services/apiFetch.js` (26 call sites).
  → Commit: `2a9c9c1`

- [x] ~~**Fix #6 — Per-client Slack routing**~~
  `notify.js` reads `clients.slack_webhook_url` per client, falls back to global env. Edit Client modal exposes the field under "Optional integrations".
  → Commit: `702f867`

- [x] ~~**External-client invite/allowlist flow**~~
  New `client_users` table + `ClientTeamPanel.jsx` inside Edit Client modal. Admin invites → status='pending' → email approver clicks "approve" → realtime flips status='approved' → external user's PendingApprovalScreen auto-unlocks without refresh.
  → Commits: `2a9c9c1` (table + requireUser), `19b6235` (UI panel)

- [x] ~~**5 temp anon RLS policies + 3 logo bucket anon policies**~~
  All dropped in `20260525_drop_temp_anon_policies.sql`. Admin-only access enforced everywhere (`auth.jwt()->>'email' like '%@cloudscenic.com'`).
  → Commit: `852d915`

---

## Cross-cutting work (still open)

### When Fix #9 (Higgsfield) lands as a SHIP → one atomic commit
Bundle these 5 changes in one commit so CI doesn't break mid-merge again:
1. `src/apps/higgsfield/HiggsfieldStudio.jsx` (new)
2. `netlify/functions/higgsfield.js` (new)
3. `src/apps/apps.config.js` (M — Higgsfield entry in DEFAULT_APPS)
4. `src/utils/constants.js` (M — CREATIVE/Higgsfield section in NAV)
5. `src/App.jsx` (import + render block)
+ Netlify env var: `HIGGSFIELD_ACCESS_TOKEN`

### When fully off password login → rotate Supabase admin passwords
- `cz@cloudscenic.com`, `dv@cloudscenic.com`, `ss@cloudscenic.com`
- `Cloudai25%` is in git history forever — becomes irrelevant once password login is dead
- Where: Supabase dashboard → Authentication → Users → "Send password recovery"

---

## Suggested attack order

1. **#9 (ship or delete Higgsfield)** — decision is the hard part; work is small. Needs your call.
2. **#4** — Split agent-action.js (1,317 lines) into per-handler files. Same shape as #2 — could pass to Codex.
3. **#12, #13, #14** — polish (OpsBoard DB-backed tasks, per-user client assignments, decouple seed.content).

---

## How to keep this current

When you fix an item:
1. Add `~~strikethrough~~` to the bullet OR check the box `[x]`
2. Move the badge count at the top
3. If the fix touched multiple items, mark each
4. Commit alongside the code fix so the punch-list reflects reality

If the architecture changes meaningfully (new tables, new functions, big refactor):
- Regenerate `architecture-map.html` via the `/architecture-map` skill
- The HTML's Bugs & Roadmap tab regenerates from the source data
- Update this file by hand to match the new state
