# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-05-26 (post Move 1 + Fix #15) · **Total open:** 7 bugs + 9 fixes = 16 items

```
🔴 High:   0    │   ✅ Done:  10  (Fix #1 OAuth, Fix #3 Move 1, Fix #5 caller auth,
🟡 Med:    4    │                  Fix #6 per-client Slack, Fix #15 auth-lock recovery,
🟢 Low:    7    │                  5 temp anon RLS policies, Google secret rotation)
                │   📋 Fixes:  9 open (5 closed)
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

- [ ] **content_items — no migration file**
  Schema lives only in live Supabase. Drift risk between local dev expectations and prod. Every other table has a migration.
  → Touches: new `supabase/migrations/<date>_content_items.sql` · Fix #10

- [ ] **Per-client n8n routing still missing**
  Slack per-client done (`clients.slack_webhook_url`, commit 702f867). n8n still global — every notification trigger goes to one webhook regardless of client.
  → Touches: `netlify/functions/notify.js` · Fix #7

---

## 🟢 LOW — track, no urgency

- [ ] **Vantus Slack bot — agent-attributed messages**
  Right now Claude MCP posts as the signed-in user. Set up a real "Vantus" Slack app with bot token → `SLACK_BOT_TOKEN` env → switch `notify.js` + future agent posts to `chat.postMessage`. Would also unlock channel-id routing (re-using the dormant `slack_channel_id` column).
  → Touches: new Slack app + `netlify/functions/notify.js`

- [ ] **cid_posts table — 404 on REST count probe**
  Table may exist with stricter RLS than other tables. Verify in Supabase dashboard.
  → Touches: `supabase/migrations/003_cid_posts.sql` (verify policies)

- [ ] **briefgen — 405 KB pdfjs bundle bloat**
  `pdfjs-dist` loaded eagerly even when this page is never opened.
  → Touches: `src/apps/brief-gen/BriefGenPage.jsx` · Fix #11 (dynamic-import pdfjs-dist)

- [ ] **src/agents/ — entire folder is dead code**
  8 files, 96 lines, zero importers. Confirmed: `grep -rn "from.*agents/" src/` returns only `src/ui/agents/` matches, never bare `agents/`.
  → Touches: `rm -rf src/agents/` · Fix #8

- [ ] **higgsfield · UI + function untracked**
  `src/apps/higgsfield/HiggsfieldStudio.jsx` + `netlify/functions/higgsfield.js` both in working tree but not git. Plus dirty edits to `src/apps/apps.config.js` and `src/utils/constants.js`. Must ship together (broke CI last time when split) or be deleted together.
  → Touches: those 4 files + `src/App.jsx` import · Fix #9

- [ ] **/api/higgsfield · 404 in production**
  Function not deployed. UI references would fail. Resolved by Fix #9 either direction.

- [ ] **CORS still `*` on every function + no rate limits**
  Auth gate stops anonymous abuse but authenticated misuse is uncapped (one user could hammer /api/chat). Tighten origin to `https://usevantus.com` + add `Retry-After` rate-limiter.
  → Touches: every `netlify/functions/*.js` CORS header + new `_lib/rateLimit.js`

- [ ] **CSP / HSTS / Referrer-Policy headers missing**
  Not set in `netlify.toml`. Lower urgency since auth is JWT-bound + no inline-script eval.
  → Touches: `netlify.toml`

- [ ] **Rotate Supabase admin passwords**
  `Cloudai25%` still in git history. Lower urgency now that Google OAuth is the only login path used in practice — but the password path technically still works.
  → Accounts: `cz@`, `dv@`, `ss@` cloudscenic.com

---

## 📋 Numbered Roadmap Fixes (open)

Cross-references map node badges + the items above.

- [x] ~~**#1** — Re-enable Google OAuth + auth gate~~ ✅ commit `8e5095e` + hotfix `d0acec3`
- [ ] **#2** — Split App.jsx into smaller components → Phase 3.x of REFACTOR_PLAN.md
- [x] ~~**#3** — Brain Move 1: per-client agent voice from `clients.brand_voice_md`~~ ✅ 2026-05-26 (getBrandContext + 12 prompt sites + memory.js seed removal + VitalLyfe SQL seed)
- [ ] **#4** — Split `agent-action.js` into per-handler files → keep as router only
- [x] ~~**#5** — Caller auth on all 5 functions~~ ✅ commit `2a9c9c1` (shared `_lib/requireUser.js`)
- [x] ~~**#6** — Per-client Slack routing~~ ✅ commit `702f867` (`clients.slack_webhook_url`)
- [ ] **#7** — Per-client n8n webhook routing in `notify.js`
- [ ] **#8** — Delete `src/agents/` dead-code folder
- [ ] **#9** — Ship or delete Higgsfield (both files + nav edits together)
- [ ] **#10** — Write `content_items` migration (pull live schema, save as SQL)
- [ ] **#11** — Dynamic-import `pdfjs-dist` in BriefGenPage
- [ ] **#12** — Back OpsBoard with a `tasks` table in Supabase
- [ ] **#13** — Per-user client assignments table (now that OAuth is live, this is unblocked)
- [ ] **#14** — Decouple `seed.content.js` from VitalLyfe (or remove — DB is authoritative now)
- [x] ~~**#15** — Auto-recover from supabase-js auth-lock errors~~ ✅ 2026-05-26 (App.jsx stuckGuard now clears sb-auth-token keys + reloads; one-shot sessionStorage flag prevents reload loops)

---

## ✅ Closed 2026-05-26 (Move 1)

- [x] ~~**Fix #3 — Brain Move 1: per-client brand voice**~~
  New `getBrandContext(client_id)` in `agent-action.js:94` fetches `clients.name` + `clients.brand_voice_md` per request. 12 prompt sites refactored to interpolate `${brand.name}` and `${brand.voice}` instead of hardcoded "VitalLyfe / cinematic, calm, purposeful". Dynamic `#${brand.name}` hashtag templates replace `#VitalLyfe` in 3 places. Dead `seedMuseMemory()` removed from `memory.js`. VitalLyfe seeded via `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql`.
  → Touched: `netlify/functions/agent-action.js`, `src/core/memory.js`, `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql`
  → Out-of-scope follow-up: `cid_library.vitallyfe_adaptation` column name still references VitalLyfe — rename migration tracked as Fix #3.1.

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

### When Fix #7 (per-client n8n) lands → mirror the Slack pattern
```js
// netlify/functions/notify.js — already exists for slack_webhook_url
// add identical block for n8n_webhook_url:
const rows = await sbSelect(`clients?id=eq.${client_id}&select=n8n_webhook_url`);
const perClient = rows?.[0]?.n8n_webhook_url;
const url = perClient || process.env.N8N_WEBHOOK_URL;
```

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

1. **#10 (content_items migration)** — pure schema-in-version-control hygiene; one SQL file. Removes the largest "drift risk" worry. ~15 min.
2. **#7 (per-client n8n)** — already have the pattern from Slack (commit 702f867); 20-minute change.
3. **#3.1 (rename cid_library.vitallyfe_adaptation → client_adaptation)** — Move 1 leftover; one ALTER TABLE + 3 line code change.
4. **#11 (dynamic-import pdfjs)** — bundle size win, ~405 KB off the main chunk.
6. **#8 (delete src/agents/)** — 30-second cleanup.
7. **#9 (ship or delete Higgsfield)** — decision is the hard part; the work is small.
8. **#2, #4** — larger refactors (App.jsx + agent-action.js splits); plan a sprint, not a session.
9. **#12, #13, #14** — polish items.

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
