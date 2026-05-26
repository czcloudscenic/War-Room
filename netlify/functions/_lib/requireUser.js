// requireUser — shared caller-auth helper for Netlify Functions.
//
// Allows two kinds of users:
//   1. Agency admin: any email ending in @cloudscenic.com
//   2. External client: email present in public.client_users with status='approved'
//
// Anyone else (no token, expired token, pending invite, rejected, unknown) → 401.
//
// Usage:
//   const { requireUser, unauthorized, corsHeaders } = require("./_lib/requireUser");
//   exports.handler = async (event) => {
//     if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
//     const auth = await requireUser(event);
//     if (!auth.ok) return unauthorized(auth.reason);
//     // auth.user = { id, email, role: 'admin' | 'client', client_ids: [...] }
//   };

const ADMIN_DOMAIN = "cloudscenic.com";

// Origin allowlist (was "*" — tightened 2026-05-26 as part of the security
// hardening sweep). Production (usevantus.com), the original Netlify subdomain,
// and Netlify deploy previews (deploy-preview-*--majestic-cassata-aa16e9.netlify.app)
// are all matched. Anything else gets the production origin returned — which
// means the browser will refuse to read the response cross-origin, but the
// function still executes and writes data (RLS + requireUser still gate).
const ALLOWED_ORIGIN_RE = /^https:\/\/(?:usevantus\.com|(?:[a-z0-9-]+--)?majestic-cassata-aa16e9\.netlify\.app)$/i;
const FALLBACK_ORIGIN = "https://usevantus.com";

function cors(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const allow = ALLOWED_ORIGIN_RE.test(origin) ? origin : FALLBACK_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Back-compat alias — older imports use `corsHeaders` directly without an event.
// They'll get the locked-down production origin instead of "*". Safe for any
// server-to-server call but breaks browser cross-origin for non-prod hosts.
const corsHeaders = {
  "Access-Control-Allow-Origin": FALLBACK_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

function unauthorized(reason = "Unauthorized", event) {
  return {
    statusCode: 401,
    headers: { ...cors(event), "Content-Type": "application/json" },
    body: JSON.stringify({ error: reason }),
  };
}

async function requireUser(event) {
  const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) return { ok: false, reason: "SUPABASE_SERVICE_KEY not configured server-side" };

  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, reason: "Missing bearer token" };

  // 1. Validate the JWT against Supabase /auth/v1/user (service key works as apikey)
  let supabaseUser;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, reason: `Token rejected by Supabase (${res.status})` };
    supabaseUser = await res.json();
  } catch (err) {
    return { ok: false, reason: `Supabase auth lookup failed: ${err.message}` };
  }

  const email = (supabaseUser?.email || "").toLowerCase();
  if (!email) return { ok: false, reason: "No email on token" };

  // 2. Admin path: @cloudscenic.com
  if (email.endsWith(`@${ADMIN_DOMAIN}`)) {
    return {
      ok: true,
      user: { id: supabaseUser.id, email, role: "admin", client_ids: [] },
    };
  }

  // 3. External-client path: must be in client_users with status='approved'
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/client_users` +
      `?select=client_id,status&email=eq.${encodeURIComponent(email)}`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) {
      return { ok: false, reason: `client_users lookup failed (${res.status})` };
    }
    const rows = await res.json();
    const approved = rows.filter((r) => r.status === "approved");
    if (approved.length === 0) {
      const pending = rows.some((r) => r.status === "pending");
      return {
        ok: false,
        reason: pending ? "Invite pending admin approval" : "Email not invited",
      };
    }
    return {
      ok: true,
      user: {
        id: supabaseUser.id,
        email,
        role: "client",
        client_ids: approved.map((r) => r.client_id),
      },
    };
  } catch (err) {
    return { ok: false, reason: `client_users check threw: ${err.message}` };
  }
}

module.exports = { requireUser, unauthorized, corsHeaders, cors };
