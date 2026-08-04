# Vantus v3 — Spec Review + Phase A Estimate (2026-08-04)

Response to VANTUS-V3-BUILD-SPEC.md (frozen 2026-07-31). Everything below is verified against the live codebase, not read off the spec. Do not push this file; it rides the next reviewed push.

## Verdict

The spec is buildable as written. Section 0 is accurate: Software OPS, the ActivityFeed on agent_events, client_users with first_login_at stamping, and the notifications table all exist and work the way the spec says. The Open-button bug is confirmed at `src/App.jsx:1377` - "Open" calls `switchClient(c)` then `setActiveNav("dashboard")`. There is no client workspace route anywhere in the repo, so the Phase C fix is really the workspace shell build itself, exactly as Section 9 says.

## Phase A estimate: 13-18 dev-days (~3 working weeks, one developer)

Two shippable drops:

### Drop 1 (~7.5 days)
| Chunk | Work | Days |
|---|---|---|
| 0 | Migration `20260805_activation.sql` + `src/core/activation.js` (activation checklist computed only from real columns/rows; one score; next-5-actions with nav targets) | 2 |
| 1 | Activation-state dashboard: `ActivationBoard.jsx` replaces the KPI grid when the book is not activated; grouped deficiency lists per client; toggle to peek at the normal dashboard | 2.5 |
| 2 | Internal approvals inbox v1: new `approvals` nav id + `ApprovalsRoute.jsx`; queue = cross-client items in gate statuses with approval_mode internal; risk level derived from qc_status / revision cap / due dates / runway; Approve and Reject wire into the existing `recordApproval()`; Edit reuses the existing EditContentModal | 3 |

### Drop 2 (~7 days)
| Chunk | Work | Days |
|---|---|---|
| 3 | Founder daily command view: `src/core/commandDigest.js` tiers (critical / requires-Danny / due today / blocked / at risk / routine) + `CommandView.jsx`; cross-client AllActivityFeed variant | 2.5 |
| 4 | Cross-client notification digest: unscoped notifications query (admin RLS already permits), grouped client-then-type using the existing NOTIF_META map, role filter tabs; "All clients" tab on the bell | 1.5 |
| 5 | Landing spots for your parallel data: skill briefs localStorage-to-DB, report-recipients input, per-client owner select, cadence field in Setup | 1.5 |
| 6 | QA against the live DB, mobile pass, migration-then-push runbook, HANDOFF update | 1.5 |

## Why the number is smaller than the spec implies

Most of the "missing configuration" the activation state must check already exists as columns: `retainer_amount` / `retainer_status`, `cadence`, `posts_per_week`, `approval_rule`, `client_facts` + `facts_owner` + `report_schedule` (the Facts of Record editor already works, in `src/ui/settings/FactsAndReports.jsx`), and per-deliverable `assigned_to` / `due_date`. The approvals machinery in `src/core/approvals.js` and the client-portal inbox pattern port straight into the internal inbox. Phase A is mostly assembly of existing parts plus honest math, which is also why the no-fabricated-metrics rule is cheap to honor.

## Only 3 schema additions needed (one idempotent migration)

1. `clients.report_recipients jsonb` - only primary_email exists today.
2. `clients.owner_team_member_id` - the per-client account owner the "missing owners" check needs.
3. `skill_briefs` table - **flag for you:** SkillsPage stores briefs in browser localStorage. Until this table exists, "agents without skills" is uncheckable and your 17 skill briefs would land in a browser, not the system. Your deploy-the-briefs parallel task needs this migration to land first. It is Chunk 0, so it is early on purpose.

## Questions for the call

1. Approvals inbox "business effect / recommendation" text: estimated as deterministic rule-based copy from real signals (qc_status, revision cap vs allowance, due-date proximity, runway). If you want AI-written per-item rationale instead, add 2-3 days and a per-item latency/cost.
2. `approval_rule` has a database default of internal, so "never consciously set" is indistinguishable from "chose internal." If you want an explicit confirmed flag so the activation check is honest about that, add half a day.
3. Notification digests ship in-app only. Email delivery stays a dry-run log line until RESEND_API_KEY lands in Netlify - your side, per the handoff split.

## Top risks

1. **App.jsx coupling.** All app state lives in one 1,489-line file and there is no test suite; QA is manual. Mitigation: all new logic goes in `src/core/` and new route files, App.jsx grows ~30 lines. Still the most likely overrun (+1-2 days).
2. **Migration-before-push sequencing.** main auto-deploys; SQL is applied by hand in the Supabase editor. A push that lands before the migration breaks activation queries in prod. Runbook in Chunk 6 covers the order; it stays a one-dev operational risk.
3. **Day-one emptiness.** Until your parallel data entry lands, the activation view will show everything missing for every client. The next-5-actions ranking and empty states have to be genuinely useful on day one or the definition of done fails on presentation. Budgeted in Chunk 6; expect one polish iteration together.

## Files (for the record)

New: `supabase/migrations/20260805_activation.sql`, `src/core/activation.js`, `src/core/commandDigest.js`, `src/ui/dashboard/ActivationBoard.jsx`, `src/ui/dashboard/CommandView.jsx`, `src/ui/dashboard/NotificationDigest.jsx`, `src/ui/dashboard/AllActivityFeed.jsx`, `src/ui/routes/ApprovalsRoute.jsx`.

Modified: `src/App.jsx` (~30 lines), `src/utils/constants.js` (NAV entry), `src/ui/routes/DashboardRoute.jsx`, `src/ui/routes/SetupRoute.jsx`, `src/ui/routes/ClientsRoute.jsx` (setupScore moves to the shared activation module), `src/apps/skills/SkillsPage.jsx` (localStorage to DB), `HANDOFF.md`.

Out of scope for Phase A, per the spec: the client workspace shell (Phase C), email delivery, router or App.jsx refactors, and all of Section 5's cut list.
