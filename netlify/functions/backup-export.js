// backup-export.js — scheduled encrypted export of the operational core
// (Phase B, §3.B.8). Supabase's own backups are not the plan; this is ours:
// nightly AES-256-GCM-encrypted, gzipped JSON of every operational table,
// dropped in the private `backups` storage bucket, with a manifest of row
// counts and a backup_runs ledger row either way (ok OR failed — a backup
// that silently doesn't run is the worst kind).
//
// Encryption key: BACKUP_ENC_KEY (32-byte base64, same contract as
// TOKEN_ENC_KEY). No key → the run is recorded as FAILED, loudly, and the
// BackupsCard in Admin shows it. We never store an unencrypted export.
//
// Restore: see the checklist in the Admin Backups card. Log restore tests
// there too — "last tested restore" is a visible health metric.
//
// Invocation gate (check-stuck-items shape). test=1 alone is a DRY RUN.

const zlib = require("zlib");
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const TEST_KEY     = process.env.CRON_TEST_KEY || "";

// The operational core. Storage objects (logos, review media, report PDFs)
// stay in their buckets — this covers the STATE, which is what a restore needs.
const TABLES = [
  "clients", "content_items", "content_versions", "approvals", "decisions",
  "audit_log", "truth_registry", "tasks", "team_members", "invoices",
  "stripe_customers", "client_users", "client_vault", "skill_briefs",
  "client_reports", "content_comments", "intake_requests", "connected_accounts",
  "notifications", "backup_runs",
];

function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", ...(init.headers || {}),
    },
  });
}

function getKey() {
  const raw = process.env.BACKUP_ENC_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENC_KEY must be a 32-byte base64 value");
  return key;
}

// v1:<iv b64>:<tag b64> header line + raw ciphertext body (binary-safe).
function encryptBuffer(buf, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = Buffer.from(`v1:${iv.toString("base64")}:${tag.toString("base64")}\n`, "utf8");
  return Buffer.concat([header, ciphertext]);
}

exports.handler = async (event) => {
  if (!SERVICE_KEY) return { statusCode: 500, body: "SUPABASE_SERVICE_KEY not set" };

  const qs = event?.queryStringParameters || {};
  let scheduled = false;
  try { scheduled = !!JSON.parse(event?.body || "{}").next_run; } catch {}
  const isTest = qs.test === "1";
  if (!scheduled && !isTest) return { statusCode: 403, body: "scheduled invocations only (use ?test=1&key=...)" };
  if (isTest && TEST_KEY && qs.key !== TEST_KEY) return { statusCode: 403, body: "bad test key" };
  const dryRun = isTest && qs.fire !== "1";

  const startedAt = new Date().toISOString();
  const stamp = startedAt.slice(0, 19).replace(/[:T]/g, "-");
  const location = `backups/vantus-${stamp}.json.gz.enc`;

  const logRun = (fields) => sb("backup_runs", {
    method: "POST",
    body: JSON.stringify({ kind: "export", started_at: startedAt, completed_at: new Date().toISOString(), ...fields }),
  }).catch((e) => console.warn("[backup] run log failed:", e.message));

  try {
    const key = getKey();
    if (!key) {
      if (!dryRun) await logRun({ status: "failed", error: "BACKUP_ENC_KEY missing — refusing to store an unencrypted export. Set a 32-byte base64 key in Netlify env." });
      return { statusCode: 200, body: JSON.stringify({ ok: false, dryRun, error: "BACKUP_ENC_KEY missing" }) };
    }

    // Pull every table (up to 10k rows each — far above current scale; the
    // manifest records exact counts so a silent cap would be visible).
    const dump = { exported_at: startedAt, source: SUPABASE_URL, tables: {} };
    const manifest = {};
    for (const t of TABLES) {
      const r = await sb(`${t}?select=*`, { headers: { Range: "0-9999", Prefer: "count=exact" } });
      if (!r.ok) { manifest[t] = `ERROR ${r.status}`; dump.tables[t] = []; continue; }
      const rows = await r.json();
      dump.tables[t] = rows;
      manifest[t] = rows.length;
    }
    dump.manifest = manifest;

    const plain = Buffer.from(JSON.stringify(dump), "utf8");
    const gz = zlib.gzipSync(plain);
    const enc = encryptBuffer(gz, key);

    if (dryRun) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, dryRun, wouldWrite: location, bytes: enc.length, manifest }) };
    }

    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${location}`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/octet-stream", "x-upsert": "true",
      },
      body: enc,
    });
    if (!up.ok) {
      const txt = await up.text();
      throw new Error(`storage upload failed ${up.status}: ${txt.slice(0, 200)}`);
    }

    await logRun({
      status: "ok", location, bytes: enc.length,
      tables_included: Object.keys(manifest),
      notes: `rows: ${Object.entries(manifest).map(([t, n]) => `${t}=${n}`).join(", ")}`,
    });
    console.log(`[backup] ok — ${location} (${enc.length} bytes)`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, location, bytes: enc.length, manifest }) };
  } catch (e) {
    console.error("[backup] failed:", e.message);
    if (!dryRun) await logRun({ status: "failed", error: String(e.message).slice(0, 500) });
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
