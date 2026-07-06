# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-07-04 (post-sweep, DEPLOYED) · **Open:** 3 bugs + partials

```
🔴 High:   0    │   ✅ Fixed this pass: 10 items (3 commits)
🟡 Med:    2*   │      *both are partials (admin-scope refactor, Stripe proof)
🟢 Low:    3    │   📋 Fixes shipped: #1, #3, #6, + partial #5/#7/#8
```

> ✅ **Shipped + live.** Commit `a8ff98b` deployed to usevantus.com (HTTP 200); migration `20260704_notify_dedupe_and_cleanup.sql` run against prod (dedupe_key index live, slack_channel_id dropped). The interactive `architecture-map.html` badges are now synced to this list.

---

## ✅ Fixed in the 2026-07-04 sweep (commits 340377c, 7f8bfdb, ed8bd1e)

- [x] **approvals.js — status/stage drift.** recordApproval + markPosted now patch `stage` alongside `status`. → Fix #3
- [x] **notifications — re-approvals never re-notified.** New migration moves the unique index to a cycle-aware `dedupe_key` (includes revision_count); notify.js computes it, approvals.js passes it. Approve → revise → re-approve now notifies again; same-cycle double-fires still collapse. → Fix #3 · **migration run 2026-07-04 (live)**
- [x] **BillingRoute.jsx — invoice email overlap.** On Stripe success the team now gets bell + Slack (via `emailClient:false`) without the client getting a second email; the branded Resend email remains the fallback when Stripe isn't wired. → Fix #5 (email half)
- [x] **index.html:5 — pinch-zoom disabled.** Removed `maximum-scale`/`user-scalable=no`; added apple-touch-icon + favicon. → Fix #1
- [x] **SetupRoute + App.jsx header — sub-44px tap targets.** Service chips, bell, hamburger, and client switcher all at 44px; 8px label → 10px. → Fix #1
- [x] **constants.js — "Posted" missing from STATUSES.** Added to STATUSES/STATUS_COLOR/STAGE_SHORT. → Fix #3
- [x] **crypto.js:7 — silent plaintext token fallback.** encrypt() now throws when TOKEN_ENC_KEY is unset. → Fix #8 (crypto half)
- [x] **Dead code — 3 components + N8N constant.** QuickActionsDashboard, PlaceholderPage, TypingTask deleted; N8N_WEBHOOK_URL removed. → Fix #6
- [x] **clients.slack_channel_id — deprecated column.** Modal field removed; column dropped in the 20260704 migration. → Fix #6
- [x] **App.jsx — client content scoping (client half).** Approved external clients now load only their own content via explicit `.in(client_id)`. → Fix #7 (client half)

---

## 🟡 MED — still open (partials)

- [ ] **App.jsx:143 — admin loads ALL clients' content; cross-client views not per-page-scoped.**
  The client boundary is now doubly-safe (RLS + explicit scope). What remains: the admin app holds every client's rows in one array, and Ledger/Reports/Client Analytics filter at render. Not a defect today — the tracked refactor is giving those pages their own scoped fetches before onboarding the next heavy client.
  → Touches: `src/App.jsx`, admin route components · Fix #7 (admin half)

- [ ] **billing-stripe.js:64 — live invoice create-path never proven.**
  Not a code fix — send one real (small, controlled) invoice and confirm the webhook paid-sync. The email-overlap half is now fixed; this is the remaining validation.
  → Touches: `netlify/functions/billing-stripe.js` · Fix #5 (proof half)

---

## 🟢 LOW — track, no urgency

- [ ] **content_items.publish_date is TEXT.** Left as-is: a live TEXT→date conversion on rows with `''` values carries real risk for a cosmetic gain. Convert only if range-querying by date becomes needed. → Fix #3 (deferred)
- [ ] **_lib/rateLimit.js — in-memory limits reset on cold start.** Accepted tradeoff at current scale; durable store is a later infra change.
- [ ] **agent-action.js — QC v1 doesn't frame-check video.** Emits a warning. Fix #9 is a v2 feature — **not greenlit**, propose before building.
- [ ] **team_members emails blank — chase cron reaches nobody.** Data entry (Setup §4), not code. → Fix #10

---

## 📋 Numbered Roadmap Fixes — status

- [x] **#1** — Mobile a11y pack (zoom, 44px targets, text floor, icon) ✅
- [ ] **#2** — Muse model tiering haiku→sonnet (separate ask — not in this sweep)
- [x] **#3** — Pipeline-state hygiene ✅ *(stage sync, Posted, notify dedupe done; publish_date deferred)*
- [ ] **#4** — Split agent-action.js monolith (unchanged)
- [~] **#5** — Stripe: email overlap ✅ · create-path proof still owed
- [x] **#6** — Dead-code + dead-schema sweep ✅
- [~] **#7** — Client scoping: client half ✅ · admin per-page refactor still open
- [~] **#8** — Security: crypto hard-fail ✅ · password rotation + CSP tightening still open
- [ ] **#9** — QC v2 video frame sampling (NOT greenlit)
- [ ] **#10** — Team roster emails (data entry)

---

## Cross-cutting work

### Migration to run (Supabase SQL editor) — `supabase/migrations/20260704_notify_dedupe_and_cleanup.sql`
Adds `notifications.dedupe_key`, backfills it, swaps the unique index onto it, and drops `clients.slack_channel_id`. The notify-dedupe code tolerates the column being absent (it just sets the field), but re-approval notifications won't work correctly until the index is swapped.

### Env to confirm
- **`TOKEN_ENC_KEY`** must be set in Netlify (32-byte base64). crypto.js now hard-fails without it, so connecting a NEW social account will error until it's set. Already-connected (plaintext) accounts still sync.

### When fully off password login → rotate credentials
- Supabase admin password (`Cloudai25%`) — present in git history.

---

## Suggested attack order (remaining)

1. **Run the 20260704 migration** — unblocks the re-approval notify fix already shipped in code.
2. **#5 Stripe proof** — send one real invoice before a client deadline forces it.
3. **#7 admin scoping** — schedule ahead of the next active-client onboard.
4. **#2 model tiering** — one-line-per-action quality bump (separate greenlight).
5. **#4 monolith split** — after #2 so its diff stays small.

---

## How to keep this current

When you fix an item: check the box, move the snapshot counts, commit alongside the code. On a meaningful architecture change, regenerate `architecture-map.html` via `/architecture-map` (which also refreshes the bug badges this file mirrors).
