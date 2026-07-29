// approvalRequest — issues one-click approval tokens + sends the client the
// approval-request email. Shared by notify.js (type: approval_requested, fired
// when an item enters a Need-*-Approval gate with approval_mode='client') and
// check-stuck-items.js (the "waiting on client, nudge" re-send).
//
// Token model (approval_tokens, service-key only): two single-use tokens per
// request — one pre-bound to 'approved', one to 'revision_requested' — each
// tied to the recipient email and the item's CURRENT revision round. A stale
// round (item was kicked back and re-sent since) refuses politely.

const crypto = require("crypto");
const { esc, emailShell, ctaButton, detailRows, sendEmail } = require("./emailTemplates");
const { gateForStatus } = require("./approvalFlow");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const TOKEN_TTL_DAYS = 14;

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function baseUrl() {
  // Netlify sets URL to the site's primary origin; localhost netlify dev sets it too.
  return process.env.URL || "https://usevantus.com";
}

/**
 * Resolve who receives approval requests for a client:
 * clients.primary_email first, else every approved client_users email.
 */
async function resolveRecipients(clientId) {
  if (!clientId) return { emails: [], clientName: null, slackWebhook: null };
  const cRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}&select=name,primary_email,slack_webhook_url`,
    { headers: sbHeaders() }
  );
  const row = cRes.ok ? (await cRes.json())?.[0] : null;
  if (row?.primary_email) {
    return { emails: [row.primary_email], clientName: row?.name || null, slackWebhook: row?.slack_webhook_url || null };
  }
  const uRes = await fetch(
    `${SUPABASE_URL}/rest/v1/client_users?client_id=eq.${clientId}&status=eq.approved&select=email`,
    { headers: sbHeaders() }
  );
  const rows = uRes.ok ? await uRes.json() : [];
  return {
    emails: [...new Set(rows.map((r) => r.email).filter(Boolean))],
    clientName: row?.name || null,
    slackWebhook: row?.slack_webhook_url || null,
  };
}

/**
 * Issue the two tokens + send the email. Never throws; returns
 * { ok, tokens: n, emails, results } for the caller's channel report.
 * Tokens are created even when email is dry-run (keyless) so the flow is
 * testable end-to-end on localhost.
 */
async function issueApprovalRequest({ item, clientId }) {
  const gate = gateForStatus(item?.status);
  if (!gate) return { ok: false, error: `item not at an approval gate (status: ${item?.status})` };

  const { emails, clientName } = await resolveRecipients(clientId);
  if (emails.length === 0) {
    return { ok: false, error: "no client recipient (no primary_email, no approved client_users)" };
  }

  const round = Number(item?.revision_count) || 0;
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86400000).toISOString();
  const recipient = emails[0]; // tokens bind to the primary recipient; cc the rest

  const tokens = {
    approved: crypto.randomUUID() + crypto.randomUUID().slice(0, 8),
    revision_requested: crypto.randomUUID() + crypto.randomUUID().slice(0, 8),
  };
  const rows = Object.entries(tokens).map(([decision, token]) => ({
    token,
    content_item_id: item.id,
    client_id: clientId || null,
    stage: gate,
    decision,
    email: recipient,
    revision_round: round,
    expires_at: expiresAt,
  }));

  const tRes = await fetch(`${SUPABASE_URL}/rest/v1/approval_tokens`, {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify(rows),
  });
  if (!tRes.ok) {
    const txt = await tRes.text();
    return { ok: false, error: `token insert failed ${tRes.status}: ${txt.slice(0, 200)}` };
  }

  const approveUrl = `${baseUrl()}/api/approval?token=${tokens.approved}`;
  const changesUrl = `${baseUrl()}/api/approval?token=${tokens.revision_requested}`;
  const gateLabel = gate === "copy" ? "copy" : "content";
  const heading = `👀 ${esc(item.title || "New item")} is ready for your review`;

  const bodyHtml = `
    <p style="font-size:14px;color:#1d1d1f;margin:0 0 18px;">
      Hi${clientName ? " " + esc(clientName) : ""}, a piece of ${gateLabel} is ready for your approval.
      Review it below — one tap records your decision.
    </p>
    ${detailRows([
      ["Title", item.title],
      ["Campaign", item.campaign],
      ["Platform", item.platform],
      ["Round", round > 0 ? `Revision round ${round}` : "First pass"],
    ])}
    <div style="margin-top:24px;">
      ${ctaButton({ href: approveUrl, label: "✓ Approve", background: "linear-gradient(135deg,#1e8e3e,#34a853)" })}
      ${ctaButton({ href: changesUrl, label: "✎ Request changes", background: "linear-gradient(135deg,#b25c00,#e37400)" })}
    </div>
    <p style="font-size:12px;color:rgba(0,0,0,0.45);margin:16px 0 0;">
      Buttons open a confirmation page — nothing is recorded until you confirm there.
      You can also sign in to the portal at ${esc(baseUrl())} to review everything in one place.
    </p>`;

  const emailResult = await sendEmail({
    from: `${clientName ? clientName + " " : ""}Vantus <notifications@cloudscenic.com>`,
    to: emails,
    subject: `👀 Ready for review: "${item.title}"`,
    html: emailShell({
      brandLabel: clientName ? `Cloud Scenic × ${clientName}` : "Cloud Scenic",
      heading,
      headerGradient: "linear-gradient(135deg,#1a1035,#2d1b57)",
      bodyHtml,
      footerLabel: clientName ? `${clientName} Vantus` : "Vantus",
    }),
  });

  return { ok: true, tokens: rows.length, emails, clientName, results: [emailResult] };
}

module.exports = { issueApprovalRequest, resolveRecipients };
