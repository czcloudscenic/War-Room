// notify.js — fires when client approves or requests revisions
// Sends email via Resend API + optional n8n webhook fallback

const ADMIN_EMAILS = [
  "cz@cloudscenic.com",
  "dv@cloudscenic.com",
  "ss@cloudscenic.com",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: cors, body: "Bad JSON" }; }

  const { type, item } = body;
  if (!type || !item) return { statusCode: 400, headers: cors, body: "Missing type or item" };

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

  // ── EMAIL VIA RESEND ────────────────────────────────────────────────────────
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const clientNoteHtml = item.client_note
      ? `<div style="margin-top:16px;padding:14px 16px;background:#fff3f3;border-left:3px solid #ff453a;border-radius:6px;font-size:13px;color:#cc0000;font-style:italic;">"${item.client_note}"</div>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:${isApproved ? "linear-gradient(135deg,#0d2018,#0d4028)" : "linear-gradient(135deg,#1a0d00,#2e1a00)"};padding:32px 32px 28px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Cloud Scenic × VitalLyfe</div>
      <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:-1px;line-height:1.1;">${emoji} ${isApproved ? "Content Approved" : "Revisions Requested"}</div>
    </div>
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;width:90px;">Title</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#1d1d1f;">${item.title}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Campaign</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${item.campaign || "—"}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Platform</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${item.platform || "—"}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Pillar</td><td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.65);">${item.pillar || "—"}</td></tr>
        <tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;">Status</td><td style="padding:8px 0;"><span style="font-size:11px;font-weight:700;color:${isApproved ? "#30d158" : "#ff9f0a"};background:${isApproved ? "rgba(48,209,88,0.1)" : "rgba(255,159,10,0.1)"};padding:3px 10px;border-radius:20px;">${isApproved ? "Approved" : "Needs Revisions"}</span></td></tr>
      </table>
      ${clientNoteHtml}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.07);font-size:11px;color:rgba(0,0,0,0.35);">
        VitalLyfe Vantus · ${new Date().toLocaleString("en-US", { weekday:"long", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" })}
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
          from: "VitalLyfe Vantus <notifications@cloudscenic.com>",
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
  const SLACK = process.env.SLACK_WEBHOOK_URL;
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
            { type: "mrkdwn", text: `*Title*\n${item.title}` },
            { type: "mrkdwn", text: `*Status*\n${isApproved ? "✅ Approved" : "🔄 Needs Revisions"}` },
            { type: "mrkdwn", text: `*Campaign*\n${item.campaign || "—"}` },
            { type: "mrkdwn", text: `*Platform*\n${item.platform || "—"}` },
          ]
        },
        ...(item.client_note ? [{
          type: "section",
          text: { type: "mrkdwn", text: `*Client Note*\n_"${item.client_note}"_` }
        }] : []),
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `VitalLyfe Vantus · ${new Date().toLocaleString("en-US", { weekday:"long", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" })}` }]
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

  // ── N8N FALLBACK ────────────────────────────────────────────────────────────
  const N8N = process.env.N8N_NOTIFY_URL || process.env.N8N_WEBHOOK_URL;
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
