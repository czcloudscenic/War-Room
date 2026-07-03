// notify.js — fires when a client approves or requests revisions.
// Sends email via Resend + Slack webhook + n8n webhook + persists to the
// notifications table. Slack and n8n URLs are read per-client from
// clients.slack_webhook_url / clients.n8n_webhook_url in a single fetch
// when client_id is on the payload; each falls back to the global env var.
//
// Requires a valid Supabase session (Authorization: Bearer <access_token>).
// requireUser allows @cloudscenic.com admins OR approved client_users.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

const ADMIN_EMAILS = [
  "cz@cloudscenic.com",
  "dv@cloudscenic.com",
  "ss@cloudscenic.com",
];

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const NOTIFY_RATE_LIMIT_MAX = 20;
const NOTIFY_RATE_LIMIT_WINDOW_MS = 60_000;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[ch]));
}

// CORS headers are built per-request from event.origin (tightened 2026-05-26 sweep).
// We compose them inside the handler so each response respects the calling origin
// against the allowlist in _lib/requireUser.js.

// Persist the notification to Supabase. Unique constraint on (type, content_item_id)
// dedupes when multiple admin clients fire /api/notify simultaneously.
async function insertNotification({ type, item, message, client_id }) {
  if (!SERVICE_KEY) return { ok: false, error: "SUPABASE_SERVICE_KEY not set" };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates",  // first writer wins; duplicates silent
      },
      body: JSON.stringify({
        type,
        content_item_id: item?.id ? String(item.id) : null,
        client_id: client_id || item?.client_id || null,
        recipient_email: null,                   // null = broadcast to all admins
        payload: { item, message },
      }),
    });
    if (!res.ok && res.status !== 409) {
      const txt = await res.text();
      return { ok: false, error: `${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, deduped: res.status === 409 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function fmtMoney(n, currency) {
  const amt = (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (currency && currency.toLowerCase() !== "usd") ? `${amt} ${String(currency).toUpperCase()}` : `$${amt}`;
}

// ── Invoice-sent email ────────────────────────────────────────────────────────
// Delivers the invoice to the client's billing email (clients.primary_email),
// falling back to the admin list if none is on file. Also persists a bell
// notification and mirrors to Slack. Kept separate from the approval path so
// each stays simple. When Stripe is wired, it can take over native delivery.
async function handleInvoiceSent({ cors, item, client_id }) {
  const results = [];

  // Resolve client name + billing email + webhooks in one round-trip.
  let clientName = null, clientEmail = null;
  let SLACK = process.env.SLACK_WEBHOOK_URL;
  if (client_id && SERVICE_KEY) {
    try {
      const cRes = await fetch(
        `${SUPABASE_URL}/rest/v1/clients?id=eq.${client_id}&select=name,primary_email,slack_webhook_url`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      if (cRes.ok) {
        const row = (await cRes.json())?.[0];
        clientName = row?.name || null;
        clientEmail = row?.primary_email || null;
        if (row?.slack_webhook_url) SLACK = row.slack_webhook_url;
      }
    } catch (e) { console.warn("[notify] invoice client lookup failed:", e.message); }
  }

  const number = item.number || item.title || "Invoice";
  const amountLabel = fmtMoney(item.amount, item.currency);
  const dueLabel = item.due_date
    ? new Date(item.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "upon receipt";
  const message = `🧾 Invoice ${number} for ${amountLabel} sent to ${clientName || "client"} · due ${dueLabel}`;

  // Persist bell notification (broadcast to admins).
  results.push({ channel: "supabase", ...(await insertNotification({ type: "invoice_sent", item: { ...item, client_id }, message, client_id })) });

  // Email — to the client if we have their address, else the admin list.
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const toClient = !!clientEmail;
  const recipients = clientEmail ? [clientEmail] : ADMIN_EMAILS;
  if (RESEND_KEY) {
    const safeNumber = escapeHtml(number);
    const safeClient = escapeHtml(clientName || "there");
    const safeDesc = escapeHtml(item.description || "");
    const descHtml = item.description
      ? `<tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Description</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${safeDesc}</td></tr>`
      : "";
    const fallbackBanner = toClient ? "" :
      `<div style="margin:0 0 16px;padding:12px 16px;background:#fff8e6;border-left:3px solid #ff9f0a;border-radius:6px;font-size:12px;color:#8a5a00;">No billing email on file for this client — sent to the team instead. Add one in the client's profile.</div>`;
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0a1a2e,#0d2a4a);padding:32px 32px 28px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Cloud Scenic${clientName ? " × " + escapeHtml(clientName) : ""}</div>
      <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:-1px;line-height:1.1;">🧾 Invoice ${safeNumber}</div>
    </div>
    <div style="padding:28px 32px;">
      ${fallbackBanner}
      <p style="font-size:14px;color:#1d1d1f;margin:0 0 18px;">Hi ${safeClient}, here's your invoice from Cloud Scenic.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;width:110px;">Amount due</td><td style="padding:8px 0;font-size:20px;font-weight:700;color:#1d1d1f;">${escapeHtml(amountLabel)}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Due</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${escapeHtml(dueLabel)}</td></tr>
        ${descHtml}
      </table>
      <div style="margin-top:26px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.07);font-size:11px;color:rgba(0,0,0,0.35);">
        Cloud Scenic · Reply to this email with any billing questions.
      </div>
    </div>
  </div>
</body></html>`;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Cloud Scenic Billing <notifications@cloudscenic.com>",
          to: recipients,
          subject: `🧾 Invoice ${number} — ${amountLabel} due ${dueLabel}`,
          html,
        }),
      });
      const data = await res.json().catch(() => ({}));
      results.push({ channel: "email", ok: res.ok, to: toClient ? "client" : "admins", id: data.id, error: data.message });
    } catch (e) {
      results.push({ channel: "email", ok: false, error: e.message });
    }
  } else {
    results.push({ channel: "email", ok: false, error: "RESEND_API_KEY not set" });
  }

  // Slack mirror (internal).
  if (SLACK) {
    try {
      const r = await fetch(SLACK, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: [
          { type: "header", text: { type: "plain_text", text: `🧾 Invoice ${number} sent`, emoji: true } },
          { type: "section", fields: [
            { type: "mrkdwn", text: `*Client*\n${escapeHtml(clientName || "—")}` },
            { type: "mrkdwn", text: `*Amount*\n${escapeHtml(amountLabel)}` },
            { type: "mrkdwn", text: `*Due*\n${escapeHtml(dueLabel)}` },
            { type: "mrkdwn", text: `*Delivered to*\n${toClient ? "client" : "team (no client email)"}` },
          ] },
        ] }),
      });
      results.push({ channel: "slack", ok: r.ok });
    } catch (e) { results.push({ channel: "slack", ok: false, error: e.message }); }
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, message, results }) };
}

exports.handler = async (event) => {
  const cors = { ...makeCors(event), "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  const rl = rateLimit("notify:" + auth.user.id, NOTIFY_RATE_LIMIT_MAX, NOTIFY_RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: cors, body: "Bad JSON" }; }

  const { type, item, client_id } = body;
  if (!type || !item) return { statusCode: 400, headers: cors, body: "Missing type or item" };

  // Invoice-sent has its own recipient (the client) + template — handle and return.
  if (type === "invoice_sent") return handleInvoiceSent({ cors, item, client_id });

  const isApproved = type === "approved";
  const emoji      = isApproved ? "✅" : "🔄";
  const action     = isApproved ? "approved" : "requested revisions on";
  const subject    = isApproved
    ? `✅ Approved: "${item.title}"`
    : `🔄 Revisions requested: "${item.title}"`;

  const payload = {
    event:      type,
    title:      item.title,
    platform:   item.platform,
    campaign:   item.campaign,
    pillar:     item.pillar,
    clientNote: item.client_note || "",
    message:    `${emoji} Client ${action}: "${item.title}" (${item.campaign} · ${item.platform})`,
    ts:         new Date().toISOString(),
  };

  const results = [];

  // ── PERSIST TO NOTIFICATIONS TABLE ──────────────────────────────────────────
  const dbResult = await insertNotification({ type, item, message: payload.message, client_id });
  results.push({ channel: "supabase", ...dbResult });

  // The unique index on (type, content_item_id) makes the first writer win.
  // A deduped insert means another caller (recordApproval + the realtime
  // detector, or a second admin tab) already notified for this state change —
  // skip Slack/email/n8n or every approval fans out once per caller.
  if (dbResult.deduped) {
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, deduped: true, results }) };
  }

  // ── Per-client lookup: webhook URLs + name (one roundtrip) ─────────────────
  let SLACK = process.env.SLACK_WEBHOOK_URL;
  let N8N   = process.env.N8N_NOTIFY_URL || process.env.N8N_WEBHOOK_URL;
  let clientName = null;
  if (client_id) {
    try {
      const cRes = await fetch(
        `${SUPABASE_URL}/rest/v1/clients?id=eq.${client_id}&select=name,slack_webhook_url,n8n_webhook_url`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      if (cRes.ok) {
        const row = (await cRes.json())?.[0];
        if (row?.slack_webhook_url) SLACK = row.slack_webhook_url;
        if (row?.n8n_webhook_url)   N8N   = row.n8n_webhook_url;
        if (row?.name)              clientName = row.name;
      }
    } catch (e) {
      console.warn("[notify] client lookup failed:", e.message);
    }
  }
  const brandLabel = clientName ? `Cloud Scenic × ${clientName}` : "Vantus";
  const footerLabel = clientName ? `${clientName} Vantus` : "Vantus";
  const fromLabel = clientName ? `${clientName} Vantus` : "Vantus";
  const safeBrandLabel = escapeHtml(brandLabel);
  const safeFooterLabel = escapeHtml(footerLabel);
  const safeTitle = escapeHtml(item.title);
  const safeCampaign = escapeHtml(item.campaign || "—");
  const safePlatform = escapeHtml(item.platform || "—");
  const safePillar = escapeHtml(item.pillar || "—");
  const safeClientNote = escapeHtml(item.client_note || "");

  // ── EMAIL VIA RESEND ────────────────────────────────────────────────────────
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const clientNoteHtml = item.client_note
      ? `<div style="margin-top:16px;padding:14px 16px;background:#fff3f3;border-left:3px solid #ff453a;border-radius:6px;font-size:13px;color:#cc0000;font-style:italic;">"${safeClientNote}"</div>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:${isApproved ? "linear-gradient(135deg,#0d2018,#0d4028)" : "linear-gradient(135deg,#1a0d00,#2e1a00)"};padding:32px 32px 28px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${safeBrandLabel}</div>
      <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:-1px;line-height:1.1;">${emoji} ${isApproved ? "Content Approved" : "Revisions Requested"}</div>
    </div>
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;width:90px;">Title</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#1d1d1f;">${safeTitle}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Campaign</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${safeCampaign}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Platform</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${safePlatform}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Pillar</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${safePillar}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Status</td><td style="padding:8px 0;"><span style="font-size:11px;font-weight:700;color:${isApproved ? "#30d158" : "#ff9f0a"};background:${isApproved ? "rgba(48,209,88,0.1)" : "rgba(255,159,10,0.1)"};padding:3px 10px;border-radius:20px;">${isApproved ? "Approved" : "Needs Revisions"}</span></td></tr>
      </table>
      ${clientNoteHtml}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.07);font-size:11px;color:rgba(0,0,0,0.35);">
        ${safeFooterLabel} · ${new Date().toLocaleString("en-US", { weekday:"long", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" })}
      </div>
    </div>
  </div>
</body>
</html>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromLabel} <notifications@cloudscenic.com>`,
          to: ADMIN_EMAILS,
          subject,
          html,
        }),
      });
      const data = await res.json();
      results.push({ channel: "email", ok: res.ok, id: data.id, error: data.message });
    } catch (e) {
      results.push({ channel: "email", ok: false, error: e.message });
    }
  } else {
    results.push({ channel: "email", ok: false, error: "RESEND_API_KEY not set" });
  }

  // ── SLACK ───────────────────────────────────────────────────────────────────
  if (SLACK) {
    const slackBody = {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `${emoji} ${isApproved ? "Content Approved" : "Revisions Requested"}`, emoji: true }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Title*\n${safeTitle}` },
            { type: "mrkdwn", text: `*Status*\n${isApproved ? "✅ Approved" : "🔄 Needs Revisions"}` },
            { type: "mrkdwn", text: `*Campaign*\n${safeCampaign}` },
            { type: "mrkdwn", text: `*Platform*\n${safePlatform}` },
          ]
        },
        ...(item.client_note ? [{
          type: "section",
          text: { type: "mrkdwn", text: `*Client Note*\n_"${safeClientNote}"_` }
        }] : []),
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `${safeFooterLabel} · ${new Date().toLocaleString("en-US", { weekday:"long", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" })}` }]
        }
      ]
    };
    try {
      const res = await fetch(SLACK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody),
      });
      results.push({ channel: "slack", ok: res.ok });
    } catch (e) {
      results.push({ channel: "slack", ok: false, error: e.message });
    }
  }

  // ── N8N (per-client webhook resolved above, else global) ───────────────────
  if (N8N) {
    try {
      await fetch(N8N, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      results.push({ channel: "n8n", ok: true });
    } catch (e) {
      results.push({ channel: "n8n", ok: false, error: e.message });
    }
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ ok: true, message: payload.message, results }),
  };
};
