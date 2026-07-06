# Known Bugs — severity-ranked

> Every entry cites file:line. Cross-references the numbered fixes in [roadmap.md](roadmap.md). Working checkboxes live in [open-items.md](open-items.md).
>
> **State:** 2026-07-04 sweep shipped + deployed (commit `a8ff98b` live on usevantus.com; migration `20260704_notify_dedupe_and_cleanup.sql` run). Ten bugs closed this pass — see the "Fixed in the 7/4 sweep" section at the bottom.

## 🔴 HIGH

*None currently open.* The 7/3 test campaign closed the high-severity class: the broken new-item insert (camelCase columns), the duplicate-card realtime echo, and the approval double-notify all shipped fixed; the two silent config outages (Drive OAuth origin, Resend domain) were corrected in their consoles the same night.

## 🟡 MED

- **`netlify/functions/billing-stripe.js:64` — the live invoice create-path has never run against a real invoice.** Webhook is verified, key is live, but `handleCreate` is unproven. First real invoice is the validation; do it deliberately, not on a client deadline. The email-overlap half of Fix #5 is done. → Fix #5 (proof half)

- **`src/App.jsx:476, 491` — the admin app holds every client's content_items in one array**, scoped at render. The client boundary is now doubly-safe (RLS + explicit client-half scope shipped in the 7/4 sweep), so this is no longer a live cross-client-bleed risk — what remains is the tracked refactor to give Ledger/Reports/Client-Analytics their own scoped fetches before onboarding the next heavy client. → Fix #7 (admin half)

## 🟢 LOW

- **`supabase/migrations/20260526_content_items_baseline.sql:47` — `publish_date` is TEXT**, not a date column. No DB-level validation or range queries. Deferred: a live TEXT→date conversion on rows holding `''` carries real risk for a cosmetic gain — convert only if range-querying by date becomes needed. → Fix #3 (deferred)
- **`netlify/functions/_lib/rateLimit.js` — in-memory rate limits reset on cold start.** Documented, accepted tradeoff at current scale; a durable store is a later infra change.
- **`netlify/functions/agent-action.js:333` — QC v1 does not frame-check video**; a warning issue is emitted telling the human to eyeball on-video text. v2 is not greenlit — propose before building. → Fix #9
- **`team_members` roster emails are blank** (Setup section 4 counter 0/7) — the 14:00 UTC chase cron has nobody real to email. Data entry, not code. → Fix #10

---

## ✅ Fixed in the 7/4 sweep (commits 340377c, 7f8bfdb, ed8bd1e — deployed a8ff98b)

- **`src/core/approvals.js:45-47` — status/stage drift.** `recordApproval` + `markPosted` now patch `stage` alongside `status`. → Fix #3
- **`supabase/migrations/20260523_notifications.sql:21` — permanent dedupe.** Migration `20260704` moved the unique index to a cycle-aware `dedupe_key` (includes revision_count); notify.js computes it, approvals.js passes it. Approve → revise → re-approve notifies again; same-cycle double-fires still collapse. **Migration run against prod.** → Fix #3
- **`src/ui/routes/BillingRoute.jsx:104-112` — invoice email overlap.** On Stripe success the team now gets bell + Slack (`emailClient:false`) without the client getting a second email; the branded Resend email stays the fallback when Stripe isn't wired. → Fix #5 (email half)
- **`index.html:5` — pinch-zoom disabled.** Removed `maximum-scale`/`user-scalable=no`; added apple-touch-icon + favicon. → Fix #1
- **`src/ui/routes/SetupRoute.jsx` + `src/App.jsx` header — sub-44px tap targets.** Service chips, bell, hamburger, client switcher all at 44px; 8px label → 10px. → Fix #1
- **`src/utils/constants.js:33` — "Posted" missing from STATUSES.** Added to STATUSES/STATUS_COLOR/STAGE_SHORT. → Fix #3
- **`netlify/functions/_lib/crypto.js:7` — silent plaintext token fallback.** `encrypt()` now throws when `TOKEN_ENC_KEY` is unset instead of storing plaintext. (`TOKEN_ENC_KEY` confirmed present in Netlify.) → Fix #8 (crypto half)
- **`src/App.jsx:20,25,26` — dead components.** QuickActionsDashboard, PlaceholderPage, TypingTask deleted with their imports. → Fix #6
- **`netlify/functions/agent-action.js:21` — dead `N8N_WEBHOOK_URL` constant** removed. → Fix #6
- **`clients.slack_channel_id` — deprecated column** dropped in migration `20260704`; the AddClient modal field that wrote it was removed. → Fix #6
- **`src/App.jsx` — client content scoping (client half).** Approved external clients now load only their own content via explicit `.in(client_id)`. → Fix #7 (client half)
