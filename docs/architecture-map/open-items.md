# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `../../architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-06-03 · **Total open:** 23 bugs + 17 fixes

```
🔴 High:   3    │   ✅ Done:   0
🟡 Med:    8    │
🟢 Low:   12    │   📋 Fixes:  17
```

---

## 🔴 HIGH — fix this week

- [ ] **CIDPage.jsx:381,442 — CID write path throws ReferenceError + uses anon key**
  "Send to Content Tracker" and "Log Results" reference `SUPABASE_URL`/`SUPABASE_KEY` that the file never imports, so both throw on click; even fixed, they write with the browser anon key instead of the user's session.
  → Touches: `src/apps/competitor-intel/CIDPage.jsx` · Fix #1

- [ ] **agent-action.js:822 — `cid_library` has no CREATE TABLE migration**
  Written in code; only a column-rename migration exists. Schema lives in comments. Repo can't recreate the table.
  → Touches: `supabase/migrations/`, `netlify/functions/agent-action.js` · Fix #2

- [ ] **CIDPage.jsx:442 — `cid_performance` has no migration + browser anon write**
  Inserts from the browser with the anon key, implying an unmanaged anon-writable RLS policy off-repo.
  → Touches: `supabase/migrations/`, `src/apps/competitor-intel/CIDPage.jsx` · Fix #1, #2

---

## 🟡 MED — fix when planning next refactor

- [ ] **AnalyticsRoute.jsx:262 / agent-action.js:1087 — "Why these won" scope + ranking** *(operator-flagged)*
  Reasons surface across multiple cards and the top set ranks by raw views; scope to true top performer(s) with one shared metric.
  → Touches: `AnalyticsRoute.jsx`, `agent-action.js` · Fix #3

- [ ] **apify-scrape/unsplash/sync-*/notify — no rate limit**
  Six authenticated functions skip `rateLimit`; any user can loop them to burn Apify credits, hammer paid APIs, or spam email/Slack/n8n.
  → Touches: `apify-scrape.js`, `unsplash.js`, `sync-instagram.js`, `sync-tiktok.js`, `sync-youtube.js`, `notify.js` · Fix #4

- [ ] **oauth-*-deauthorize/data-deletion (×6) — unverified no-op webhooks**
  Never verify signatures or delete data; revoked tokens persist; data-deletion returns a fake code (compliance gap).
  → Touches: 6 webhook files, `_lib/oauth.js` · Fix #5

- [ ] **_lib/oauth.js:122 — OAuth tokens stored plaintext**
  Access/refresh tokens unencrypted at rest; widens blast radius with the never-deleted-on-revoke gap.
  → Touches: `_lib/oauth.js`, `connected_account_tokens`, `sync-*.js` · Fix #6

- [ ] **notify.js:138 — stored/email HTML injection**
  Client-editable fields (esp. `client_note`) interpolated into email HTML unescaped → phishing vector in admin inboxes.
  → Touches: `netlify/functions/notify.js` · Fix #7

- [ ] **App.jsx:134,489 — content_items realtime/load not client-scoped**
  Every browser holds the full multi-tenant set and gets realtime events for off-screen clients; leak risk if an external role reaches the main shell.
  → Touches: `src/App.jsx` · Fix #9

- [ ] **002_profiles.sql:20 — wide-open "Service role full access" RLS**
  `FOR ALL USING(true)` with no role restriction applies to anon/public too.
  → Touches: `supabase/migrations/002_profiles.sql` · Fix #10

- [ ] **requireUser.js:26 — CORS fail-open on writes**
  Non-allowlisted origins still execute writes; CORS provides no real write protection.
  → Touches: `netlify/functions/_lib/requireUser.js` · Fix #17

---

## 🟢 LOW — track, no urgency

- [ ] **chat.js:43 — forwards unvalidated body to Anthropic** (no max_tokens cap / model allowlist) · Fix #8
- [ ] **agent-action.js:669 — dead handler `muse_from_brief`** (zero callers) · Fix #11
- [ ] **App.jsx:12,20,32,33 — dead imports** (OPS_INIT, QuickActionsDashboard, TypingTask, PlaceholderPage) · Fix #11
- [ ] **sync-instagram.js:18,197 — unused declared timeout + serial 30-call insight loop** (26s-timeout risk) · Fix #12
- [ ] **App.jsx:238 — stuckGuard comment says 4s, timeout is 8000ms** · Fix #13
- [ ] **connected_accounts.sql:124 — no cleanup of expired `oauth_states`** · Fix #14
- [ ] **SettingsPage.jsx:154,297 — AI toggles + invite are display-only** (no persistence) · Fix #15
- [ ] **content_items.sql:25 / CIDPage.jsx:368 — text PK, no default + `id:Date.now()`** · Fix #1, #2
- [ ] **clients migrations — VitalLyfe seeded into canonical migration set** · Fix #16
- [ ] **supabaseClient.js:14 — `DB_CONNECTED` hardcoded true** (offline indicator unreachable)
- [ ] **TeamBroadcast.jsx:76 / AgentChatPage.jsx:216 — agent-count copy says 7/8, only 4 exist** · Fix #17
- [ ] **vite.config.js:12 — dev proxy target hardcoded** · Fix #16

---

## 📋 Numbered Roadmap Fixes

- [ ] **#1** — Repair CID write path → `CIDPage.jsx`
- [ ] **#2** — Baseline migrations for `cid_library` + `cid_performance` → `supabase/migrations/`
- [ ] **#3** — Scope "Why these won" + unify ranking metric → `AnalyticsRoute.jsx`, `agent-action.js`
- [ ] **#4** — Rate-limit apify/unsplash/sync-*/notify → 6 functions + `_lib/rateLimit.js`
- [ ] **#5** — Implement OAuth deauthorize + data-deletion → 6 webhook files, `_lib/oauth.js`
- [ ] **#6** — Encrypt OAuth tokens at rest → `_lib/oauth.js`, `connected_account_tokens`
- [ ] **#7** — Escape user input in notify email/Slack → `notify.js`
- [ ] **#8** — Validate chat.js forward → `chat.js`
- [ ] **#9** — Scope content_items realtime by client → `App.jsx`
- [ ] **#10** — Drop wide-open profiles RLS policy → `002_profiles.sql`
- [ ] **#11** — Remove dead code → `agent-action.js`, `App.jsx`
- [ ] **#12** — Fix sync-instagram insight loop/timeout → `sync-instagram.js`
- [ ] **#13** — Fix stuckGuard comment drift → `App.jsx`
- [ ] **#14** — Clean up expired oauth_states → migration / scheduled fn
- [ ] **#15** — Make SettingsPage toggles real or honest → `SettingsPage.jsx`
- [ ] **#16** — De-couple tenant seed + parameterize dev proxy → migrations, `vite.config.js`
- [ ] **#17** — Harden CORS + reconcile agent-count copy → `requireUser.js`, broadcast/chat/skills

---

## Cross-cutting work

### When #2 lands → capture the drift tables in the repo
```sql
-- cid_library (shape from agent-action.js:759-763)
create table if not exists public.cid_library (
  id          bigserial primary key,
  type        text, text text, score numeric, platform text,
  views       bigint, engagement numeric,
  why_it_works text, client_adaptation text,
  created_at  timestamptz not null default now()
);
alter table public.cid_library enable row level security;
create policy "admins manage cid_library" on public.cid_library
  for all to authenticated
  using (lower((auth.jwt()->>'email')) like '%@cloudscenic.com')
  with check (lower((auth.jwt()->>'email')) like '%@cloudscenic.com');
-- cid_performance: define from CIDPage.jsx:450-458 insert body, same RLS shape.
```

### When #14 lands → expired-state cleanup
```sql
delete from public.oauth_states where expires_at < now();
-- schedule via pg_cron (hourly) or a scheduled Netlify function.
```

### OAuth token hardening (#5 + #6 together)
- Encrypt `connected_account_tokens.access_token` / `refresh_token` at rest.
- On platform revoke (deauthorize webhook), delete the `connected_accounts` + token rows.
- Note: IG long-lived tokens have no refresh and expire at 60 days — a re-auth path is needed regardless.

---

## Suggested attack order

1. **#3** — *operator-flagged, high-visibility, contained.* One ranking metric shared front/back, scope reasons to the true top performer(s). Unblocks trust in the headline feature.
2. **#1 + #2** (paired — #1 is dead without #2's tables) — fixes the broken CID write path and the two HIGH schema-drift bugs in one sweep.
3. **#4** — quick, bounds real money/abuse across six functions.
4. **#5 + #6 + #7** (security batch) — OAuth revoke/deletion + token encryption + email escaping; do together while in the OAuth/notify code.
5. **#9 + #10 + #17** — multi-tenant + RLS + CORS hardening before onboarding any non-cloudscenic user.
6. **#8, #11–#16** — cleanup and polish; #11 (dead code) is a 10-minute win whenever.

---

## How to keep this current

When you fix an item:
1. Check the box `[x]` (and `~~strikethrough~~` if you like).
2. Update the badge counts at the top.
3. If a fix touched multiple items, mark each.
4. Commit alongside the code fix so the punch-list reflects reality.

If the architecture changes meaningfully (new tables/functions/big refactor), re-run `/architecture-map` to regenerate `architecture-map.html` + this bundle.
