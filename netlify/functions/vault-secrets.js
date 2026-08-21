// vault-secrets.js — Vault hardening (v3 spec §3.D.3): keys/logins per client
// (or agency-level), AES-256-GCM encrypted at rest via _lib/crypto
// (TOKEN_ENC_KEY — same contract as connected-account tokens).
//
// The vault_secrets table has RLS enabled with ZERO policies: the browser can
// never read it, even with a valid session. Every operation goes through here.
// Masked by default: `list` never returns secret material; only an explicit
// `reveal` decrypts ONE secret, and every reveal writes a view-audit row
// (audit_log, values never logged — §3.B.5 discipline).

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");
const { encrypt, decrypt } = require("./_lib/crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;
const SH = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
});

const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const LIST_COLS = "id,client_id,label,username,notes,created_by,updated_at,created_at";

async function sbFetch(path, init = {}) {
  const res = await fetch(`${REST}/${path}`, { ...init, headers: { ...SH(), ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`supabase ${init.method || "GET"} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

// View-audit trail: WHO touched WHICH secret, never the contents.
async function audit({ client_id, entity_id, actor_email, reason }) {
  try {
    await sbFetch("audit_log", {
      method: "POST",
      body: JSON.stringify({
        client_id: client_id || null,
        entity_type: "vault_secret",
        entity_id: String(entity_id),
        field: "secret",
        actor_kind: "human",
        actor_email: actor_email || null,
        reason,
      }),
    });
  } catch (e) {
    console.warn("[vault-secrets] audit write failed (non-blocking):", e.message);
  }
}

exports.handler = async (event) => {
  const cors = makeCors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);
  if (auth.user.role !== "admin") {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "admin only" }) };
  }
  const rl = rateLimit(`vault-secrets:${auth.user.id}`, RATE_MAX, RATE_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);
  if (!SERVICE_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };
  }

  const email = auth.user.email || null;
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const { action } = body;

  try {
    // ── list: metadata only, never secret material ──
    if (action === "list") {
      const filter = body.client_id ? `client_id=eq.${body.client_id}` : "";
      const rows = await sbFetch(`vault_secrets?select=${LIST_COLS}${filter ? `&${filter}` : ""}&order=label`);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, secrets: rows || [] }) };
    }

    // ── save: create or update; secret is encrypted before it touches the DB ──
    if (action === "save") {
      const label = String(body.label || "").trim();
      if (!label) throw new Error("label required");
      const patch = {
        label,
        username: body.username ? String(body.username) : null,
        notes: body.notes ? String(body.notes) : null,
        client_id: body.client_id || null,
        updated_at: new Date().toISOString(),
      };
      const secret = body.secret == null ? null : String(body.secret);
      if (body.id) {
        if (secret) patch.secret_enc = encrypt(secret); // omit secret = keep the stored one
        const rows = await sbFetch(`vault_secrets?id=eq.${body.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(patch),
        });
        if (!rows?.length) throw new Error("secret not found");
        await audit({ client_id: rows[0].client_id, entity_id: body.id, actor_email: email, reason: secret ? "secret updated (value rotated)" : "secret metadata updated" });
        const { secret_enc, ...safe } = rows[0];
        return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, secret: safe }) };
      }
      if (!secret) throw new Error("secret required for a new entry");
      const rows = await sbFetch("vault_secrets", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...patch, secret_enc: encrypt(secret), created_by: email }),
      });
      await audit({ client_id: rows[0].client_id, entity_id: rows[0].id, actor_email: email, reason: "secret created" });
      const { secret_enc, ...safe } = rows[0];
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, secret: safe }) };
    }

    // ── reveal: decrypt ONE secret; the reveal itself is the audited event ──
    if (action === "reveal") {
      if (!body.id) throw new Error("id required");
      const rows = await sbFetch(`vault_secrets?id=eq.${body.id}&select=id,client_id,label,secret_enc`);
      if (!rows?.length) throw new Error("secret not found");
      const value = decrypt(rows[0].secret_enc);
      await audit({ client_id: rows[0].client_id, entity_id: rows[0].id, actor_email: email, reason: `secret revealed: ${rows[0].label}` });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, value }) };
    }

    // ── remove ──
    if (action === "remove") {
      if (!body.id) throw new Error("id required");
      const rows = await sbFetch(`vault_secrets?id=eq.${body.id}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      if (!rows?.length) throw new Error("secret not found");
      await audit({ client_id: rows[0].client_id, entity_id: body.id, actor_email: email, reason: `secret deleted: ${rows[0].label}` });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `unknown action: ${action}` }) };
  } catch (e) {
    const missing = /vault_secrets/.test(e.message) && /404|relation|does not exist/i.test(e.message);
    return {
      statusCode: missing ? 424 : 500,
      headers: cors,
      body: JSON.stringify({ error: missing ? "vault_secrets table missing — run supabase/migrations/20260821_phase_d.sql first" : e.message }),
    };
  }
};
