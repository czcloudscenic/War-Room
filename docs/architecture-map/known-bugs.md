# Known Bugs — severity-ranked

> Every entry cites file:line. Cross-references the numbered fixes in [roadmap.md](roadmap.md). Working checkboxes live in [open-items.md](open-items.md).

## 🔴 HIGH

*None currently open.* The 7/3 test campaign closed the high-severity class: the broken new-item insert (camelCase columns), the duplicate-card realtime echo, and the approval double-notify all shipped fixed; the two silent config outages (Drive OAuth origin, Resend domain) were corrected in their consoles the same night.

## 🟡 MED

- **`src/core/approvals.js:45-47` — approvals advance `status` but not `stage`.** Observed live 7/3: after a Ledger approve, a row sat at status "Approved" with stage still "Need Content Approval". Anything keyed on `stage` (some boards/filters) mis-buckets these rows. Trigger: any Ledger approve. → Fix #3

- **`src/App.jsx:476, 491` — the app fetches and subscribes to ALL clients' content_items.** Scoping happens only at render. Fine while admins are the only users of the main app, but one missed filter = cross-client bleed — exactly one such miss was found and fixed 7/3 (agent chat context). Risk grows with every new page. → Fix #7

- **`supabase/migrations/20260523_notifications.sql:21` — permanent dedupe on `unique(type, content_item_id)`.** An item approved, kicked back, and approved again never notifies the second time — the bell has silently suppressed this since May, and since the 7/3 dedupe gate Slack/email follow the same rule. Semantic tradeoff worth an explicit decision (e.g. include revision_count in the key). → Fix #3 (same decision batch)

- **`src/ui/routes/BillingRoute.jsx:104-112` — branded invoice email only fires when Stripe FAILS.** The Resend `invoice_sent` path is a fallback: with the live key working, clients get Stripe's hosted-invoice email and never the Vantus-branded one. Probably unintended overlap from wiring Stripe after the email path. → Fix #5

- **`netlify/functions/billing-stripe.js:64` — the live invoice create-path has never run against a real invoice.** Webhook is verified, key is live, but `handleCreate` is unproven. First real invoice is the validation; do it deliberately, not on a client deadline. → Fix #5

- **`index.html:5` — pinch-zoom disabled app-wide** (`maximum-scale=1.0, user-scalable=no`). Accessibility violation that compounds the 8px micro-labels found in the 7/4 mobile audit. → Fix #1

- **`src/ui/routes/SetupRoute.jsx` — 51-94 sub-40px tap targets at phone widths** (service chips 50×25, row-delete ×'s; 7/4 mobile audit). The data-entry page most likely to be poked from a phone is the least thumb-friendly. → Fix #1

- **`netlify/functions/_lib/crypto.js:7` — silent PLAINTEXT fallback for OAuth tokens** when `TOKEN_ENC_KEY` is unset. The same "silently degraded, nobody alerted" failure class as the two config outages. Should hard-fail or alarm at startup. → Fix #8

## 🟢 LOW

- **`supabase/migrations/20260526_content_items_baseline.sql:47` — `publish_date` is TEXT**, not a date column. No DB-level validation or range queries. → Fix #3 batch
- **`src/utils/constants.js:33` — "Posted" is missing from STATUSES** though `markPosted` (`src/core/approvals.js:77`) sets it at runtime; status dropdowns/filters silently exclude posted items. → Fix #3
- **`src/App.jsx:20,25,26` — three imported-never-rendered components** (QuickActionsDashboard, PlaceholderPage, TypingTask) ship in the bundle. → Fix #6
- **`netlify/functions/agent-action.js:21` — dead `N8N_WEBHOOK_URL` constant**; the file never calls n8n (only notify.js does). → Fix #6
- **`clients.slack_channel_id` (20260523_clients_multitenant.sql) — deprecated column** superseded by `slack_webhook_url`, never dropped. → Fix #6
- **`netlify/functions/_lib/rateLimit.js` — in-memory rate limits reset on cold start.** Documented, accepted tradeoff at current scale.
- **`netlify/functions/agent-action.js:333` — QC v1 does not frame-check video**; a warning issue is emitted telling the human to eyeball on-video text. → Fix #9
- **`team_members` roster emails are blank** (Setup section 4 counter 0/7) — the 14:00 UTC chase cron has nobody real to email. Data entry, not code. → Fix #10
