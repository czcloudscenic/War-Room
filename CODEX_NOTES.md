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

## 2026-08-13 TRUTH layer UI pack

Branch: `codex/grunt-2026-08-13`

### Changed

- Added `src/ui/truth/AuditTrailPanel.jsx`, a reusable embedded audit history panel with actor chips, value changes, reasons, relative timestamps, and missing-table fallback.
- Added `src/ui/truth/DecisionLogRoute.jsx`, including open debt ranking, decided history, client filtering/fallback lookup, create/edit/delete actions, and inline decision recording.
- Added `src/ui/truth/FreshnessBadge.jsx` with the exported `freshnessState` threshold helper.
- Added `src/ui/truth/BackupsCard.jsx` with latest export/restore status, run history, the static restore checklist, and restore-test logging.
- All data surfaces fail to quiet inline states when their Phase B tables are unavailable.

### Validation

- `npm run build` passed before each of the four per-file UI commits.
- `git diff --check` passed for all four UI files.
- No new dependencies, CSS files, migrations, environment files, or secrets were added or edited by this lane.

### Skipped / untouched

- No App wiring or integration edits were made.
- Parallel-lane changes already present in the shared worktree, including `src/App.jsx`, core files, Netlify files, `supabase/migrations/20260813_truth.sql`, `TruthDrawer.jsx`, and `TruthRegistryCard.jsx`, were left untouched.
- No deployment, paid API call, push, or PR was performed.
- `CODEX_NOTES.md` is the sole existing-file edit from this lane because the repository contract requires an end-of-session summary; the task deliverables themselves remain new files under `src/ui/truth/` only.

## 2026-08-13 Content Intel v1.1 UI pack

Branch: `codex/grunt-2026-08-13b`

### Changed

- Added `src/ui/intel/BenchmarksCard.jsx` with client benchmark reads, manual percent editing, per-bar default resets, and control-post send/save rate calibration.
- Added `src/ui/intel/PillarsEditor.jsx` with the production TOF/MOF/BOF defaults, editable pillar rows, validation, delete confirmation, dirty tracking, and client persistence.
- Added `src/ui/intel/IdeaPromoteButton.jsx` with inline confirmation, the complete `content_items` pipeline payload, idea status update, and success/error states.
- Empty, unavailable, and write-error paths render quiet inline lines rather than breaking their host surface.

### Validation

- Fetched latest `origin/main` and branched from Content Intel commit `28da133`.
- `npm run build` passed before each of the three per-file commits and before this summary commit.
- All three unwired JSX files compiled directly with the repository's installed Rolldown binary.
- `git diff --check` passed for the scoped UI files and final branch diff.

### Skipped / untouched

- No App, constants, ContentIntelRoute, migration, dependency, environment, deployment, paid API, remote, or production data changes were made.
- Existing dirty Netlify artifacts and `deno.lock` in the shared checkout were preserved untouched.
- No push or PR was performed.

## 2026-09-08 Agent Ship handover: contract conflict

### Prepared

- Created isolated worktree `/private/tmp/vantus-grunt-2026-09-08` on `codex/grunt-2026-09-08`, based on `52416c0aa6292d020dd36642d8f190254a0955f0`. Today's branch did not already exist.
- Inspected the live checkout's git state and handoff. Its checked-out branch remains `main`; existing modified `.netlify/` artifacts and untracked `deno.lock` were left untouched.
- The founder supplied both original reference PNGs in this conversation. The handover's claim that the original reference is missing is superseded by these attachments.

### Conflict requiring Christian's direction

- The AGENTS.md contract supplied in this session says: "Do not make architectural decisions" and "If a task prompt conflicts with this file / This file wins. Stop, write the conflict to CODEX_NOTES.md, and wait."
- The Agent Ship handover says: "You may rearchitect" and explicitly assigns the decision to retain or delete the parked hull stack (Fix #10).
- Paused before implementation as the contract requires. Christian should confirm whether this handover is an explicit exception to the no-architectural-decisions rule. No separate approval is needed for the isolated worktree, already expressly requested.
- The standing prohibition on paid API actions also remains in effect. Optional Lane B can be skipped without preventing Lane A; no generation calls were made.

### Validation

- `git status --short --branch` and `git worktree list` inspected the existing checkout and worktrees.
- `git branch --list 'codex/grunt-2026-09-08'` returned no branch before creation.
- `git worktree add -b codex/grunt-2026-09-08 /private/tmp/vantus-grunt-2026-09-08 52416c0aa6292d020dd36642d8f190254a0955f0` succeeded.
- `git diff --check` passed for this appended note.
- Build and tests were not run because work stopped at the instruction conflict. No claim is made about baseline build/test health.

### Explicitly not done

- No ship source, receipt logic, artwork, crew asset, dependency, configuration, secret, database, or live checkout file was changed.
- No visual harness, before/after screenshots, crew improvement, orphan removal, parked-stack decision, or mobile fix was completed.
- No paid API call, deployment, push, PR, or commit was performed. This note remains uncommitted; no commit was made without its required preceding build.

## 2026-09-10 Agent Ship: sculpt verification and crew landing status

### Task 1 result

- Reused `tests/ship-visual.html` in the isolated worktree with the production camera (`fov 35`, `z=1141`), lighting, tint pass, scale formula, floor projection, and deterministic local fixtures.
- Captured the pre-sculpt comparison from commit `a0a6d1e` and the wired comparison from commit `9fc1de8` with the same lineup, idle pose, camera, and renderer: `/private/tmp/vantus-crew-evidence-2026-09-08/before-lineup.png` and `/private/tmp/vantus-crew-evidence-2026-09-08/after-lineup.png`. The ship-scale captures are `/private/tmp/vantus-crew-evidence-2026-09-08/before-ship.png` and `after-ship.png`.
- Verdict: **improved**. Before wiring, the four procedural figures were rectangular blocks with boxed hair, no readable facial planes, and clothing that collapsed into one saturated host-tint shape. After wiring, the commissioned figures have tapered lofted bodies, separate shoulder/lapel planes, dress and coat hems, smooth head and hair masses, and identity details such as glasses and a headset. They read as stylized original people at the calibrated camera distance. Sean's rigged GLB remains visibly more human and is the quality reference.
- The wired sculpt harness measured 43 draw calls / 46,429 triangles for the five-figure lineup, versus 65 draw calls / 32,765 triangles before; the triangle increase is bounded by cached smooth geometry and is acceptable for this local comparison. The ship view measured 34 draw calls / 42,485 triangles after wiring.
- No bake widening was needed. The current `0.88 + 0.12 * max(0, normalY) + grain` range preserves the profile shading without restoring the pre-sculpt saturated blocks. A further widening would risk over-darkening the already low-key painted plate.

### Crew landing status

- Only `public/crew/sean.glb` and `public/crew/sean_idle.glb` exist in this worktree. `CREW_GLB` remains unchanged with Sean enabled and Muse, Scrappy, and Slate commented out.
- Counsel's outside staging directory contains `muse-mesh.glb`, A-pose source sheets, and no rigged landing pairs. The unrigged mesh was not copied into `public/crew/`.
- Because no new pair has appeared, no character line was uncommented, no normalization change was made, and no compression/replacement was attempted. The existing `createCrewFigure()` fallback remains intact for every absent or failed GLB.

### Recommendations for Counsel

- Parked hull: keep the current painting-as-world path for this pass. The parked modeled hull should remain Counsel's decision because reviving or deleting it is architectural scope.
- Ship stack: the current sculpt merge is safe for movement because surfaces are merged per articulation group and marked `userData.sculpted`; `ShipScene3D` skips the host tint on those merged surfaces. Sean's GLB path still swaps from procedural immediately and keeps the tag/status furniture outside the loaded rig.
- The main remaining visual gap is asset fidelity for Muse, Scrappy, and Slate. Procedural fallbacks now carry readable silhouettes, but they should be replaced only after each walk/idle pair is present and verified at the same 34-unit normalization contract.

### Validation

- `npm run build` passed after the sculpt changes: Vite 8.1.2, 171 modules transformed, ShipRoute chunk 987.95 kB raw.
- Local Playwright harness passed: Sean loaded as `1` skinned figure; procedural fallback lineup loaded as 4 non-skinned figures; both ship and lineup screenshots rendered without page errors.
- `npm test` passed: 53 passed, 0 failed. `git diff --check` passed after this note was appended.

### Explicitly not done

- No paid API calls, asset generation, deployment, push, PR, database change, mobile work, parked-hull decision, or orphan-file deletion.
- No Muse, Scrappy, or Slate GLB was added because no rigged pair exists in `public/crew/` yet.
- No GLB compression was attempted because the explicitly authorized four-character compression pass cannot be completed until all four commissioned pairs are present; Sean originals remain untouched.

## 2026-09-08 (later) Counsel: rescue + sculpt completion + character pipeline restart

Codex exhausted its credits mid-task, after doing the work but before committing
or updating this file. The conflict entry above was its last write and is now
stale: it says no harness and no crew improvement were completed. Both existed
on disk, uncommitted, in a /private/tmp worktree.

### Rescued and committed (nothing pushed)

- `ae55026` Codex's local crew study harness, `tests/ship-visual.html` (untracked when found).
- `a0a6d1e` Codex's sculpted crew geometry in `src/ship/crewModels.js`: profileGeom
  lofted CatmullRom profiles, ellipsoid masses, panelGeom, rewritten wardrobes for
  the four commissioned crew.
- `9fc1de8` Counsel completed the pass Codex left unwired. `finishSculpt()` and
  `SCULPTED` were defined but never called. Now gated to the four commissioned
  crew, merged per articulation group so update() still poses. The host tint rule
  is baked into vertex colors at build time and merged meshes are flagged
  `userData.sculpted`; `ShipScene3D` skips them, otherwise one shared material
  washes the whole body a single flat color. Merged geometries dispose per figure.

Validation: `npm run build` green, `npm test` 53/53, 24 merged surfaces across the
4 crew measured live in the harness. NOT done: a before/after visual comparison
against the pre-sculpt baseline. Treat the procedural crew as the fallback path.

### Character pipeline (Christian: "muse scrappy & slate to look like the first sean")

The first Sean is a rigged GLB. Procedural geometry cannot reach it, so the
pipeline was restarted. Assets staged OUTSIDE the repo at `~/vantus-crew-staging/`
(unrigged meshes must never ship; see the 8/20 note about a static sean.glb).

- MUSE: mesh COMPLETE, job `d2983a45-3daf-480c-816b-6c7e674c3482`, 30 credits,
  textured, verified 1 mesh / 1 image / 0 skins / 0 animations. Saved as
  `~/vantus-crew-staging/muse-mesh.glb`. Confirms again that multi_image_to_3d
  silently ignores rigging flags. NEXT: `3d_rigging` twice on that job id,
  height_meters 1.8, animation_action_id 30 (walk) then 0 (idle).
- SCRAPPY + SLATE: A-pose turnarounds generated and split into 4 single-figure
  crops each, gap-aware padding so no neighbour bleeds in. Ready to upload.
  NEXT: media_upload + media_confirm the 4 crops, then multi_image_to_3d, then rig x2.
- First turnaround pass for both was discarded: arms hung against the torso and
  Slate's were pinned under the greatcoat, the documented cause of every early rig
  failure. Forcing "wide A-pose, triangular white gap between arm and ribcage,
  arms must NOT hang down" fixed it. Scrappy's usable sheet came back cel-shaded
  with black outlines where Sean and Slate are painterly; a style-matched retry was
  submitted and rejected by the daily cap, so his mesh will look flatter than
  Sean's unless that sheet is regenerated first.

### THE BLOCKER IS UNCHANGED

Higgsfield is still in the billing grace state. Today's allowance was roughly 4
images + 1 3D job before both endpoints returned "You've reached the daily
generation limit for your grace period." The allowance does refill daily, so this
is doable across days, but fixing billing collapses it into one sitting.
Credits are not the constraint: 2,753.5 on Ultra.

### Explicitly not done

- No push, no PR, no deploy, no migration. `main` untouched; all work is on
  `codex/grunt-2026-09-08`.
- No GLB was added to `public/crew/` and no `CREW_GLB` line was uncommented.
  Muse's mesh is unrigged and must not ship in that state.
