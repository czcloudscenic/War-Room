# Roadmap — Numbered Fixes

Numbered punch-list. Each fix may touch multiple files/nodes; numbers cross-reference the badges in the interactive HTML map.

## Order to attack (recommended)

1. **#1 + #2** — Re-enable Google OAuth, then re-enable the auth gate in App.jsx. Unblocks 5+ downstream items.
2. **#3** — Brain Move 1 (Cortex wiring). Per-client agent brand voice. Touches memory.js + agent-action.js.
3. **#5** — Add caller auth to the 5 unauthed functions. Security debt.
4. **#6 + #7** — Per-client Slack + n8n routing in notify.js.
5. **#10** — Write the missing `content_items` migration. Lock the schema in version control.
6. **#11** — Dynamic-import pdfjs-dist. Bundle size win.
7. **#8** — Delete the dead `src/agents/` folder. Pure cleanup.
8. **#4** — Split agent-action.js. Bigger refactor.
9. **#9** — Ship or delete Higgsfield. Resolve the WIP state.
10. **#12, #13, #14** — Smaller polish items.

---

## All fixes

### #1 — Re-enable Google OAuth
- **Where:** `src/App.jsx:117`
- **Steps:** Pull Supabase auth-logs (dashboard → Logs → Auth) → identify the exact exchange failure → fix client_secret mismatch → uncomment `if (!session) return <LoginScreen />`.

### #2 — Split App.jsx into smaller components
- **Where:** `src/App.jsx` (1,471 lines)
- **Why:** Phase 3.x of `docs/REFACTOR_PLAN.md`. The `Vantus` shell component (~1,040 lines) is ripe to break apart.
- **Suggestion:** Extract one component per nav route handler; keep App.jsx as a router shell.

### #3 — Brain Move 1: Cortex wiring (per-client agent voice)
- **Where:** `netlify/functions/agent-action.js` + `src/core/memory.js`
- **Steps:**
  1. Replace hardcoded "VitalLyfe brand voice" in agent-action.js system prompts with per-client lookup of `clients.brand_voice_md`.
  2. Remove the hardcoded Muse pre-seed at `memory.js:75-81`.
  3. Optional: populate Cortex wiki entries at `~/Desktop/Agent Cortex/wiki/clients/<slug>/brand-voice.md` and write a sync script (per Counsel's spec).

### #4 — Split agent-action.js
- **Where:** `netlify/functions/agent-action.js` (1,255 lines)
- **Steps:** Move each handler into its own file (`netlify/functions/agent-action/handlers/muse_write_content.js`, etc.). Keep `agent-action.js` as a router only.

### #5 — Caller auth on all functions
- **Where:** `netlify/functions/{chat,agent-action,notify,apify-scrape,unsplash}.js`
- **Pattern to copy:** `cid-scrape.js` — `Authorization: Bearer <CID_BEARER_TOKEN>` check.
- **Suggested env vars:** `AGENT_ACTION_BEARER`, `CHAT_BEARER`, `NOTIFY_BEARER` (or one shared `API_BEARER`).

### #6 — Per-client Slack channel routing
- **Where:** `netlify/functions/notify.js` + agent-action.js
- **Steps:** Read `clients.slack_channel_id` for the event's client, route to that channel instead of global `SLACK_WEBHOOK_URL`.
- **Note:** Channels need either a webhook URL each OR migrate to Slack's chat.postMessage with bot token + channel id.

### #7 — Per-client n8n webhook routing
- **Where:** `netlify/functions/notify.js`
- **Steps:** Look up `clients.n8n_webhook_url` for the event's client; fall back to global `N8N_WEBHOOK_URL`.

### #8 — Delete `src/agents/` dead code
- **Files:** `src/agents/{sean,lacey,muse,overseer,sam,artgrid,scrappy,ali}.agent.js`
- **Steps:** `rm -r src/agents/` — done. Confirmed zero callers via `grep -rn "from.*agents/" src/`.

### #9 — Ship or delete Higgsfield
- **Files:** `netlify/functions/higgsfield.js`, `src/apps/higgsfield/HiggsfieldStudio.jsx`
- **Two options:**
  - **Ship:** Commit both + add CREATIVE nav entry + add `<HiggsfieldStudio />` render in App.jsx + add `HIGGSFIELD_ACCESS_TOKEN` env var in Netlify. Test live.
  - **Delete:** `rm` both files + remove dirty edits to `constants.js` + `apps.config.js`.

### #10 — Write `content_items` migration
- **Where:** New file `supabase/migrations/<date>_content_items.sql`
- **Steps:** Pull live schema from Supabase dashboard (Database → Tables → content_items → "Definition") → save as migration. Include indexes + RLS policies.

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
- **When:** After Google OAuth is restored (no point until users have real identities).
- **Schema:** `(user_id, client_id, role)` — controls which clients each Cloud Scenic team member sees.

### #14 — Decouple seed.content.js from VitalLyfe
- **Where:** `src/data/seed.content.js`
- **Options:**
  - Per-client seedable (read `seed.content.<slug>.js` based on currentClient)
  - Or just remove it — data lives in DB now, fallback is obsolete.

---

## Cross-cutting work

### Drop temporary anon RLS policies (when #1 lands)
Once Google OAuth is back, remove these temp policies:

```sql
-- supabase/migrations/20260523_agent_events.sql:34
drop policy "anon read while auth bypassed (TODO remove)" on public.agent_events;

-- supabase/migrations/20260523_notifications.sql:44-49
drop policy "anon read while auth bypassed (TODO remove)" on public.notifications;
drop policy "anon update while auth bypassed (TODO remove)" on public.notifications;

-- supabase/migrations/20260523_clients_multitenant.sql:44-46
drop policy "anon read clients (TODO remove)" on public.clients;
drop policy "anon write clients (TODO remove)" on public.clients;

-- supabase/migrations/20260524_client_logos_bucket.sql:16,20,24
drop policy "Anon upload client-logos (TODO restrict to admins when auth back)" on storage.objects;
drop policy "Anon update client-logos (TODO restrict to admins when auth back)" on storage.objects;
drop policy "Anon delete client-logos (TODO restrict to admins when auth back)" on storage.objects;
```

### Rotate Supabase admin passwords (when convenient)
- **Why:** `Cloudai25%` (former SETUP_PASSWORD) is in git history. Becomes irrelevant once Google OAuth is the only path in.
- **Who:** `cz@cloudscenic.com`, `dv@cloudscenic.com`, `ss@cloudscenic.com`
- **Where:** Supabase dashboard → Authentication → Users → "Send password recovery"
