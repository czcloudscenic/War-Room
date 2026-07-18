# CODEX_NOTES - OAuth hardening + RLS/CORS cleanup

Date: 2026-06-04
Branch: `codex/grunt-2026-06-04`

## Summary

Completed the requested OAuth hardening, token encryption, RLS/CORS cleanup, and stretch cleanup batch.

- Added a migration to drop the broad `profiles` RLS policy.
- Hardened `requireUser` so state-changing requests from non-allowlisted browser origins return 403 before write logic runs.
- Reconciled agent-count copy to the actual agent array count where available, and fixed Settings build info to 4 active agents.
- Added AES-256-GCM OAuth token encryption with legacy plaintext decrypt compatibility.
- Encrypted new OAuth token writes and refreshed TikTok/YouTube token writes; decrypts reads in Instagram/TikTok/YouTube sync.
- Replaced Instagram/TikTok/YouTube deauthorize and data-deletion stubs with cleanup/status behavior.
- Added persisted `data_deletion_requests` audit/status storage plus `/api/oauth/data-deletion-status`.
- Stretch completed: expired `oauth_states` cleanup, Settings display-pref persistence, disabled invite coming-soon state, dev proxy env override, and VitalLyfe seed relocation to `supabase/seed/dev_seed.sql`.

No live OAuth/API/platform calls were run. No push was run.

## Files touched and line counts

- `netlify/functions/_lib/requireUser.js` - 141 lines
- `netlify/functions/_lib/crypto.js` - 59 lines
- `netlify/functions/_lib/oauth.js` - 328 lines
- `netlify/functions/sync-instagram.js` - 283 lines
- `netlify/functions/sync-tiktok.js` - 309 lines
- `netlify/functions/sync-youtube.js` - 302 lines
- `netlify/functions/oauth-data-deletion-status.js` - 49 lines
- `netlify/functions/oauth-instagram-deauthorize.js` - 52 lines
- `netlify/functions/oauth-instagram-data-deletion.js` - 66 lines
- `netlify/functions/oauth-tiktok-deauthorize.js` - 52 lines
- `netlify/functions/oauth-tiktok-data-deletion.js` - 60 lines
- `netlify/functions/oauth-youtube-deauthorize.js` - 36 lines
- `netlify/functions/oauth-youtube-data-deletion.js` - 48 lines
- `netlify.toml` - 150 lines
- `src/ui/agents/TeamBroadcast.jsx` - 155 lines
- `src/ui/agents/AgentChatPage.jsx` - 421 lines
- `src/apps/skills/SkillsPage.jsx` - 151 lines
- `src/ui/settings/SettingsPage.jsx` - 327 lines
- `vite.config.js` - 19 lines
- `supabase/migrations/20260603_drop_profiles_anon_policy.sql` - 4 lines
- `supabase/migrations/20260604_data_deletion_requests.sql` - 18 lines
- `supabase/seed/dev_seed.sql` - 30 lines
- `supabase/migrations/20260523_clients_multitenant.sql` - 85 lines
- `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql` - 7 lines
- `CODEX_NOTES.md` - 91 lines, overwritten with this report

## Validation

Build:

- `npm run build` passed after each scoped change batch and again at the end.
- Vite still emits the existing large chunk warning.

Function syntax checks:

- `node --check netlify/functions/_lib/requireUser.js` passed.
- `node --check netlify/functions/_lib/crypto.js` passed.
- `node --check netlify/functions/_lib/oauth.js` passed.
- `node --check netlify/functions/sync-instagram.js` passed.
- `node --check netlify/functions/sync-tiktok.js` passed.
- `node --check netlify/functions/sync-youtube.js` passed.
- `node --check netlify/functions/oauth-data-deletion-status.js` passed.
- `node --check netlify/functions/oauth-instagram-deauthorize.js` passed.
- `node --check netlify/functions/oauth-instagram-data-deletion.js` passed.
- `node --check netlify/functions/oauth-tiktok-deauthorize.js` passed.
- `node --check netlify/functions/oauth-tiktok-data-deletion.js` passed.
- `node --check netlify/functions/oauth-youtube-deauthorize.js` passed.
- `node --check netlify/functions/oauth-youtube-data-deletion.js` passed.

## Founder follow-ups

- Set `TOKEN_ENC_KEY` in Netlify before relying on encrypted token storage: `openssl rand -base64 32`.
- Apply `supabase/migrations/20260603_drop_profiles_anon_policy.sql` in the live Supabase SQL editor.
- Apply `supabase/migrations/20260604_data_deletion_requests.sql` in the live Supabase SQL editor.
- For fresh local/non-prod Supabase projects that need VitalLyfe sample data, run `supabase/seed/dev_seed.sql`; production rows were not touched by this branch.

## Notes and asymmetries

- Meta/Instagram `signed_request` is now required and HMAC-verified before account deletion.
- TikTok `TikTok-Signature` is verified when present using `TIKTOK_CLIENT_SECRET`; if the header is absent, the endpoint does best-effort deletion by payload account id.
- YouTube/Google does not call these webhooks for normal OAuth revocation; endpoints only delete when a valid channel/account id is supplied.
- Existing plaintext OAuth tokens remain readable. New OAuth writes encrypt when `TOKEN_ENC_KEY` is set. Existing plaintext TikTok/YouTube tokens are re-encrypted on refresh. No backfill was run.
- `VITE_API_PROXY` now controls the Vite dev `/api` proxy target, with the current Netlify URL as fallback.

## Skipped

- No live OAuth, platform API, Resend, Slack, n8n, Anthropic, Supabase production, or paid API calls were run.
- Hands-off files were not edited: `netlify/functions/agent-action.js`, `src/ui/routes/IdeaEngineRoute.jsx`, `src/ui/routes/AnalyticsRoute.jsx`, `src/App.jsx`, `architecture-map.html`, and `docs/architecture-map/**`.
- Existing generated/dirty files under `.netlify/`, plus untracked `Videos/` and `sprint-recap.html`, were left untouched.

## 2026-07-01 grunt route split + null guards

Branch: `codex/grunt-2026-07-01`.

Changed:

- Code-split the requested heavy routes/pages in `src/App.jsx` with `React.lazy` and one shared `React.Suspense` fallback around the existing route conditionals.
- Kept `DashboardRoute` and `AgentsRoute` eager.
- Added defensive null/undefined guards in `SetupRoute`, `LedgerRoute`, `ReportsRoute`, `OperationsRoute`, `ClientAnalyticsRoute`, `BillingRoute`, and `src/core/approvals.js`.
- Guard patterns were mechanical: `(clients || [])`/safe collection fallbacks, optional chaining for row/metrics access, guarded `.find()` lookups, and numeric `|| 0`/`Number(...) || 0` defaults.

Validation:

- `npm run build` passed on the grunt branch.
- Build emits multiple route chunks, including `SetupRoute`, `LedgerRoute`, `ReportsRoute`, `OperationsRoute`, `ClientAnalyticsRoute`, `BillingRoute`, `AnalyticsRoute`, `IdeaEngineRoute`, `CIDPage`, `ArtgridScoutPage`, `ReferencesPage`, `SkillsPage`, `ICPPage`, and `AdROIHub`.
- Final main bundle reported by Vite: `dist/assets/index-D4HGWGp5.js` at 466.92 kB minified.

Skipped / not touched:

- No dependency changes were committed.
- No `.env*`, auth, API-key, paid API, deploy, migration, push, or PR actions were run.
- Existing parallel-session changes in the original checkout on `main` were left untouched.

Review notes:

- Vite reports `TeamBroadcast.jsx` is still also statically imported by `src/ui/agents/AgentChatPage.jsx`, so that specific dynamic import cannot become its own chunk until that separate static import is addressed.
- Because the original checkout was being used by a parallel `main` session, the remaining work was completed in the isolated worktree `/private/tmp/vantus-codex-grunt` on the same branch.
- 2026-07-01 follow-up: converted the embedded `AgentChatPage` TeamBroadcast consumer to `React.lazy` + local `Suspense`; `npm run build` now emits a separate `TeamBroadcast` chunk with no static-import warning.

## 2026-07-06 runway-ui handoff
Built: `RunwayRoute.jsx` now renders summary tiles, worst-first table, mobile cards, and opens `LogShootModal`.
Built: `LogShootModal.jsx` bulk-inserts shoot stub rows into `content_items` with snake_case fields.
Built: `ClientsRoute.jsx` shows runway badges and `AddClientModal.jsx` edits runway cadence/tracking fields.
TODO: Counsel still owns NAV/App wiring/deploy; branch was not pushed per Christian's no-push instruction.

## 2026-07-18 agent-action router split

Branch: `codex/grunt-2026-07-18`
Worktree: `/private/tmp/vantus-grunt-2026-07-18`

### Changed

- Reduced `netlify/functions/agent-action.js` to a CommonJS router that preserves the existing auth, CORS, rate-limit, dispatch, event-log, Slack, timing-log, and error paths.
- Moved shared constants and helpers to `netlify/functions/agent-action/_shared.js`.
- Moved all 16 action handlers into six agent-group modules under `netlify/functions/agent-action/handlers/`:
  - `qc.js`: `qc_review`, with its three private fact-check/JSON helpers.
  - `muse.js`: seven Muse handlers, with `_researchDigest` and Muse-only prompt constants/maps.
  - `scrappy.js`: four Scrappy handlers, with Tavily/search, median/engagement, and synced-digest helpers.
  - `sean.js`: `sean_briefing`.
  - `cid.js`: `cid_build_brief` and `cid_ab_variations`.
  - `ops.js`: `ops_assign`.
- No private helper crossed agent groups, so none were duplicated or promoted. The existing `REST` constant is used directly by both Muse and Scrappy; it remains defined once and is now exported from `_shared.js` alongside the brief's listed shared values.
- All original source ranges were compared with `main` and are present byte-for-byte in their destination files; only CommonJS import/export wrappers were added.

### Final line counts

- `netlify/functions/agent-action.js`: 158
- `netlify/functions/agent-action/_shared.js`: 254
- `netlify/functions/agent-action/handlers/qc.js`: 222
- `netlify/functions/agent-action/handlers/muse.js`: 510
- `netlify/functions/agent-action/handlers/scrappy.js`: 464
- `netlify/functions/agent-action/handlers/sean.js`: 55
- `netlify/functions/agent-action/handlers/cid.js`: 140
- `netlify/functions/agent-action/handlers/ops.js`: 30

The router is below the estimated 250-300 lines because the preserved router/dispatcher block plus imports totals 158 lines; no filler or behavior-bearing code was retained to reach an estimate.

### Verification

- Syntax command passed for the router, `_shared.js`, and all six handler modules:
  `find netlify/functions/agent-action.js netlify/functions/agent-action -name '*.js' -exec node --check {} \;`
- Load/resolve smoke test passed: `router loads OK`.
- Direct export check passed: `all 16 handlers exported and callable`.
- Router coverage passed: `router coverage OK: 16 cases`; every required action key occurs exactly once and `default:` remains present.
- Source-integrity comparison passed: `source integrity OK: all original ranges preserved byte-for-byte`.
- `npm run build` passed with Vite 8.1.2: 101 modules transformed, final run built in 145 ms.
- `git diff --check` passed.

### Skipped / untouched

- The May branch was inspected only as a structural reference; nothing was merged or cherry-picked from it.
- No other `netlify/functions/` file, `src/` file, prompt, model, token cap, rate limit, dependency, environment file, secret, migration, deployment, paid API, remote, or live checkout state was changed.
- Existing architecture-map artifacts were not regenerated because this brief explicitly limits modified files to the router split and this report.
- No push or PR was performed.
