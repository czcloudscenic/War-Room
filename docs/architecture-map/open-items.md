# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `../../architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-06-04 · **Total open:** 14 bugs + 11 fixes

```
🔴 High:   0    │   ✅ Done:  13  (security/OAuth batch)
🟡 Med:    7    │
🟢 Low:    7    │   📋 Fixes:  11
```

---

## 🔴 HIGH — fix this week

_None open — the high-severity items (CID write ReferenceError + missing migrations) shipped in the security batch._

---

## 🟡 MED — fix when planning next refactor

- [ ] **AnalyticsRoute.jsx:262 — "Why these won" scope + ranking** *(operator-flagged)*
  Reasons surface across multiple cards and the top set ranks by raw views; scope to the true top performer(s) with one shared metric.
  → Touches: `AnalyticsRoute.jsx`, `agent-action.js` · Fix #1

- [ ] **agent-action.js:1236/1289/1074 — Opus 4.8 vs 26s function timeout**
  The three Muse-creative actions generate on Opus 4.8 with `getSyncedDigest` + serial Tavily research stacked on the same request — slow runs can 502.
  → Touches: `agent-action.js` · Fix #2

- [ ] **agent-action.js:621/486/552/1402 — silent parse failures reported as success**
  Bad model-JSON is caught and returned as `success:true` with an empty result — looks like a genuine zero-result.
  → Touches: `agent-action.js` · Fix #5

- [ ] **IdeaEngineRoute.jsx:73 — client-generated content_items id**
  Inserts with `${slug}-idea-${Date.now()}` — collision/type risk, bypasses DB default.
  → Touches: `IdeaEngineRoute.jsx` · Fix #3

- [ ] **IdeaEngineRoute.jsx:48 — film-brief call has no timeout guard**
  A slow Opus brief hangs the modal on the spinner with no escape but closing it.
  → Touches: `IdeaEngineRoute.jsx` · Fix #4

- [ ] **IdeaEngineRoute.jsx:81 — null-client insert orphans rows**
  `client_id` only attached when truthy; a null-client send writes an unscoped `content_items` row.
  → Touches: `IdeaEngineRoute.jsx` · Fix #3

- [ ] **App.jsx:490 — content_items realtime not client-scoped**
  Every browser holds the full multi-tenant set and gets realtime events for off-screen clients; relies solely on RLS.
  → Touches: `src/App.jsx` · Fix #6

---

## 🟢 LOW — track, no urgency

- [ ] **agent-action.js:669 — dead handler `muse_from_brief`** (zero callers) · Fix #7
- [ ] **agent-action.js:1320 — `getSyncedDigest` reads all rows via service role** (multi-tenant leak latent) · Fix #9
- [ ] **agent-action.js:994 — `muse_ig_ideas` duplicates the Tavily block inline** · Fix #11
- [ ] **App.jsx — stuckGuard comment says 4s, timeout is 8000ms** · Fix #8
- [ ] **content_items.sql:25 — text PK, no default** (App + Idea Engine mint ids client-side) · Fix #10
- [ ] **supabaseClient.js:14 — `DB_CONNECTED` hardcoded true** (offline indicator unreachable)
- [ ] **QuickActionsDashboard.jsx:26 — dead component** (imported, never rendered) · Fix #7

---

## ✅ Done — security / OAuth batch (2026-06-03/04)

- [x] **#1** Repair CID write path → `CIDPage.jsx` (now via `sb` client)
- [x] **#2** `cid_library` + `cid_performance` baseline migrations
- [x] **#4** Rate-limit apify/unsplash/sync-*/notify (6 functions)
- [x] **#5** Real OAuth deauthorize/data-deletion — Meta `signed_request` verify + token deletion + `data_deletion_requests` audit table
- [x] **#6** Encrypt OAuth tokens at rest (AES-256-GCM, `_lib/crypto.js`)
- [x] **#7** Escape user input in notify email/Slack
- [x] **#8** Validate chat.js model allowlist + max_tokens
- [x] **#10** Drop wide-open `profiles` RLS policy
- [x] **#12** sync-instagram timeout + concurrency cap
- [x] **#14** `oauth_states` expiry cleanup
- [x] **#15** SettingsPage toggles persist / invite labeled
- [x] **#16** De-couple VitalLyfe seed (`supabase/seed/dev_seed.sql`) + dev-proxy env var
- [x] **#17** CORS 403 on bad origins + agent-count copy → 4

---

## 📋 Numbered Roadmap Fixes (open)

- [ ] **#1** — Scope "Why these won" + unify ranking metric → `AnalyticsRoute.jsx`, `agent-action.js`
- [ ] **#2** — Guard Opus generation vs 26s timeout → `agent-action.js`
- [ ] **#3** — Idea Engine server-side ids + block null-client send → `IdeaEngineRoute.jsx`
- [ ] **#4** — Idea Engine timeout/abort on brief call → `IdeaEngineRoute.jsx`
- [ ] **#5** — Surface silent parse failures as errors → `agent-action.js`
- [ ] **#6** — Scope content_items realtime by client → `App.jsx`
- [ ] **#7** — Remove dead `muse_from_brief` + `QuickActionsDashboard`
- [ ] **#8** — Fix stuckGuard comment drift → `App.jsx`
- [ ] **#9** — Scope `getSyncedDigest` by user_id → `agent-action.js`
- [ ] **#10** — Document content_items text-PK convention
- [ ] **#11** — Reuse `_researchDigest` in `muse_ig_ideas`

---

## Cross-cutting work

### Founder follow-ups now LIVE (2026-06-04)
- `TOKEN_ENC_KEY` set in Netlify (do NOT rotate casually — would orphan encrypted tokens).
- Migrations applied to live Supabase: `20260603_drop_profiles_anon_policy.sql`, `20260604_data_deletion_requests.sql` (+ the CID baselines on 2026-06-03).

### Before onboarding a second client (multi-tenant)
- Land **#6** (realtime scope) and **#9** (getSyncedDigest user scope) together — both are single-tenant-safe today but leak across clients otherwise.

---

## Suggested attack order

1. **#1** — operator-flagged, contained, highest visibility. Unblocks trust in the headline feature.
2. **#2 + #4** (paired) — the Opus-timeout + modal-hang pair that makes the Idea Engine actually reliable.
3. **#3** — Idea Engine data integrity (ids + null-client). Quick.
4. **#6 + #9** — multi-tenant safety, before any second client.
5. **#5, #7, #8, #10, #11** — hygiene; #7 (dead code) is a 10-minute win anytime.

---

## How to keep this current

When you fix an item: check the box, move the badge counts, and commit alongside the code fix. If the architecture changes meaningfully, re-run `/architecture-map` to regenerate the HTML + this bundle.
