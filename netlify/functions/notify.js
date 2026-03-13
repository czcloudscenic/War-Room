// notify.js — fires when client approves or requests revisions
// POSTs event to n8n webhook (N8N_WEBHOOK_URL) for Slack/email routing

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const WEBHOOK = process.env.N8N_WEBHOOK_URL;

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad JSON" }; }

  const { type, item } = body; // type: "approved" | "revision_requested"
  if (!type || !item) return { statusCode: 400, body: "Missing type or item" };

  const emoji  = type === "approved" ? "✅" : "🔄";
  const action = type === "approved" ? "approved" : "requested revisions on";
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

  // Fire n8n webhook (best-effort — don't block on failure)
  if (WEBHOOK) {
    try {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("n8n webhook error:", e.message);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, message: payload.message }),
  };
};
