# Vantus — Architecture

## Overview

Vantus is a content operations platform built for Cloud Scenic x VitalLyfe. It runs 8 AI agents, a content pipeline, client portal, and modular app system — all deployed as a single-page app on Netlify with Supabase as the backend.

## Current State (Pre-Refactor)

- **Frontend**: Single `index.html` (~4,440 lines), React 18 via CDN + Babel standalone
- **Backend**: Netlify Functions (`agent-action.js`, `chat.js`, `notify.js`, `setup.js`)
- **Database**: Supabase (PostgreSQL) with realtime subscriptions
- **Auth**: Supabase Auth (email/password)
- **External**: Google Drive (file uploads), Artgrid.io (footage), n8n (webhooks), Resend (email), Slack
- **Deploy**: Netlify auto-deploy on push to `main`

## Target State (Post-Refactor)

A modular codebase with clear separation of concerns, built with Vite for fast dev and clean imports.

### Layer Diagram

```
┌─────────────────────────────────────────┐
│                 index.html              │  Entry point — shell only
├─────────────────────────────────────────┤
│              /src/ui/*                  │  React components (render only)
├──────────┬──────────┬───────────────────┤
│ /src/core│/src/state│ /src/services     │  Logic, state, external APIs
├──────────┴──────────┴───────────────────┤
│           /src/agents                   │  Agent definitions & prompts
├─────────────────────────────────────────┤
│           /src/apps                     │  Optional modular features
├─────────────────────────────────────────┤
│     /src/data    /src/utils             │  Seeds, constants, helpers
└─────────────────────────────────────────┘
```

### What Belongs Where

| Directory | Responsibility | Examples |
|-----------|---------------|----------|
| `/src/core` | Orchestration, routing, memory, mission execution | `routeTask.js`, `memory.js`, `missionRunner.js` |
| `/src/agents` | One file per agent — prompt, keywords, capabilities | `sean.agent.js`, `muse.agent.js` |
| `/src/apps` | Optional modular features, registry, toggle system | `apps.config.js`, `/artgrid/index.js` |
| `/src/ui` | React components — rendering only, no deep logic | `sidebar.js`, `commandInput.js` |
| `/src/services` | External API calls — Supabase, Drive, n8n, Resend | `supabaseClient.js`, `apiService.js` |
| `/src/state` | Shared state management (React context or zustand) | `appState.js`, `pipelineState.js` |
| `/src/utils` | Constants, formatters, validators, localStorage helpers | `constants.js`, `helpers.js` |
| `/src/styles` | CSS files — tokens, layout, per-section styles | `tokens.css`, `globals.css` |
| `/src/data` | Seed data — agents, SOPs, references, apps | `seed.agents.js`, `seed.apps.js` |

### Key Design Rules

1. **V1 is the design law** — spacing, typography, color, tone, hierarchy
2. **No new business logic in index.html** — it becomes a lightweight shell
3. **Components render, services fetch, core orchestrates**
4. **Apps are optional and toggleable** — base pages always visible
5. **Agent memory is invisible infrastructure** — no UI for it

## Netlify Functions (Backend)

These stay as-is. No refactor needed unless adding new endpoints.

| Function | Purpose |
|----------|---------|
| `agent-action.js` | Agent action engine — Supabase CRUD + AI generation |
| `chat.js` | Proxy to Anthropic API for agent chat |
| `notify.js` | Email (Resend) + Slack + n8n notifications |
| `setup.js` | One-time admin user setup (delete after use) |

## Auth Flow

1. Supabase `signInWithPassword` → returns user + session
2. Check `profiles` table for role (`admin` or `client`)
3. Admin → Vantus dashboard. Client → ClientView portal
4. Realtime subscription on `content_items` keeps both views in sync

## Data Flow

```
User action → React state → Supabase (insert/update)
                                ↓
                          Realtime event
                                ↓
                    All connected clients update
```

Agent actions flow through Netlify Functions:
```
UI button → fetch('/api/agent-action') → Anthropic API + Supabase → response → UI
```
