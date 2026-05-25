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

  return fetch(path, { ...options, headers });
}
