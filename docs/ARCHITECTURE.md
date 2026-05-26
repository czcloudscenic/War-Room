# Vantus — Architecture

**Last updated:** 2026-05-26 (post Fix #1/#2/#4)

## Overview

Vantus is the content operations dashboard Cloud Scenic ships for VitalLyfe (and, as of 2026-05-25, any future client). It runs 8 AI agents, a content pipeline, a client portal, and modular apps — deployed as a single-page React app on Netlify with Supabase as the backend.

The fastest way to grok the system is the interactive map: open `architecture-map.html` in the repo root (or read the portable markdown bundle in `docs/architecture-map/`).

## Stack

- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` + `netlify.toml`)
- **Backend:** Netlify Functions (`netlify/functions/`)
- **Database:** Supabase (`wjcstqqihtebkpyuacop`) — PostgreSQL + Auth + Storage + Realtime
- **AI:** Anthropic `claude-haiku-4-5-20251001` via `/api/chat` (raw proxy) + `/api/agent-action` (16 named handlers)
- **External:** Apify, Unsplash, Resend (email), Slack (incoming webhooks), n8n cloud
- **Auth:** Google OAuth via Supabase Auth Providers (Internal audience — `@cloudscenic.com` only at the Google level; non-admin external clients gated separately via the `client_users` allowlist)
- **Deploy:** push to `main` → Netlify auto-deploy

## Folder map

```
src/
├── App.jsx                       Root component (~1,500 lines). Auth gate + currentClient state + every nav route.
├── main.jsx                      ReactDOM.createRoot entry
├── services/
│   ├── supabaseClient.js         sb singleton (createClient)
│   └── apiFetch.js               fetch() wrapper that injects Supabase access_token (NEW 2026-05-25)
├── core/                         memory.js, routeTask.js, agentRegistry.js
├── data/                         seed.agents.js, seed.content.js, seed.ops.js
├── ui/
│   ├── layout/                   LoginScreen, sidebar shells
│   ├── dashboard/                ActivityFeed, OpsBoard, command input, quick actions
│   ├── agents/                   AgentChatPage, TeamBroadcast, AgentAvatar
│   ├── client/                   ClientView (the external-facing portal)
│   ├── clients/                  AddClientModal + ClientTeamPanel (NEW 2026-05-25)
│   └── shared/                   Card, MetricCard, AgentAvatar
├── apps/
│   ├── apps.config.js            DEFAULT_APPS registry
│   ├── competitor-intel/         CIDPage
│   ├── artgrid/                  ArtgridScoutPage
│   ├── ad-roi/                   AdROIHub
│   ├── brief-gen/                BriefGenPage
│   ├── shot-ref/                 ShotRefScout
│   └── higgsfield/               (untracked WIP)
└── utils/                        constants.js (NAV, status colors), hooks.js (useIsMobile)

netlify/functions/
├── _lib/
│   └── requireUser.js            Shared auth gate (NEW 2026-05-25)
├── agent-action.js               16 agent action handlers (~1,255 lines)
├── chat.js                       Anthropic forward proxy
├── notify.js                     Client-action notifications → Resend + Slack + n8n + DB persistence
├── cid-scrape.js                 Bearer-token-gated competitor intel reader
├── apify-scrape.js               Scraping actor proxy
├── unsplash.js                   Image search proxy
└── higgsfield.js                 (untracked WIP)

supabase/migrations/
├── 002_profiles.sql              Original auth role table
├── 003_cid_posts.sql             Competitor intel scrapes
├── 20260523_agent_events.sql     Real agent history (Move 2)
├── 20260523_clients_multitenant.sql  Multi-client root
├── 20260523_notifications.sql    Durable notifications (Move 3)
├── 20260524_client_logos_bucket.sql  Public Storage bucket for logos
├── 20260525_admin_rls_for_oauth.sql       Admin-only RLS for content_items + profiles + storage
├── 20260525_drop_temp_anon_policies.sql   Cleanup of bypass-era policies
├── 20260525_client_users_allowlist.sql    External-client invite/allowlist
└── 20260525_clients_slack_webhook.sql     Per-client Slack webhook column
```

## Auth flow (current)

1. User visits `https://usevantus.com` → `App.jsx` mounts → checking spinner.
2. `sb.auth.getSession()` resolves (or fails → 4s `stuckGuard` forces UI render).
3. `setupSession(s)` branches on email:
   - **@cloudscenic.com** → `admin` role (or `client` for non-ADMIN_EMAILS cloudscenic users) → renders `<Vantus>`.
   - **External email** → `sb.from('client_users').eq('email', email)` lookup:
     - `status='approved'` → `client` role, scoped to their `client_id(s)` → renders `<ClientView>`.
     - `status='pending'` → renders `<PendingApprovalScreen>` + fires `/api/notify` for first-login. Realtime listener auto-unlocks when admin approves.
     - `status='rejected'` or not in table → alert + `signOut()`.

Server-side, every protected function calls `requireUser(event)` first. It validates the Supabase JWT via `/auth/v1/user`, then checks the email against either the `@cloudscenic.com` domain or the `client_users` table.

## Data flow

```
User action → React state → Supabase (insert/update)
                                  ↓
                            Realtime event
                                  ↓
                      All connected clients update
```

Agent actions:
```
UI button → apiFetch('/api/agent-action', { Bearer <token> })
            → requireUser (verify JWT + allowlist)
            → switch on action key → handler
            → Anthropic + Supabase
            → agent_events row written
            → response → UI
```

## Realtime channels

| Table | Subscribed by | What updates |
|---|---|---|
| `content_items` | `App.jsx` | Pipeline + ClientView re-render on any insert/update/delete |
| `clients` | `App.jsx` | Client picker stays current when admins add/edit/archive |
| `notifications` | `App.jsx` | Notification panel + unread dot, scoped by `client_id` |
| `agent_events` | `ActivityFeed.jsx` | Live feed of agent actions |
| `client_users` | `App.jsx` (when `pendingInvite` is set) + `ClientTeamPanel` | Pending → approved status flip unlocks the user instantly |

## Multi-tenancy

Single `clients` table seeded with VitalLyfe. Each row carries: name, slug, brand voice (markdown), logo, primary contact email, Slack webhook URL, n8n webhook URL.

Content / events / notifications are scoped via `client_id` foreign keys. `App.jsx` keeps a `currentClient` in state (persisted to `localStorage.vantus_current_client_id`) and every list query filters by it.

External-client teammates (e.g. Natalia at VitalLyfe) are managed via the `client_users` allowlist. Admins invite via the Team Access panel in the Edit Client modal. The invitee logs in with Google → sees "awaiting approval" → admin approves → unlocked.

## Open architectural debt

See `docs/architecture-map/open-items.md` for the live punch-list. Headline items:

- **Brain Move 1 not done.** `agent-action.js:138-144` + `memory.js:75-81` still hardcode VitalLyfe brand voice — should source from `clients.brand_voice_md`. Until then, every client's agents speak with VitalLyfe's voice.
- **`content_items` has no migration file.** Schema lives only in live Supabase. Drift risk.
- **`agent-action.js` is a 1,255-line monolith.** 16 handlers + Anthropic + Supabase + Slack all in one file.
- **`App.jsx` is ~1,500 lines.** Phase 3.x of `REFACTOR_PLAN.md` was meant to split it.
- **supabase-js auth lock contention** — multi-tab usevantus.com hangs `getSession()` / `signOut()`. Mitigated by 4s `stuckGuard`; not yet auto-recovering.

## What is NOT in the build

`(experimental)/` and `tools/artgrid-scout/`, `tools/cid-scout/` have their own `node_modules` and are not part of the Vite build. `public/portal.html` is a separate static page (1,920-line uncommitted diff documented as intentional WIP in HANDOFF.md).
