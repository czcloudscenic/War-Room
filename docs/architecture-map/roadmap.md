# Roadmap — Numbered Fixes

Numbered punch-list. Each fix may touch multiple files/nodes; numbers cross-reference the badges in the interactive HTML map.

## Order to attack (recommended)

1. **#7** — Per-client n8n routing. Mirror the Slack pattern from commit `702f867`. ~20-minute change.
2. **#10.1** — Drop the wide-open `content_items` policy (after filling external-client RLS gap). Surfaced by Fix #10.
3. **#3.1** — Rename `cid_library.vitallyfe_adaptation` → `client_adaptation`. Move 1 leftover.
4. **#11** — Dynamic-import pdfjs-dist. ~405 KB bundle size win.
6. **#8** — Delete the dead `src/agents/` folder. 30-second cleanup.
7. **#9** — Ship or delete Higgsfield. Decision is the work; the code change is small either way.
8. **#4** — Split agent-action.js. Bigger refactor — plan a sprint.
9. **#2** — Split App.jsx into smaller components. Same — plan a sprint.
10. **#12, #13, #14** — Smaller polish items.

---

## All fixes

### ✅ #1 — Re-enable Google OAuth + auth gate — CLOSED 2026-05-25
- **Where:** `src/App.jsx` (setupSession + render branches)
- **Closed by:** `8e5095e` (gate + admin RLS) + `307b64f` (dedupe setupSession) + `d0acec3` (4s stuckGuard hotfix)
- **What landed:** Four-way branch — admin / approved external client / pending invite (realtime unlock) / unknown blocked. Google OAuth verified end-to-end.

### #2 — Split App.jsx into smaller components
- **Where:** `src/App.jsx` (1,646 lines)
- **Why:** Phase 3.x of `docs/REFACTOR_PLAN.md`. The `Vantus` shell component (~1,200 lines after auth code added) is ripe to break apart.
- **Suggestion:** Extract one component per nav route handler (Dashboard, TaskBoard, Agents, Pipeline, Production, Apps, Settings, CIDPage); keep App.jsx as a router shell + auth setup + realtime subscriptions only.

### ✅ #3 — Brain Move 1: Cortex wiring (per-client agent voice) — CLOSED 2026-05-26
- **Where:** `netlify/functions/agent-action.js` + `src/core/memory.js` + `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql`
- **What landed:**
  1. `getBrandContext(client_id)` helper at `agent-action.js:94` fetches `clients.name` + `clients.brand_voice_md` via Supabase REST, falls back gracefully when client_id is null or brand_voice_md is empty.
  2. `exports.handler` calls it once per request, passes `brand` to every handler.
  3. 12 prompt sites refactored to interpolate `${brand.name}` and `${brand.voice}` — was 5 in the original audit, expanded to all of: muse_write_content, overseer_scan, sean_briefing, sam_health, scrappy_research, scrappy_muse_collab, artgrid_scout, muse_generate_calendar, muse_from_brief, scrappy_hook_analysis, cid_build_brief, cid_ab_variations, muse_ig_ideas.
  4. Dynamic `#${brand.name}` hashtag templates replace `#VitalLyfe` in 3 JSON-schema example strings.
  5. Dead `seedMuseMemory()` in `memory.js` removed entirely (zero callers).
  6. VitalLyfe seeded via SQL migration so behavior is identical pre/post for the existing client.
- **Verified:** Muse generated on-brand caption against VitalLyfe in dev — cinematic, calm, purposeful structure intact.
- **Follow-up:** Fix #3.1 below — `cid_library.vitallyfe_adaptation` column name still references VitalLyfe.

### #3.1 — Rename cid_library.vitallyfe_adaptation → client_adaptation
- **Where:** `supabase/migrations/<date>_rename_cid_library_column.sql` + `netlify/functions/agent-action.js:958-960`
- **Why:** Move 1 leftover. The column name is the last hardcoded VitalLyfe reference in the agent layer.
- **Steps:**
  1. `alter table cid_library rename column vitallyfe_adaptation to client_adaptation;`
  2. Update 3 lines in `agent-action.js` (the three `.map` blocks that write to cid_library).
  3. Remove the TODO comment at L905 noting this debt.

### #4 — Split agent-action.js
- **Where:** `netlify/functions/agent-action.js` (1,263 lines)
- **Steps:** Move each handler into its own file (`netlify/functions/agent-action/handlers/muse_write_content.js`, etc.). Keep `agent-action.js` as a router only.

### ✅ #5 — Caller auth on all functions — CLOSED 2026-05-25
- **Where:** `netlify/functions/{chat,agent-action,notify,apify-scrape,unsplash}.js`
- **Closed by:** Commit `2a9c9c1` — shared helper `netlify/functions/_lib/requireUser.js` validates Supabase JWT. Either @cloudscenic.com admin OR approved `client_users` row required.
- **Pattern landed:** Bearer-token + JWT lookup at `/auth/v1/user`, then client_users allowlist check. `cid-scrape.js` keeps its pre-existing CID_BEARER_TOKEN gate.

### ✅ #6 — Per-client Slack routing — CLOSED 2026-05-25
- **Where:** `netlify/functions/notify.js` L157-162
- **Closed by:** Commit `702f867`. New `clients.slack_webhook_url` column. `notify.js` prefers it when `client_id` is on the payload; falls back to global `SLACK_WEBHOOK_URL`. Edit Client modal exposes the field under "Optional integrations".

### #7 — Per-client n8n webhook routing
- **Where:** `netlify/functions/notify.js`
- **Steps:** Mirror the Slack pattern from commit `702f867`. Read `clients.n8n_webhook_url` for the event's client; fall back to global `N8N_WEBHOOK_URL`. Column already exists.

### #8 — Delete `src/agents/` dead code
- **Files:** `src/agents/{sean,lacey,muse,overseer,sam,artgrid,scrappy,ali}.agent.js`
- **Steps:** `rm -r src/agents/` — done. Confirmed zero callers via `grep -rn "from.*agents/" src/`.

### #9 — Ship or delete Higgsfield
- **Files:** `netlify/functions/higgsfield.js`, `src/apps/higgsfield/HiggsfieldStudio.jsx`, modified `src/apps/apps.config.js` + `src/utils/constants.js`
- **Two options:**
  - **Ship in ONE commit:** Both new files + the apps.config + constants edits + the import + `<HiggsfieldStudio />` render in App.jsx + `HIGGSFIELD_ACCESS_TOKEN` env in Netlify. Test live before pushing.
  - **Delete:** `rm` both files + revert dirty edits to `constants.js` + `apps.config.js`.
- **Don't split-commit** — broke CI last time when files landed before/after their import.

### ✅ #10 — Write `content_items` migration — CLOSED 2026-05-26
- **Where:** `supabase/migrations/20260526_content_items_baseline.sql`
- **What landed:** Full 25-column schema, FK to `clients(id) ON DELETE CASCADE`, `content_items_client_idx`, RLS enabled, 3 policies captured faithfully (2 admin + 1 wide-open temp). Idempotent: `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` + `CREATE POLICY` so it can be applied against the existing prod DB or a fresh dev DB without error.
- **Surfaced security debt:** the legacy `"Allow all for now"` policy survived the 2026-05-25 anon cleanup. Migration header flags it loudly; DROP statement teed up at bottom for Fix #10.1.

### #10.1 — Drop content_items wide-open policy
- **Where:** Uncomment the teed-up `drop policy if exists "Allow all for now"` at the bottom of `20260526_content_items_baseline.sql`, or write a follow-up migration.
- **Prereq:** External approved clients have NO RLS read policy on `content_items` today — they rely on the wide-open one. Before dropping, add either:
  1. `client_users.client_ids @> array[content_items.client_id]` scoped SELECT policy, OR
  2. Have every external-client read flow through a Netlify function with `SERVICE_KEY` (bypasses RLS).
- **Steps:** Fill the RLS gap → drop the policy → verify external client ClientView still loads their content.

### #11 — Dynamic-import pdfjs-dist
- **Where:** `src/apps/brief-gen/BriefGenPage.jsx`
- **Steps:** Replace top-level `import pdfjs from 'pdfjs-dist'` with `const pdfjs = await import('pdfjs-dist')` inside the PDF-drop handler.
- **Win:** ~405 KB off the main bundle for all users who never open Brief→Content.

### #12 — Back OpsBoard with a DB table
- **Where:** `src/ui/dashboard/OpsBoard.jsx` + new `supabase/migrations/<date>_tasks.sql`
- **Schema sketch:**
  ```sql
  create table tasks (
    id bigserial primary key,
    client_id uuid references clients(id) on delete cascade,
    title text not null,
    assignee text,
    column text check (column in ('backlog','in_progress','completed')),
    position int,
    created_at timestamptz default now()
  );
  ```

### #13 — Per-user client assignments
- **Where:** New `supabase/migrations/<date>_user_clients.sql`
- **When:** Now unblocked (OAuth is live + `client_users` table exists). Could be folded into `client_users` as a multi-row pattern instead of a new table.
- **Schema:** `(user_id, client_id, role)` — controls which clients each Cloud Scenic team member sees.

### #14 — Decouple seed.content.js from VitalLyfe
- **Where:** `src/data/seed.content.js`
- **Options:**
  - Per-client seedable (read `seed.content.<slug>.js` based on currentClient)
  - Or just remove it — data lives in DB now, fallback is obsolete.

### ✅ #15 — Auto-recover from supabase-js auth-lock errors — CLOSED 2026-05-26
- **Where:** `src/App.jsx` stuckGuard callback
- **What landed:** When the 4s stuckGuard fires, the callback now:
  1. Sets a one-shot `sessionStorage["vantus_auth_recovery_attempted"]` flag to prevent reload loops.
  2. Iterates `localStorage` and removes only keys matching `/^sb-.*-auth-token/` or `^supabase\.auth` — preserves `vantus_agent_hists`, `vantus_current_client_id`, apps prefs, etc.
  3. Calls `location.reload()` to break any in-flight `navigator.locks` mutexes.
  4. On the reloaded tab, the `SIGNED_IN`/`INITIAL_SESSION` handler clears the recovery flag so the mechanism can fire again next time.
  5. If stuckGuard fires a second time (recovery flag already set), falls through to login screen cleanly.
- **Manual workaround retired:** `localStorage.clear(); location.reload()` no longer needed for this class of failure.

---

## Cross-cutting work

### ✅ Drop temporary anon RLS policies — DONE 2026-05-25
All 5 temp anon policies dropped in `supabase/migrations/20260525_drop_temp_anon_policies.sql` (commit `852d915`). Admin-only RLS enforced across `agent_events`, `notifications`, `clients`, and the `client-logos` storage bucket via `auth.jwt()->>'email' like '%@cloudscenic.com'`.

### Rotate Supabase admin passwords (when convenient)
- **Why:** `Cloudai25%` (former SETUP_PASSWORD) is in git history. Becomes irrelevant once Google OAuth is the only path in.
- **Who:** `cz@cloudscenic.com`, `dv@cloudscenic.com`, `ss@cloudscenic.com`
- **Where:** Supabase dashboard → Authentication → Users → "Send password recovery"
- **Status:** Lower urgency now that OAuth is the only used login path — but password login technically still works.

### Tighten security headers
- **Where:** `netlify.toml`
- **What:** Add CSP (`default-src 'self'`), HSTS (`max-age=31536000; includeSubDomains; preload`), Referrer-Policy (`strict-origin-when-cross-origin`).
- **Why:** Defense in depth. JWT bearer + admin RLS already block most realistic attacks, but these headers harden against future XSS or downgrade scenarios.

### Tighten CORS + add rate limits
- **Where:** every `netlify/functions/*.js` CORS header + new `_lib/rateLimit.js`
- **What:** Lock origin to `https://usevantus.com` (currently `*`). Add per-user rate limit on `/api/chat` (most expensive endpoint).
