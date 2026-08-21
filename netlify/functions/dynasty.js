// Dynasty control proxy — makes Vantus a second client of the Dynasty
// Employer Pipeline API (dynasty-lead-finder.netlify.app) so admins can run
// the capture engine from here. The standalone Cloud Scenic Control Center
// keeps working unchanged; this proxy is purely additive on the Vantus side.
//
// Server-to-server: the Dynasty admin passcode lives in this function's env
// and never reaches the browser. Dynasty's own CORS/origin gates are never
// involved. Requires a Vantus ADMIN session (any @cloudscenic.com account).

const { requireUser, unauthorized, cors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

const RATE_MAX = 120;
const RATE_WINDOW_MS = 60_000;

// Exactly what the ops-center pages call today — nothing else passes.
const DATA_ACTIONS = new Set([
  "audit_list", "counters", "dedupe_apply", "dedupe_scan",
  "ops_brief", "ops_config", "ops_last", "places_budget", "refill_now",
  "suppression_add", "suppression_import", "suppression_list",
  "suppression_remove", "suppression_summary", "suppression_sweep",
  "whoami", "login",
]);
const PATHS = new Set(["/api/data", "/api/scrape", "/api/enrich", "/api/enrich-deep"]);

exports.handler = async (event) => {
  const headers = cors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  // localhost preview only: requireUser's origin allowlist (rightly) blocks
  // non-prod origins on POST, which would make `netlify dev` unusable. Under
  // the dev CLI (NETLIFY_DEV is never set in prod) drop the localhost origin
  // so auth falls through to the normal JWT validation.
  if (process.env.NETLIFY_DEV === "true" && /^https?:\/\/localhost(:\d+)?$/.test(event.headers?.origin || "")) {
    delete event.headers.origin; delete event.headers.Origin;
  }
  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);
  if (auth.user.role !== "admin") {
    return { statusCode: 403, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Admins only" }) };
  }

  const rl = rateLimit("dynasty:" + auth.user.id, RATE_MAX, RATE_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, headers);

  const BASE = process.env.DYNASTY_API_BASE || "https://dynasty-lead-finder.netlify.app";
  const PASSCODE = process.env.DYNASTY_ADMIN_PASSCODE;
  if (!PASSCODE) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "DYNASTY_ADMIN_PASSCODE not configured" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { /* empty */ }
  const { path, ...payload } = body;

  if (!PATHS.has(path)) {
    return { statusCode: 400, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "unknown path" }) };
  }
  if (path === "/api/data" && !DATA_ACTIONS.has(payload.action)) {
    return { statusCode: 400, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "action not allowed from Vantus" }) };
  }

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-passcode": PASSCODE },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return { statusCode: res.status, headers: { ...headers, "Content-Type": "application/json" }, body: text };
  } catch (err) {
    return { statusCode: 502, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: `Dynasty API unreachable: ${err.message}` }) };
  }
};
