# Critical Path — the approval loop

The single most important seam in Vantus: **a piece of content goes from edit → immutable version → approval → client email → one-click decision → verified publish.** This is the loop the whole product exists to enforce. Every step below cites real code.

1. **[UI]** An editor saves a creative change in the pipeline modal — `src/ui/pipeline/EditContentModal.jsx` (handleSave). Before anything client-facing can be scheduled, `truthGates()` in `src/core/truth.js` hard-blocks if the client's Facts of Record are stale. *Plain English: you cannot schedule content for a client whose prices/hours/claims haven't been re-checked recently.*

2. **[DB]** The save mints an **immutable version** — `src/core/versions.js` inserts a `content_versions` row (`supabase/migrations/20260813_truth.sql:11`, UPDATE-blocking trigger). *Every meaningful edit is frozen with a number, forever.*

3. **[UI]** An approver acts — either the internal inbox (`src/ui/routes/ApprovalsRoute.jsx`) or the Ledger — both wire into `recordApproval()` in `src/core/approvals.js`. The decision captures `approved_version_id`, so "what exactly was approved" is provable. *Rejecting requires written feedback.*

4. **[DB]** The approvals insert fires a **database trigger** that bumps `revision_count` (`supabase/migrations/20260729_*` era) — the old race/bypass is closed because application code no longer counts revisions itself.

5. **[HTTP]** The state change calls `POST /api/notify` — `netlify/functions/notify.js`. It writes a `notifications` row with a **cycle-aware dedupe key** (approve → revise → re-approve produces a NEW notification; two tabs firing at once produce one), pings Slack, and issues **single-use approval tokens** for the email path.

6. **[EMAIL]** Resend delivers from `notifications@cloudscenic.com` (`netlify/functions/notify.js:304`). **Live and proven 2026-08-21** — this step really reaches client inboxes now.

7. **[HTTP]** The client clicks the email link → `netlify/functions/approval-decision.js`. **GET renders a confirmation page only** (so email scanners can't approve by accident); **POST executes**: single-use token consumed, sibling tokens invalidated, replayed links answer "Already recorded". Its `executeDecision` is the server-side twin of step 3's `recordApproval` — the two are mirrored and must change together.

8. **[DB]** The decision lands: status advances, the approvals row + audit row (`src/core/audit.js` → `audit_log`, append-only) are written, and the item moves down the pipeline.

9. **[UI]** When the item posts, **markPosted REQUIRES a live URL** (`src/ui/routes/LedgerRoute.jsx` prompt) — a publish claim without a receipt is not accepted.

10. **[CRON]** `netlify/functions/verify-publishes.js` (16:30 UTC daily) flags past-publish-date items with no receipt as `awaiting` and rings a `publish_unverified` bell. Its auto-verify join via `platform_post_id` ↔ `account_posts` is built but **inert until Phase C wires a writer** (`verify-publishes.js:13`).

11. **[UI]** The whole trail is inspectable per item in the **TruthDrawer** (Ledger → Receipts): approved version, approver, publish receipt, block state, version list, audit history — the Phase B definition-of-done on one panel.

**Why this is the spine:** every other feature (agents, intel, billing, the ship) either feeds this loop or renders receipts from it. The `agent_events` table is the same idea applied to AI work: nothing happens without a row that proves it happened.
