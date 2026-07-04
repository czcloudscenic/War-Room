# Roadmap — numbered fixes

> Numbering matches the green FIXES badges in `architecture-map.html` and the punch-list in [open-items.md](open-items.md).

## #1 — Mobile accessibility pack
**Touches:** `index.html:5`, App.jsx header controls, `src/ui/routes/SetupRoute.jsx` chips/rows, favicon/app icons.
- Delete `maximum-scale=1.0, user-scalable=no` from the viewport meta (keep `viewport-fit=cover`)
- Bring the header bell/hamburger/client-switcher to ≥44px touch boxes; enlarge Setup's service chips + row deletes at mobile widths
- Raise the 8px micro-labels ("Tap to switch ▾", Geist Mono labels) to a 10-11px floor
- Add `<link rel="apple-touch-icon">` + width/height on the client-switcher logo img
**Unblocks:** clean re-run of the 7/4 mobile audit; D5 checklist closure.

## #2 — Muse model tiering (client-facing → sonnet)
**Touches:** `netlify/functions/agent-action.js` — `muse_write_content` (:487), `muse_from_brief` (:936), `muse_generate_calendar` (:840).
- One-line model param per action: pass `'claude-sonnet-4-6'` to `ai()` for output a client will read
- Keep haiku for internal grunt (sean_briefing, ops_assign, scrappy_research)
- Rule agreed with Christian: tier by who sees the output and what it gates, not task size
**Unblocks:** caption quality on the actual client deliverable path.

## #3 — Pipeline-state hygiene batch (status/stage/Posted/dedupe)
**Touches:** `src/core/approvals.js:45-47`, `src/utils/constants.js:33`, `supabase/migrations/20260523_notifications.sql` semantics, `publish_date` typing.
- recordApproval patches `stage: status` alongside status
- Decide "Posted" in STATUSES (or document runtime-only and exclude from dropdowns intentionally)
- Decide re-approval notify semantics: keep first-writer-wins forever, or add revision_count to the dedupe key via migration
- Optional same batch: migrate `publish_date` TEXT → date
**Unblocks:** trustworthy stage-based views; predictable notify behavior.

## #4 — Split the agent-action.js monolith (1,753 lines)
**Touches:** `netlify/functions/agent-action.js` → `_actions/{muse,scrappy,qc,ops,cid}.js` modules + a thin dispatcher.
- Keep the endpoint, auth, rate limit, logging, Slack fan-out in the dispatcher
- Move each action family to its own module; share `ai()/aiVision()/getBrandContext()` from `_lib/`
- Pure refactor: no behavior change, node --check + test checklist A-section re-run as the gate
**Unblocks:** #2 gets trivially reviewable; future actions stop growing the monolith.

## #5 — Prove the Stripe create-path + resolve invoice email overlap
**Touches:** `netlify/functions/billing-stripe.js:64` (handleCreate), `src/ui/routes/BillingRoute.jsx:99-112`.
- Send the first real invoice deliberately (small amount, a controlled client) and verify webhook paid-sync
- Decide the email story: Stripe's hosted email alone, or also fire the branded Resend notice on success (currently fallback-only)
**Unblocks:** billing goes from "wired" to "proven"; NYC Gyro-class deals can invoice through Vantus.

## #6 — Dead-code + dead-schema sweep
**Touches:** `src/ui/dashboard/QuickActionsDashboard.jsx`, `src/ui/shared/PlaceholderPage.jsx`, `src/ui/shared/TypingTask.jsx`, `src/App.jsx:20,25,26`, `netlify/functions/agent-action.js:21`, `clients.slack_channel_id`.
- Delete the three components + their imports; bundle shrinks, readers stop wondering
- Delete the never-fetched N8N_WEBHOOK_URL constant
- Cleanup migration: `alter table clients drop column if exists slack_channel_id;`
**Unblocks:** nothing downstream — pure hygiene, 30 minutes.

## #7 — Client-scope the global content fetch + realtime
**Touches:** `src/App.jsx:476` (fetch), `:491` (subscription).
- Fetch per currentClient (or per clientIds for portal users) and re-subscribe with a `client_id=eq.` filter on client switch
- Prerequisite thinking: several admin pages (Ledger, Reports, Analytics) legitimately need all-clients data — give them their own scoped fetches rather than the global blob
**Unblocks:** removes the whole cross-client-bleed bug class (one instance already bitten 7/3).

## #8 — Security debt batch
**Touches:** `netlify/functions/_lib/crypto.js:7`, git history creds, `netlify.toml:172` CSP.
- Make crypto hard-fail (or Slack-alarm) when TOKEN_ENC_KEY is unset instead of silently storing plaintext
- Rotate the Supabase admin password that exists in git history (Cloudai25%) once fully off password login
- Tighten `style-src 'unsafe-inline'` when inline styles get factored out (long tail)
**Unblocks:** closes the "silently degraded security" class.

## #9 — QC v2: video frame sampling
**Touches:** `src/ui/pipeline/EditContentModal.jsx` (upload path), `netlify/functions/agent-action.js` qc_review.
- Sample 3-5 frames client-side at upload (canvas capture from `<video>`), attach as images alongside the video file
- qc_review then vision-checks the frames like any image; drop the v1 warning
**Status:** queued, not greenlit — propose before building.

## #10 — Team roster emails (data entry, not code)
**Touches:** Setup section 4 → `team_members.email`.
- Christian/Sebastian fill real emails for the people who exist; delete roster rows that don't map to real humans
**Unblocks:** the 14:00 UTC chase-overdue-tasks cron actually reaches assignees.

---

**Queued but NOT greenlit (propose, don't start):** Sprout API v2 — full-auto Cloud Scenic-branded report generated from Sprout metrics (Advanced plan has self-serve tokens), rendered HTML-to-PDF into the same client_reports pipeline with manual upload as fallback.
