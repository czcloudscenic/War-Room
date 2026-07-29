// intake.js — the public client intake endpoint (/api/intake).
//
// UNAUTHENTICATED on purpose: clients use it from a bare link, no login. The
// gates, in order:
//   1. intake token (?t= / body.t) must resolve to an active client — the real
//      auth; rotating clients.intake_token kills every shared link.
//   2. honeypot field ("website") filled → fake 200 success, row dropped.
//   3. best-effort IP rate limit (in-memory — the token is the real gate).
//   4. hard length caps + server-built row: nothing client-sent is written
//      except through the explicit field whitelist below.
//
// Writes land in intake_requests (STAGED — admin-only RLS, never straight into
// content_items). Admins promote/dismiss from Operations. Does NOT touch
// _lib/requireUser's origin allowlist; this endpoint accepts same-origin form
// posts only by virtue of being linked from our own page.
//
// GET ?t=<token> → { ok, client_name } so the form can greet + validate early.

const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const FIELD_CAPS = {
  submitter_name: 120,
  submitter_email: 200,
  request_type: 40,
  title: 200,
  description: 4000,
  target_date: 40,
};
const REQUEST_TYPES = ["Reel", "Short", "Graphics (IMG)", "Carousel", "Story", "Thread", "YouTube", "Other"];

function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", ...(init.headers || {}),
    },
  });
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

async function resolveClient(token) {
  if (!token || typeof token !== "string" || token.length < 16 || token.length > 100) return null;
  const res = await sb(`clients?intake_token=eq.${encodeURIComponent(token)}&status=eq.active&select=id,name,slug`);
  return res.ok ? (await res.json())?.[0] || null : null;
}

exports.handler = async (event) => {
  if (!SERVICE_KEY) return json(500, { error: "server not configured" });

  const ip = event.headers?.["x-nf-client-connection-ip"] || event.headers?.["client-ip"] || "unknown";
  const rl = rateLimit("intake:" + ip, 10, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, { "Content-Type": "application/json" });

  // Token validation ping from the form (shows the client's name).
  if (event.httpMethod === "GET") {
    const client = await resolveClient(event.queryStringParameters?.t);
    if (!client) return json(404, { ok: false, error: "invalid link" });
    return json(200, { ok: true, client_name: client.name });
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad JSON" }); }

  const client = await resolveClient(body.t);
  if (!client) return json(404, { error: "This intake link isn't valid — ask your Cloud Scenic contact for a fresh one." });

  // Honeypot: bots fill every field. Pretend success, write nothing.
  if ((body.website || "").toString().trim()) {
    return json(200, { ok: true });
  }

  const clean = {};
  for (const [field, cap] of Object.entries(FIELD_CAPS)) {
    const v = (body[field] ?? "").toString().trim().slice(0, cap);
    clean[field] = v || null;
  }
  if (!clean.title && !clean.description) {
    return json(400, { error: "Tell us at least a title or a description." });
  }
  if (clean.request_type && !REQUEST_TYPES.includes(clean.request_type)) clean.request_type = "Other";

  const links = Array.isArray(body.links)
    ? body.links.map(l => l.toString().trim().slice(0, 500)).filter(Boolean).slice(0, 10)
    : (body.links || "").toString().split(/\s+/).map(s => s.trim().slice(0, 500)).filter(s => /^https?:\/\//i.test(s)).slice(0, 10);

  const ins = await sb("intake_requests", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ client_id: client.id, ...clean, links }),
  });
  if (!ins.ok) {
    const txt = await ins.text();
    console.error("[intake] insert failed:", ins.status, txt.slice(0, 200));
    return json(500, { error: "Couldn't save your request — please try again." });
  }
  const row = (await ins.json())?.[0];

  // Bell + Slack (best-effort; the row is already safe).
  const message = `📥 New intake from ${client.name}: "${clean.title || (clean.description || "").slice(0, 60)}"`;
  await sb("notifications", {
    method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({
      type: "intake_received",
      content_item_id: null,
      dedupe_key: `intake_received:${row?.id || Date.now()}`,
      client_id: client.id,
      recipient_email: null,
      payload: { item: { id: row?.id, title: clean.title, client: client.name, type: clean.request_type }, message },
    }),
  }).catch(() => {});

  const SLACK = process.env.SLACK_WEBHOOK_URL;
  if (SLACK) {
    await fetch(SLACK, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: [
        { type: "section", text: { type: "mrkdwn", text: `📥 *New intake request* — ${client.name}\n*${(clean.title || "Untitled").replace(/[<>&]/g, "")}*${clean.request_type ? ` · ${clean.request_type}` : ""}${clean.target_date ? ` · wanted by ${clean.target_date}` : ""}\n${(clean.description || "").slice(0, 280).replace(/[<>&]/g, "")}` } },
        { type: "context", elements: [{ type: "mrkdwn", text: "Vantus · triage in Operations → Intake" }] },
      ] }),
    }).catch(() => {});
  }

  return json(200, { ok: true });
};
