-- ────────────────────────────────────────────────────────────────────────────
-- Per-client Slack routing (Fix #4)
-- ────────────────────────────────────────────────────────────────────────────
-- Before: notify.js posts every notification to a single global webhook
-- (#vitallyfe-war-room). Wrong for any non-VitalLyfe client.
--
-- After: each client can have its own incoming-webhook URL. notify.js prefers
-- the per-client URL when client_id is present; falls back to global env.
--
-- The existing `slack_channel_id` column stays for now (deprecated, unused).
-- It would require a Slack bot token + chat.postMessage to use — webhooks are
-- the simpler path and what we already have set up.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.clients
  add column if not exists slack_webhook_url text;
