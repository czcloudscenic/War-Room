# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-05-25 · **Total open:** 14 bugs + 12 fixes = 26 items

```
🔴 High:   0    │   ✅ Done:   5  (Fix #1 + Fix #2 + auth bypass + 3 unauthed funcs)
🟡 Med:    7    │
🟢 Low:    7    │   📋 Fixes: 12
```

---

## 🔴 HIGH — fix this week

- [x] ~~**App.jsx · L116-117 — AUTH BYPASS**~~ ✅ closed 2026-05-25
  ~~Anonymous visitors get admin access. `if(!session)` commented out.~~
  → Re-enabled in commit `8e5095e`. Auth gate live + verified with cz@cloudscenic.com and second Google account.

- [x] ~~**agent-action.js — no caller auth**~~ ✅ closed 2026-05-25 (Fix #2 / commit 2a9c9c1)
- [x] ~~**chat.js — no caller auth + no rate limit**~~ ✅ closed 2026-05-25 (Fix #2 / commit 2a9c9c1)
  Rate limiting still TBD — only the auth gate landed.
- [x] ~~**notify.js — no caller auth**~~ ✅ closed 2026-05-25 (Fix #2 / commit 2a9c9c1)

---

## 🟡 MED — fix when planning next refactor

- [ ] **App.jsx · 1,471-line component**
  Cognitive load + harder to test. Phase 3.x of REFACTOR_PLAN.md.
  → Fix #2

- [ ] **agent-action.js · L1255 monolith**
  16 action handlers + Anthropic + Supabase + Slack + logger all in one file.
  → Fix #4

- [ ] **agent-action.js · L138-144 — hardcoded VitalLyfe brand voice**
  Wrong for any non-VitalLyfe client. The reason multi-tenancy is a lie until fixed.
  → Fix #3 (Brain Move 1)

- [ ] **memory.js · L75-81 — hardcoded Muse pre-seed**
  Same Move 1 blocker.
  → Fix #3

- [ ] **notify.js — global SLACK_WEBHOOK_URL ignored per-client**
  All notifications go to `#vitallyfe-war-room`. `clients.slack_channel_id` exists but unused.
  → Fix #6

- [ ] **OpsBoard.jsx — tasks in memory only**
  Refresh resets the board. Multi-user can't share.
  → Fix #12

- [ ] **content_items — no migration file**
  Schema lives only in live Supabase. Drift risk.
  → Fix #10

- [x] ~~**google-oauth — exchange fails**~~ ✅ closed 2026-05-25
  ~~"Unable to exchange external code" — likely client_secret mismatch.~~
  → Root cause: Google client_secret in Supabase didn't match Google's active value. Reset both in lockstep. Verified working.

---

## 🟢 LOW — track, no urgency

- [ ] **Vantus Slack bot — agent-attributed messages**
  Right now Claude MCP posts as the signed-in user. Set up a real "Vantus" Slack app with bot token → `SLACK_BOT_TOKEN` env → switch notify.js + future agent posts to `chat.postMessage`. Will also let us reuse the deprecated `slack_channel_id` field for per-client routing by channel ID instead of webhook URLs.
  → Touches: new Slack app + `netlify/functions/notify.js`


- [ ] **cid_posts table — 404 on REST count probe**
  Table may exist with stricter RLS than other tables. Verify in dashboard.

- [ ] **briefgen — 405 KB pdfjs bundle bloat**
  Loaded eagerly even when never used.
  → Fix #11 (dynamic-import pdfjs-dist)

- [ ] **src/agents/ — entire folder is dead code**
  8 files, 96 lines, zero importers.
  → Fix #8 (safe to `rm -r`)

- [ ] **higgsfield · UI + function untracked**
  `HiggsfieldStudio.jsx` + `higgsfield.js` both in working tree but not git.
  → Fix #9 (ship together or delete)

- [ ] **/api/higgsfield · 404 in production**
  Function not deployed.

- [ ] **5 temp anon RLS policies**
  Tagged TODO — must drop when OAuth restored.
  - `agent_events.sql:34`
  - `notifications.sql:44-49`
  - `clients_multitenant.sql:44-46`
  - `client_logos_bucket.sql:16,20,24`

---

## 📋 Numbered Roadmap Fixes

Cross-references map node badges + the items above.

- [ ] **#1** — Re-enable Google OAuth → `src/App.jsx:117` + Supabase auth-logs
- [ ] **#2** — Split App.jsx into smaller components → Phase 3.x of REFACTOR_PLAN.md
- [ ] **#3** — Brain Move 1: per-client agent voice from `clients.brand_voice_md` → `agent-action.js` + `memory.js`
- [ ] **#4** — Split agent-action.js into per-handler files → keep as router only
- [ ] **#5** — Caller auth on all functions (copy `cid-scrape.js` bearer pattern)
- [ ] **#6** — Per-client Slack channel routing in `notify.js`
- [ ] **#7** — Per-client n8n webhook routing in `notify.js`
- [ ] **#8** — Delete `src/agents/` dead-code folder
- [ ] **#9** — Ship or delete Higgsfield (both files together)
- [ ] **#10** — Write `content_items` migration (pull live schema, save as SQL)
- [ ] **#11** — Dynamic-import `pdfjs-dist` in BriefGenPage
- [ ] **#12** — Back OpsBoard with a `tasks` table in Supabase
- [ ] **#13** — Per-user client assignments table (after OAuth restored)
- [ ] **#14** — Decouple `seed.content.js` from VitalLyfe (or remove it)

---

## Cross-cutting work

### When #1 lands → drop these temp policies
```sql
drop policy "anon read while auth bypassed (TODO remove)" on public.agent_events;
drop policy "anon read while auth bypassed (TODO remove)" on public.notifications;
drop policy "anon update while auth bypassed (TODO remove)" on public.notifications;
drop policy "anon read clients (TODO remove)" on public.clients;
drop policy "anon write clients (TODO remove)" on public.clients;
drop policy "Anon upload client-logos (TODO restrict to admins when auth back)" on storage.objects;
drop policy "Anon update client-logos (TODO restrict to admins when auth back)" on storage.objects;
drop policy "Anon delete client-logos (TODO restrict to admins when auth back)" on storage.objects;
```

### When fully on Google OAuth → rotate Supabase admin passwords
- `cz@cloudscenic.com`, `dv@cloudscenic.com`, `ss@cloudscenic.com`
- Old `Cloudai25%` is in git history forever — becomes irrelevant once password login is dead

---

## Suggested attack order

1. **#1 + #2** (Google OAuth + auth gate) — unblocks 8 downstream items
2. **#5** (caller auth on 5 functions) — security debt
3. **#3** (Brain Move 1) — makes multi-tenancy real
4. **#6 + #7** (per-client routing) — multi-tenant polish
5. **#10** (content_items migration) — quick win
6. **#11** (dynamic-import pdfjs) — bundle size win
7. **#8** (delete src/agents/) — cleanup
8. **#9** (ship or delete Higgsfield) — decision
9. **#4** (split agent-action.js) — bigger refactor
10. **#12, #13, #14** — polish

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
