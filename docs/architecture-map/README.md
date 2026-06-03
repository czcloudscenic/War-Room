# Vantus Architecture Map

> Regenerated 2026-06-03 via `/architecture-map`. Portable companion to `../../architecture-map.html`.

**Vantus** (repo/internal name "warroom") is a content-operations dashboard, mid-pivot from a VitalLyfe-specific agency tool into a self-serve social-analytics product. It runs four AI agents, a content pipeline, multi-tenant client management, and — newest — OAuth-connected Instagram / TikTok / YouTube accounts whose synced posts feed an analytics + "why it won" engine.

**Stack:** React 19 + Vite 8 (Node 22) · Supabase (Postgres + Auth + Storage + Realtime) · Netlify Functions · Anthropic Claude (haiku-4-5 server-side, sonnet-4-6 client chat) · external: Apify, Unsplash, Resend, Slack, n8n, Meta/IG, TikTok, Google/YouTube, Google Drive.

**The fastest way to grok the system is the interactive map:** open `../../architecture-map.html` directly, or `python3 -m http.server 4747` and visit `http://localhost:4747/architecture-map.html`.

---

## Notable findings from this map

- **Two HIGH schema-drift + broken-write bugs in Competitor Intel.** `cid_library` and `cid_performance` have **no CREATE TABLE migration**; `CIDPage.jsx` writes them through `SUPABASE_URL` / `SUPABASE_KEY` identifiers it **never imports** — so "Send to Content Tracker" and "Log Results" throw `ReferenceError` on click. The performance write also uses the browser anon key. (Bugs in `known-bugs.md`; Fixes #1, #2.)
- **The headline new feature has a known scoping bug.** `scrappy_analyze_performance` ("Why these won") surfaces reasons across multiple posts and the displayed top set leans on raw views — it should target the true top performer(s) with one consistent ranking metric. Operator-flagged; Fix #3.
- **Rate-limit coverage is partial.** Only `chat.js` and `agent-action.js` call `rateLimit`. `apify-scrape` (burns Apify credits), the three `sync-*` functions (paid platform APIs), `unsplash`, and `notify` (email/Slack/n8n fanout) are ungated. Fix #4.
- **OAuth security debt.** Access/refresh tokens are stored **plaintext** in `connected_account_tokens`, and the six deauthorize/data-deletion webhooks are **unverified no-ops** that never delete a revoked token. (The token table's service-role-only RLS posture itself is correct.) Fixes #5, #6.
- **Multi-tenant realtime leak risk.** `App.jsx` subscribes to ALL `content_items` and filters only at render — every browser receives realtime rows for clients not on screen. Safe for admins today; risky if an external client role reaches the main shell. Fix #9.
- **Dead code located.** `muse_from_brief` handler (no caller), `QuickActionsDashboard` / `TypingTask` / `PlaceholderPage` (imported, never rendered), and an unused `OPS_INIT` import in App.jsx. Fix #11.
- **Model split + duplication.** Server agent actions pin `claude-haiku-4-5-20251001`; frontend chat sends `claude-sonnet-4-6`. Three agent-action handlers inline a duplicate Anthropic fetch instead of the shared `ai()` — each needs a separate edit on a model bump.

---

## Cluster overview

| Cluster | What lives here | Key nodes |
|---|---|---|
| **Client** | React entry + root | `main.jsx`, `App.jsx` (auth gate, state, router) |
| **Routes** | Nav-switched screens | Dashboard, Content, Agents, **Analytics**, Settings |
| **UI / Apps** | Components + feature apps | ConnectedAccountsCard, AgentChatPage, ContentPipelineBoard, CIDPage, ArtgridScout, AdROIHub |
| **Core / Services** | Shared client logic | `apiFetch` (token inject), `supabaseClient`, `routeTask`, `memory`, `agentRegistry` |
| **Server** | Netlify Functions | **agent-action** (13 actions), chat, notify, apify-scrape, unsplash, oauth-*, sync-*, `_lib` (requireUser, rateLimit, oauth) |
| **Data** | Supabase tables | clients, profiles, client_users, content_items, agent_events, notifications, connected_accounts, connected_account_tokens, account_posts, oauth_states, + 2 drift tables |
| **External** | Third-party APIs | Anthropic, Tavily, Apify, Unsplash, Resend, Slack, n8n, Meta/IG, TikTok, Google/YouTube, Drive |

---

## Navigation

- [critical-path.md](critical-path.md) — the agent-action spine, step by step
- [nodes.md](nodes.md) — every node catalogued by cluster
- [known-bugs.md](known-bugs.md) — severity-ranked, file:line cited
- [roadmap.md](roadmap.md) — 17 numbered fixes with approach
- [open-items.md](open-items.md) — the working checkbox punch-list
