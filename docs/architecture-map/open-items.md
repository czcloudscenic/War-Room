# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-05-26 PM (clean working tree · Higgsfield WIP cleared · post Move 1 · #15 · #10/10.1 · #7 · #8 · #11 · #3.1 · #2 App.jsx split · security sweep · #9 closed by removal)

**Open work:** 3 MED bugs · 4 LOW track-only · 4 numbered fixes (#4, #12, #13, #14 — #4 and #12 overlap MED bugs).

```
🔴 High:   0    │   ✅ Done:  19  (Fix #1 OAuth, Fix #2 App.jsx split (Codex),
🟡 Med:    3    │                  Fix #3 Move 1, Fix #3.1 cid_library rename,
🟢 Low:    4    │                  Fix #5 caller auth, Fix #6 per-client Slack,
                │                  Fix #7 per-client n8n, Fix #8 delete dead src/agents/,
                │                  Fix #9 Higgsfield closed-by-removal, Fix #10
                │                  baseline + #10.1 scoped RLS, Fix #11 pdfjs dynamic,
                │                  Fix #15 auth-lock recovery, security hardening sweep
                │                  (CORS + rate limits + CSP/HSTS/Permissions/Referrer),
                │                  5 temp anon RLS policies, Google secret rotation)
                │   📋 Fixes:  4 open (13 closed)
```

---

## 🔴 HIGH — fix this week

_None open as of 2026-05-26 PM. Last HIGH-severity batch closed 2026-05-25 (auth restore)._

---

## 🟡 MED — fix when planning next refactor

- [ ] **agent-action.js · L1317 — monolith**
  1,317 lines, 16 action handlers + Anthropic wrapper + Supabase helpers + Slack notifier + agent_events logger + `getBrandContext` + rate-limit gate. Same mechanical shape as the App.jsx split Codex just landed → ideal Codex candidate. Brief = handler line ranges + dirty-WIP exclusion + `CODEX_NOTES.md` as the report.
  → Touches: `netlify/functions/agent-action.js` · Fix #4

- [ ] **App.jsx · L1342 — still owns all state**
  Down from 1,676 to 1,342 after Codex extracted 6 route components into `src/ui/routes/` (Fix #2 shipped 2026-05-26). Routes are pure presentation now, but App.jsx still owns every piece of state in the app — `currentClient`, content/notifications/clients fetch + realtime subs, modal state, the works. Deeper extraction (state hooks, context providers) is the next refactor — lower urgency than the agent-action.js split, no clean Codex pattern yet.
  → Touches: `src/App.jsx` (state extraction TBD)

- [ ] **OpsBoard.jsx — tasks in memory only**
  Refresh resets the board. Multi-user can't share a task list. Needs a DB table — schema sketch in `roadmap.md` Fix #12.
  → Touches: `src/ui/dashboard/OpsBoard.jsx`, new `supabase/migrations/<date>_tasks.sql` · Fix #12

---

## 🟢 LOW — track, no urgency

- [ ] **Vantus Slack bot — agent-attributed messages**
  Right now Claude MCP posts as the signed-in user. Set up a real "Vantus" Slack app with bot token → `SLACK_BOT_TOKEN` env → switch `notify.js` + future agent posts to `chat.postMessage`. Would also unlock channel-id routing (re-using the dormant `slack_channel_id` column).
  → Touches: new Slack app + `netlify/functions/notify.js`

- [ ] **cid_posts table — 404 on REST count probe**
  Table may exist with stricter RLS than other tables. Verify in Supabase dashboard.
  → Touches: `supabase/migrations/003_cid_posts.sql` (verify policies)

- [ ] **Rotate Supabase admin passwords**
  `Cloudai25%` still in git history. Lower urgency now that Google OAuth is the only login path used in practice — but the password path technically still works.
  → Accounts: `cz@`, `dv@`, `ss@` cloudscenic.com

- [ ] **Tighten `style-src 'unsafe-inline'` in CSP**
  Required by current inline-style React patterns. When inline styles get factored out, drop `'unsafe-inline'` from `style-src` in `netlify.toml`.
  → Touches: `netlify.toml` (after inline-style refactor)

---

## 📋 Numbered Roadmap Fixes

Cross-references map node badges + the items above.

- [x] ~~**#1** — Re-enable Google OAuth + auth gate~~ ✅ commit `8e5095e` + hotfix `d0acec3`
- [x] ~~**#2** — Split App.jsx into smaller components~~ ✅ 2026-05-26 (Codex extracted 6 route components to `src/ui/routes/`; App.jsx 1,676 → 1,342 lines; 7 commits: `4ee755b`/`6589b78`/`bee8946`/`f2d384c`/`94eae54`/`c4f2cc5`/`e57e951`)
- [x] ~~**#3** — Brain Move 1: per-client agent voice from `clients.brand_voice_md`~~ ✅ 2026-05-26 (getBrandContext + 12 prompt sites + memory.js seed removal + VitalLyfe SQL seed; commit `767cb93`)
- [x] ~~**#3.1** — Rename `cid_library.vitallyfe_adaptation` → `client_adaptation`~~ ✅ 2026-05-26 (idempotent SQL migration + 3 code sites; commit `183d53f`)
- [ ] **#4** — Split `agent-action.js` into per-handler files → keep as router only
- [x] ~~**#5** — Caller auth on all 5 functions~~ ✅ commit `2a9c9c1` (shared `_lib/requireUser.js`)
- [x] ~~**#6** — Per-client Slack routing~~ ✅ commit `702f867` (`clients.slack_webhook_url`)
- [x] ~~**#7** — Per-client n8n webhook routing in `notify.js`~~ ✅ 2026-05-26 (one combined Supabase fetch for slack+n8n URLs; each falls back to env; commit `2bb8958`)
- [x] ~~**#8** — Delete `src/agents/` dead-code folder~~ ✅ 2026-05-26 (`rm -rf src/agents/`; 8 files, 96 lines; commit `4b54630`)
- [x] ~~**#9** — Ship or delete Higgsfield~~ ✅ 2026-05-26 PM (closed by removal — both WIP files no longer in tree; never were in git on main; `apps.config.js` + `constants.js` clean. Future Higgsfield ship is a fresh atomic commit.)
- [x] ~~**#10** — Write `content_items` migration~~ ✅ 2026-05-26 (`20260526_content_items_baseline.sql`; commit `ed46c31`)
- [x] ~~**#10.1** — Drop wide-open `"Allow all for now"` policy on content_items~~ ✅ 2026-05-26 (`20260526_content_items_client_rls.sql` adds scoped client policies + drops the wide-open one; commit `5a51b00`)
- [x] ~~**#11** — Dynamic-import `pdfjs-dist` in BriefGenPage~~ ✅ already shipped — `BriefGenPage.jsx:7` uses `await import('pdfjs-dist')`; pdfjs lives in its own 405 KB chunk
- [ ] **#12** — Back OpsBoard with a `tasks` table in Supabase
- [ ] **#13** — Per-user client assignments table (now that OAuth + `client_users` are live, this is unblocked)
- [ ] **#14** — Decouple `seed.content.js` from VitalLyfe (or remove — DB is authoritative now)
- [x] ~~**#15** — Auto-recover from supabase-js auth-lock errors~~ ✅ 2026-05-26 (App.jsx stuckGuard now clears `sb-*-auth-token` keys + reloads; one-shot sessionStorage flag prevents reload loops; commit `2b43364`)

---

## ✅ Closed 2026-05-26 PM (Higgsfield WIP cleanup)

- [x] ~~**Fix #9 — Higgsfield WIP files in inconsistent state**~~
  `src/apps/higgsfield/HiggsfieldStudio.jsx` + `netlify/functions/higgsfield.js` removed from working tree. Verified neither file exists on local HEAD or `origin/main` (`git ls-tree -r origin/main | grep higgs` → empty). `src/apps/apps.config.js` + `src/utils/constants.js` confirmed clean — no CREATIVE section, no Higgsfield DEFAULT_APPS entry. If Higgsfield ships later, it's a fresh atomic commit on a fresh branch, not a recovered orphan. Old broken-CI risk from `5d5300b` no longer applies.

## ✅ Closed 2026-05-26 (Move 1 + leftovers)

- [x] ~~**Fix #3 — Brain Move 1: per-client brand voice**~~
  New `getBrandContext(client_id)` in `agent-action.js:94` fetches `clients.name` + `clients.brand_voice_md` per request. 12 prompt sites refactored to interpolate `${brand.name}` and `${brand.voice}` instead of hardcoded "VitalLyfe / cinematic, calm, purposeful". Dynamic `#${brand.name}` hashtag templates replace `#VitalLyfe` in 3 places. Dead `seedMuseMemory()` removed from `memory.js`. VitalLyfe seeded via `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql`.

- [x] ~~**Per-request voice override**~~
  `agent-action.js` accepts `payload.voiceOverride` and substitutes it for `brand.voice` for that call. `AgentChatPage.jsx` exposes a textarea above quick actions — useful for "try a punchier tone" runs without touching the client's saved brand_voice_md.

- [x] ~~**Fix #3.1 — Rename cid_library.vitallyfe_adaptation → client_adaptation**~~
  Last hardcoded VitalLyfe reference at the agent layer closed. SQL migration: `20260526_cid_library_rename_adaptation.sql` (idempotent — uses `information_schema` check). Three insert sites in `agent-action.js` updated. Header comment refreshed.

- [x] ~~**Fix #8 — Delete dead src/agents/ folder**~~
  `rm -rf src/agents/` — 8 files, 96 lines. Confirmed zero importers before delete. Build passed clean.

- [x] ~~**Fix #11 — Dynamic-import pdfjs-dist**~~
  Already shipped before this session. `BriefGenPage.jsx:7` does `await import('pdfjs-dist')` inside `extractPdfText`. Vite output confirms pdfjs is in its own 405 KB chunk (`pdf-*.js`), not bundled into the main index. Arch map finding ("main bundle is 777 KB, bulk is pdfjs") was stale — closed in docs only.

- [x] ~~**Fix #2 — Split App.jsx into smaller components (Codex)**~~
  6 route components extracted to `src/ui/routes/`: DashboardRoute (130), AgentsRoute (6), ContentRoute (104), TrackerRoute (117), TaskboardRoute (12), SopsRoute (85). App.jsx 1,676 → 1,342 lines. Build passed after every commit. Highest prop count: TrackerRoute at 13 (under 15-smell threshold). Commits: `4ee755b`, `6589b78`, `bee8946`, `f2d384c`, `94eae54`, `c4f2cc5`, `e57e951`.

- [x] ~~**Security hardening sweep — CORS + rate limits + CSP/HSTS/Permissions/Referrer**~~
  - `_lib/requireUser.js cors(event)` builds per-request CORS from an allowlist regex matching usevantus.com + the Netlify subdomain + deploy previews. All 6 functions rewritten (was `*` on every one).
  - New `_lib/rateLimit.js`: in-memory sliding window keyed on `user.id:endpoint`. Wired into `/api/chat` (30/min) and `/api/agent-action` (60/min). Cold starts reset — acceptable since auth + RLS are primary defense.
  - `netlify.toml` headers: HSTS preload (1y), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), and a tight CSP whitelisting only the real external origins (Anthropic, Supabase, Resend, Slack, n8n, Tavily, Apify, Unsplash).

- [x] ~~**Fix #15 — Auto-recover from supabase-js auth-lock errors**~~
  Auto-recovery now fires when stuckGuard hits 4s: clears just the `sb-*-auth-token` keys (preserves agent histories + apps prefs), sets a one-shot `sessionStorage` flag (prevents reload loops), then `location.reload()`. Manual `localStorage.clear()` workaround retired. Commit `2b43364`.

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

### When fully off password login → rotate Supabase admin passwords
- `cz@cloudscenic.com`, `dv@cloudscenic.com`, `ss@cloudscenic.com`
- `Cloudai25%` is in git history forever — becomes irrelevant once password login is dead
- Where: Supabase dashboard → Authentication → Users → "Send password recovery"

### When inline-style React patterns get factored out → tighten CSP
- Drop `'unsafe-inline'` from `style-src` in `netlify.toml`
- Currently required because several React components use inline style objects

---

## Suggested attack order

1. **#4 (agent-action.js split)** — same mechanical shape as Codex's Fix #2 App.jsx split. Brief Codex with the handler line ranges and a dirty-WIP exclusion list, get a `CODEX_NOTES.md` report. Closing this unblocks per-handler iteration (currently every edit means scrolling past 16 unrelated handlers). Highest leverage open item.
2. **#12 (OpsBoard DB-backed tasks)** — small migration + UI rewrite, ~1hr. Schema sketch already in `roadmap.md`. Closes a med-severity bug.
3. **#13 (per-user client assignments)** — small, unlocks per-Cloud-Scenic-teammate client scoping. Could fold into `client_users` instead of a new table.
4. **#14 (decouple seed.content.js from VitalLyfe)** — or just delete (DB is authoritative).
5. **App.jsx state extraction** — no fix# yet, no clean Codex pattern. Defer until #4 lands and Codex pattern is proven a second time.
6. **Slack bot + Supabase password rotation + CSP `style-src` tightening** — track-only, no deadline.

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
