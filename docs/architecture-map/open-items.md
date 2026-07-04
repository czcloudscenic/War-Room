# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-07-04 · **Total open:** 16 bugs + 10 fixes = 20 items (bugs cross-reference fixes)

```
🔴 High:   0    │   ✅ Done 7/3: 5 (insert bug, dup cards, double-notify,
🟡 Med:    8    │                 OAuth origin, Resend domain)
🟢 Low:    8    │   📋 Fixes:  10
```

---

## 🔴 HIGH — fix this week

*(none open — the 7/3 campaign cleared this tier)*

---

## 🟡 MED — fix when planning next refactor

- [ ] **src/core/approvals.js:45-47 — approvals advance status but not stage**
  After a Ledger approve, rows drift (seen live 7/3: status "Approved", stage "Need Content Approval"). Anything keyed on stage mis-buckets.
  → Touches: `src/core/approvals.js`, `src/utils/constants.js` · Fix #3

- [ ] **src/App.jsx:476,491 — global content fetch + unfiltered realtime**
  All clients' items live in browser state, scoped only at render. One missed filter = cross-client bleed (one instance already bitten + fixed 7/3).
  → Touches: `src/App.jsx`, admin pages needing all-clients data · Fix #7

- [ ] **20260523_notifications.sql:21 — re-approvals never re-notify**
  unique(type, content_item_id) is a forever-dedupe; approve → revisions → re-approve is silent on bell, Slack, and email. Decide the semantics explicitly.
  → Touches: `supabase/migrations/`, `netlify/functions/notify.js` · Fix #3

- [ ] **BillingRoute.jsx:104-112 — branded invoice email only fires when Stripe FAILS**
  With Stripe live, clients only ever get Stripe's own email; the Vantus-branded notice is dead code on the success path.
  → Touches: `src/ui/routes/BillingRoute.jsx`, `netlify/functions/notify.js` · Fix #5

- [ ] **billing-stripe.js:64 — live invoice create-path never proven**
  Webhook verified, key live, handleCreate untested against a real invoice. Validate deliberately with a small controlled invoice.
  → Touches: `netlify/functions/billing-stripe.js` · Fix #5

- [ ] **index.html:5 — pinch-zoom disabled app-wide**
  `maximum-scale=1.0, user-scalable=no` blocks zoom for everyone; compounds the 8px micro-labels (7/4 mobile audit).
  → Touches: `index.html` · Fix #1

- [ ] **SetupRoute.jsx — 51-94 sub-40px tap targets at phone widths**
  Service chips are 50×25; the page most likely to be poked from a phone is the least thumb-friendly (7/4 mobile audit).
  → Touches: `src/ui/routes/SetupRoute.jsx`, App.jsx header · Fix #1

- [ ] **_lib/crypto.js:7 — silent PLAINTEXT fallback for OAuth tokens**
  If TOKEN_ENC_KEY is unset, tokens store unencrypted with no alarm — same silent-degradation class as the two 7/3 config outages.
  → Touches: `netlify/functions/_lib/crypto.js` · Fix #8

---

## 🟢 LOW — track, no urgency

- [ ] **20260526_content_items_baseline.sql:47 — publish_date is TEXT** → Fix #3 batch
- [ ] **constants.js:33 — "Posted" missing from STATUSES** (markPosted sets it at runtime) → Fix #3
- [ ] **App.jsx:20,25,26 — three dead components ship in the bundle** (QuickActionsDashboard, PlaceholderPage, TypingTask) → Fix #6
- [ ] **agent-action.js:21 — dead N8N_WEBHOOK_URL constant** → Fix #6
- [ ] **clients.slack_channel_id — deprecated column never dropped** → Fix #6
- [ ] **_lib/rateLimit.js — in-memory limits reset on cold start** (accepted tradeoff; revisit at scale)
- [ ] **agent-action.js:333 — QC v1 doesn't frame-check video** (warning emitted) → Fix #9
- [ ] **team_members emails blank — chase cron reaches nobody** (data entry) → Fix #10

---

## 📋 Numbered Roadmap Fixes

Cross-references map node badges + the items above.

- [ ] **#1** — Mobile a11y pack (zoom, 44px targets, text floor, touch icon) → `index.html`, App.jsx header, SetupRoute.jsx
- [ ] **#2** — Muse model tiering haiku→sonnet for client-facing output → agent-action.js :487/:936/:840
- [ ] **#3** — Pipeline-state hygiene (stage sync, Posted, notify semantics, publish_date) → approvals.js, constants.js, migration
- [ ] **#4** — Split agent-action.js monolith (1,753 lines) → `_actions/` modules + dispatcher
- [ ] **#5** — Prove Stripe create-path + invoice email overlap decision → billing-stripe.js, BillingRoute.jsx
- [ ] **#6** — Dead-code + dead-schema sweep → 3 components, N8N constant, slack_channel_id
- [ ] **#7** — Client-scope global content fetch/realtime → App.jsx:476,491
- [ ] **#8** — Security debt (crypto hard-fail, password rotation, CSP style-src) → _lib/crypto.js, Supabase auth, netlify.toml
- [ ] **#9** — QC v2 video frame sampling (NOT greenlit — propose first) → EditContentModal, agent-action qc_review
- [ ] **#10** — Team roster emails (data entry) → Setup section 4

---

## Cross-cutting work

### When #6 lands → schema cleanup migration
```sql
-- supabase/migrations/2026xxxx_drop_deprecated.sql
alter table public.clients drop column if exists slack_channel_id;
```

### Test-data cleanup (owed from the 7/3 campaign — after the 7/4 cron send lands)
```sql
-- archive the test client and remove its artifacts
update public.clients set status='archived', archived_at=now() where id='4bf5e953-a9d5-4b09-9159-7a3c5d240e35';
delete from public.content_items where id='qc-test-kitchen-a1-price';
delete from public.client_vault where client_id='4bf5e953-a9d5-4b09-9159-7a3c5d240e35';
delete from public.client_reports where client_id='4bf5e953-a9d5-4b09-9159-7a3c5d240e35';
-- plus: remove the test flyer from Google Drive; delete the abandoned live-mode Stripe customer (optional, harmless)
```

### When fully off password login → rotate credentials
- Supabase admin password (`Cloudai25%`) — present in git history, rotate at the dashboard
- Confirm `TOKEN_ENC_KEY` is set in Netlify (crypto.js silently degrades without it — see Fix #8)

---

## Suggested attack order

1. **#1 (mobile a11y pack)** — smallest real-user impact win; closes the 7/4 audit + D5; pure frontend, zero risk.
2. **#3 (state hygiene)** — the stage/status drift is quietly corrupting row consistency on every approve; do it before more views key on stage. Includes the notify-semantics decision.
3. **#2 (model tiering)** — one-line-per-action quality bump on the exact output clients read; already agreed in principle.
4. **#5 (Stripe proof)** — do it deliberately before a client deadline forces it; unblocks confident invoicing for the NYC Gyro-class deals.
5. **#6 (dead-code sweep)** — 30-minute hygiene; do it inside any quiet moment.
6. **#7 (client scoping)** — schedule ahead of onboarding the next active client; kills a whole bug class.
7. **#8 (security debt)** — crypto hard-fail is 10 lines; password rotation when auth migration completes.
8. **#4 (monolith split)** — biggest refactor; sequence AFTER #2/#3 so their diffs stay small, BEFORE the next batch of new actions.
9. **#9 / #10** — #9 needs a greenlight; #10 is a data-entry ask, not engineering.

---

## How to keep this current

When you fix an item:
1. Add `~~strikethrough~~` to the bullet OR check the box `[x]`
2. Move the badge count at the top
3. If the fix touched multiple items, mark each
4. Commit alongside the code fix so the punch-list reflects reality

If the architecture changes meaningfully (new tables, new functions, big refactor):
- Regenerate `architecture-map.html` via the `/architecture-map` skill (or `/health`)
- The HTML's Bugs & Roadmap tab regenerates from the source data
- Update this file by hand to match the new state, OR re-run the skill to overwrite this file too
