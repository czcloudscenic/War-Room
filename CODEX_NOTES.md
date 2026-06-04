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
