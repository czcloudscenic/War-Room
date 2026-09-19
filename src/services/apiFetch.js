// apiFetch — wrapper around fetch() that injects the user's Supabase
// access_token into Authorization for protected Netlify Functions.
//
// Use this for any call to /api/chat, /api/agent-action, /api/notify,
// /api/apify-scrape, /api/unsplash. (cid-scrape uses a separate bearer.)
//
// Usage:
//   import { apiFetch } from "@/services/apiFetch";
//   const res = await apiFetch("/api/chat", { method: "POST", body: JSON.stringify(...) });
//
// If there's no active session the call still goes out (no token attached).
// The function will then return 401, which is what we want — a clear
// "you're logged out" failure rather than silent garbage.

import { sb } from "./supabaseClient";

export async function apiFetch(path, options = {}) {
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;

  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  return path.startsWith("/api/agent-action") ? restoreStreamedStatus(res) : res;
}

// agent-action answers through a streaming wrapper (agent-action-stream.mjs):
// a slow action's HTTP status is sent before the work ends, so a failure rides
// in the body as `__status`. Rebuild the Response callers expect, so every
// `res.ok` / `res.status` check keeps working unchanged.
async function restoreStreamedStatus(res) {
  if (res.status !== 200) return res;
  const text = await res.text();
  let status = 200, body = text;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && Number.isInteger(parsed.__status)) {
      const { __status, ...rest } = parsed;
      status = __status; body = JSON.stringify(rest);
    }
  } catch { /* not JSON: hand it back as it came */ }
  return new Response(body, { status, headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" } });
}
