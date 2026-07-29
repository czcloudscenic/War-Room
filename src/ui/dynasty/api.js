// Dynasty module API client — same call shapes as the standalone Cloud Scenic
// Control Center (dynasty-leads/ops/src/api.js), but routed through Vantus's
// own /api/dynasty proxy function, which holds the Dynasty admin credential
// server-side and requires a Vantus admin session. The standalone control
// center keeps talking to the Dynasty API directly; this is a parallel client.

import { apiFetch } from "../../services/apiFetch";

export async function api(path, body) {
  const res = await apiFetch("/api/dynasty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, ...(body || {}) }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `error ${res.status}`);
  return res;
}

export const data = (action, args) => api("/api/data", { action, ...args }).then((r) => r.json());
