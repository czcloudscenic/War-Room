// approval-decision — records a client (or admin) approval decision.
//
// Two entry modes, one shared execution path, all writes via SERVICE_KEY
// (approvals INSERT is admin-only under RLS, so external clients can't write
// it from the browser — this function is their only path):
//
//   Mode A — portal session: POST with Authorization bearer + JSON
//            { itemId, decision: 'approved'|'revision_requested', feedback }.
//            requireUser; client role must own the item's client_id AND the
//            item must be approval_mode='client'.
//
//   Mode B — one-click email token:
//            GET  ?token=…  → CONFIRMATION PAGE ONLY. Never mutates — email
//                             scanners prefetch GET links, so acting on GET
//                             would approve content by accident.
//            POST token=…   → validates + consumes the token and executes.
//
// After a decision this function fans out DIRECTLY (notifications row, Slack,
// admin email) because /api/notify is session-gated. The notification uses the
// same type + cycle-aware dedupe_key the App.jsx realtime detector produces,
// so whichever writer lands first wins and the other is silently deduped.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");
const { gateForStatus, nextStatus } = require("./_lib/approvalFlow");
const { esc, emailShell, detailRows, sendEmail } = require("./_lib/emailTemplates");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAILS = ["cz@cloudscenic.com", "dv@cloudscenic.com", "ss@cloudscenic.com"];

function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function clientIp(event) {
  return event.headers?.["x-nf-client-connection-ip"] || event.headers?.["client-ip"] || "unknown";
}

// ── HTML responses (Mode B renders real pages in the recipient's browser).
// Netlify's netlify.toml headers don't apply to function responses, so the
// page ships its own minimal styling inline.
function htmlPage(title, inner) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
  body{margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;color:#1d1d1f;}
  .card{max-width:480px;margin:8vh auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
  .head{padding:28px 28px 22px;color:#fff;}
  .head .kicker{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.55;margin-bottom:10px;}
  .head h1{margin:0;font-size:22px;letter-spacing:-0.5px;line-height:1.2;}
  .body{padding:24px 28px 28px;}
  .body p{font-size:14px;line-height:1.5;margin:0 0 16px;}
  table{width:100%;border-collapse:collapse;margin:0 0 8px;}
  td{padding:7px 0;font-size:13px;}
  td.k{width:100px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(0,0,0,0.4);}
  textarea{width:100%;box-sizing:border-box;min-height:96px;padding:12px;border:1px solid rgba(0,0,0,0.15);border-radius:10px;font:inherit;font-size:14px;resize:vertical;}
  button{display:block;width:100%;padding:15px;margin-top:16px;border:0;border-radius:10px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}
  .muted{font-size:12px;color:rgba(0,0,0,0.4);}
</style></head><body><div class="card">${inner}</div></body></html>`;
}

function page(statusCode, title, inner) {
  return { statusCode, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body: htmlPage(title, inner) };
}

function infoPage(statusCode, heading, message, gradient = "linear-gradient(135deg,#1a1035,#2d1b57)") {
  return page(statusCode, heading, `
    <div class="head" style="background:${gradient};"><div class="kicker">Cloud Scenic · Content Review</div><h1>${esc(heading)}</h1></div>
    <div class="body"><p>${esc(message)}</p><p class="muted">Questions? Just reply to the review email.</p></div>`);
}

// ── Token + item loading / validation (shared by GET confirm + POST act) ──
async function loadTokenContext(token) {
  if (!token || typeof token !== "string" || token.length < 20 || token.length > 200) {
    return { fail: infoPage(400, "Invalid link", "This review link is malformed. Use the buttons from the most recent review email.") };
  }
  const tRes = await sb(`approval_tokens?token=eq.${encodeURIComponent(token)}&select=*`);
  const tokenRow = tRes.ok ? (await tRes.json())?.[0] : null;
  if (!tokenRow) {
    return { fail: infoPage(404, "Link not found", "This review link isn't valid. Use the buttons from the most recent review email.") };
  }
  if (tokenRow.used_at) {
    return { fail: infoPage(410, "Already recorded", "A decision for this item was already recorded — nothing more to do. If that wasn't you, reply to the review email and the team will sort it out.") };
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { fail: infoPage(410, "Link expired", "This review link has expired. Ask the team to re-send the item for approval.") };
  }
  const iRes = await sb(`content_items?id=eq.${encodeURIComponent(tokenRow.content_item_id)}&select=id,title,status,client_id,revision_count,approval_mode,campaign,platform`);
  const item = iRes.ok ? (await iRes.json())?.[0] : null;
  if (!item) {
    return { fail: infoPage(410, "Item unavailable", "This item no longer exists.") };
  }
  if (gateForStatus(item.status) !== tokenRow.stage || (Number(item.revision_count) || 0) !== tokenRow.revision_round) {
    return { fail: infoPage(410, "Already handled", `"${item.title}" has moved on since this email was sent (it's now "${item.status}"). No action needed — the portal always shows the live state.`) };
  }
  return { tokenRow, item };
}

// ── Shared execution: audit row → status advance → fan-out ──
async function executeDecision({ item, decision, gate, feedback, approverEmail, approverId, actorIsClient }) {
  const newStatus = nextStatus(decision, gate);
  // The count the row will hold after the approvals_bump_revision trigger runs;
  // must match what the App.jsx realtime detector reads so both dedupe together.
  const round = Number(item.revision_count) || 0;
  const revisionCount = decision === "revision_requested" ? round + 1 : round;

  // 1. Audit row (the trigger increments revision_count on kickbacks).
  //    stage 'client' marks the client gate; internal Ledger decisions record
  //    'copy'/'content' via src/core/approvals.js.
  const aRes = await sb("approvals", {
    method: "POST",
    body: JSON.stringify({
      content_item_id: item.id,
      client_id: item.client_id || null,
      approver_id: approverId || null,
      approver_email: approverEmail || null,
      decision,
      stage: actorIsClient ? "client" : gate,
      feedback: feedback || null,
    }),
  });
  if (!aRes.ok) {
    const txt = await aRes.text();
    throw new Error(`approval write failed ${aRes.status}: ${txt.slice(0, 200)}`);
  }

  // 2. Advance the item (stage mirrors status — boards key on stage).
  const uRes = await sb(`content_items?id=eq.${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: newStatus, stage: newStatus, updated_at: new Date().toISOString(), client_note: feedback || undefined }),
  });
  if (!uRes.ok) {
    const txt = await uRes.text();
    throw new Error(`status update failed ${uRes.status}: ${txt.slice(0, 200)}`);
  }

  // 3. Fan-out — same type + dedupe key the realtime detector produces, so an
  //    open admin tab firing /api/notify for this same flip collapses into this.
  const type = decision === "revision_requested" ? "revision_requested" : "approved";
  const who = actorIsClient ? "Client" : "Team";
  const message = decision === "revision_requested"
    ? `🔄 ${who} requested revisions: "${item.title}"${feedback ? ` — "${feedback}"` : ""}`
    : `✅ ${who} approved: "${item.title}"`;
  const results = [];

  const nRes = await sb("notifications", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({
      type,
      content_item_id: String(item.id),
      dedupe_key: `${type}:${item.id}:r${revisionCount}`,
      client_id: item.client_id || null,
      recipient_email: null,
      payload: { item: { ...item, status: newStatus, revision_count: revisionCount, client_note: feedback || item.client_note || "" }, message },
    }),
  });
  const deduped = nRes.status === 409;
  results.push({ channel: "supabase", ok: nRes.ok || deduped, deduped });

  if (!deduped) {
    // Per-client Slack override, else global.
    let SLACK = process.env.SLACK_WEBHOOK_URL;
    let clientName = null;
    if (item.client_id) {
      try {
        const cRes = await sb(`clients?id=eq.${item.client_id}&select=name,slack_webhook_url`);
        const row = cRes.ok ? (await cRes.json())?.[0] : null;
        if (row?.slack_webhook_url) SLACK = row.slack_webhook_url;
        clientName = row?.name || null;
      } catch { /* fall back to global */ }
    }
    if (SLACK) {
      try {
        const r = await fetch(SLACK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: [
            { type: "header", text: { type: "plain_text", text: decision === "revision_requested" ? "🔄 Revisions Requested" : "✅ Content Approved", emoji: true } },
            { type: "section", fields: [
              { type: "mrkdwn", text: `*Title*\n${esc(item.title)}` },
              { type: "mrkdwn", text: `*By*\n${esc(approverEmail || who)}` },
              ...(clientName ? [{ type: "mrkdwn", text: `*Client*\n${esc(clientName)}` }] : []),
              ...(feedback ? [{ type: "mrkdwn", text: `*Feedback*\n_"${esc(feedback)}"_` }] : []),
            ] },
            { type: "context", elements: [{ type: "mrkdwn", text: "Vantus · client decision" }] },
          ] }),
        });
        results.push({ channel: "slack", ok: r.ok });
      } catch (e) { results.push({ channel: "slack", ok: false, error: e.message }); }
    }
    results.push(await sendEmail({
      from: "Vantus <notifications@cloudscenic.com>",
      to: ADMIN_EMAILS,
      subject: message.slice(0, 140),
      html: emailShell({
        brandLabel: clientName ? `Cloud Scenic × ${clientName}` : "Vantus",
        heading: decision === "revision_requested" ? "🔄 Revisions Requested" : "✅ Content Approved",
        headerGradient: decision === "revision_requested" ? "linear-gradient(135deg,#1a0d00,#2e1a00)" : "linear-gradient(135deg,#0d2018,#0d4028)",
        bodyHtml: detailRows([
          ["Title", item.title],
          ["By", approverEmail || who],
          ["Now", newStatus],
          ["Feedback", feedback],
        ]),
        footerLabel: clientName ? `${clientName} Vantus` : "Vantus",
      }),
    }));
  }

  // 4. Revision-cap check (soft flag; the admin-session path does the same via
  //    /api/notify). Bell + Slack line — admins already got the revision email.
  if (decision === "revision_requested" && item.client_id) {
    try {
      const cRes = await sb(`clients?id=eq.${item.client_id}&select=included_revisions,name,slack_webhook_url`);
      const row = cRes.ok ? (await cRes.json())?.[0] : null;
      const cap = row?.included_revisions != null ? Number(row.included_revisions) : null;
      if (cap != null && revisionCount >= cap) {
        const over = revisionCount > cap;
        const capMsg = `⚠️ "${item.title}" is on revision round ${revisionCount} of ${cap} included${over ? " — OVER the cap" : ""}${row?.name ? ` (${row.name})` : ""}`;
        await sb("notifications", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({
            type: "revision_cap_reached",
            content_item_id: String(item.id),
            dedupe_key: `revision_cap_reached:${item.id}:r${revisionCount}`,
            client_id: item.client_id,
            recipient_email: null,
            payload: { item: { id: item.id, title: item.title, revision_count: revisionCount, cap, client: row?.name }, message: capMsg },
          }),
        });
        const capSlack = row?.slack_webhook_url || process.env.SLACK_WEBHOOK_URL;
        if (capSlack) {
          await fetch(capSlack, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blocks: [
              { type: "section", text: { type: "mrkdwn", text: `⚠️ *Revision cap${over ? " exceeded" : " reached"}*\n${esc(capMsg)}\n_Extra rounds may be billable — check the scope._` } },
              { type: "context", elements: [{ type: "mrkdwn", text: "Vantus · revision tracking" }] },
            ] }),
          }).catch(() => {});
        }
      }
    } catch (e) { console.warn("[approval-decision] cap check failed:", e.message); }
  }

  return { newStatus, revisionCount, results };
}

// ── Mode B: GET → confirmation page (never mutates) ──
async function handleTokenConfirmPage(token) {
  const ctx = await loadTokenContext(token);
  if (ctx.fail) return ctx.fail;
  const { tokenRow, item } = ctx;
  const approving = tokenRow.decision === "approved";
  const heading = approving ? "Confirm approval" : "Request changes";
  const gradient = approving ? "linear-gradient(135deg,#0d2018,#0d4028)" : "linear-gradient(135deg,#1a0d00,#2e1a00)";
  return page(200, heading, `
    <div class="head" style="background:${gradient};"><div class="kicker">Cloud Scenic · Content Review</div><h1>${esc(heading)}</h1></div>
    <div class="body">
      <table>
        <tr><td class="k">Title</td><td style="font-weight:600;">${esc(item.title)}</td></tr>
        ${item.campaign ? `<tr><td class="k">Campaign</td><td>${esc(item.campaign)}</td></tr>` : ""}
        ${item.platform ? `<tr><td class="k">Platform</td><td>${esc(item.platform)}</td></tr>` : ""}
        <tr><td class="k">Gate</td><td>${esc(tokenRow.stage === "copy" ? "Copy approval" : "Content approval")}</td></tr>
      </table>
      <p>${approving
        ? "Confirming marks this item approved and the team moves it forward."
        : "Tell the team what to change — your note goes straight to the item."}</p>
      <form method="POST" action="/api/approval">
        <input type="hidden" name="token" value="${esc(tokenRow.token)}">
        ${approving ? "" : `<textarea name="feedback" placeholder="What should change?" required></textarea>`}
        <button type="submit" style="background:${approving ? "linear-gradient(135deg,#1e8e3e,#34a853)" : "linear-gradient(135deg,#b25c00,#e37400)"};">
          ${approving ? "✓ Yes, approve it" : "✎ Send change request"}
        </button>
      </form>
      <p class="muted" style="margin-top:14px;">Sent to ${esc(tokenRow.email)} · nothing was recorded by opening this page.</p>
    </div>`);
}

// ── Mode B: POST with token → consume + execute ──
async function handleTokenDecision(token, feedback) {
  const ctx = await loadTokenContext(token);
  if (ctx.fail) return ctx.fail;
  const { tokenRow, item } = ctx;

  // Consume atomically: only one caller can flip used_at from null.
  const consume = await sb(
    `approval_tokens?token=eq.${encodeURIComponent(token)}&used_at=is.null`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ used_at: new Date().toISOString() }) }
  );
  const consumed = consume.ok ? await consume.json() : [];
  if (!Array.isArray(consumed) || consumed.length === 0) {
    return infoPage(410, "Already recorded", "A decision for this item was already recorded — nothing more to do.");
  }

  // Invalidate the sibling (the other decision's token for this round).
  await sb(
    `approval_tokens?content_item_id=eq.${encodeURIComponent(item.id)}&revision_round=eq.${tokenRow.revision_round}&used_at=is.null`,
    { method: "PATCH", body: JSON.stringify({ used_at: new Date().toISOString() }) }
  ).catch(() => {});

  const cleanFeedback = (feedback || "").toString().slice(0, 2000).trim();
  if (tokenRow.decision === "revision_requested" && !cleanFeedback) {
    return infoPage(400, "Feedback needed", "Please go back and include a note about what should change.");
  }

  const { newStatus } = await executeDecision({
    item,
    decision: tokenRow.decision,
    gate: tokenRow.stage,
    feedback: cleanFeedback || null,
    approverEmail: tokenRow.email,
    actorIsClient: true,
  });

  const approving = tokenRow.decision === "approved";
  return page(200, "Recorded", `
    <div class="head" style="background:${approving ? "linear-gradient(135deg,#0d2018,#0d4028)" : "linear-gradient(135deg,#1a0d00,#2e1a00)"};">
      <div class="kicker">Cloud Scenic · Content Review</div>
      <h1>${approving ? "✅ Approved — thank you!" : "✎ Change request sent"}</h1>
    </div>
    <div class="body">
      <p>"${esc(item.title)}" is now <strong>${esc(newStatus)}</strong>. The team has been notified${approving ? "" : " and will get on it"}.</p>
      <p class="muted">You can close this tab.</p>
    </div>`);
}

// ── Mode A: portal/admin session ──
async function handleSessionDecision(event, cors) {
  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  const rl = rateLimit("approval:" + auth.user.id, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Bad JSON" }) }; }
  const { itemId, decision, feedback } = body || {};
  if (!itemId || !["approved", "revision_requested"].includes(decision)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "itemId and decision (approved|revision_requested) required" }) };
  }

  const iRes = await sb(`content_items?id=eq.${encodeURIComponent(itemId)}&select=id,title,status,client_id,revision_count,approval_mode,campaign,platform,client_note`);
  const item = iRes.ok ? (await iRes.json())?.[0] : null;
  if (!item) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Item not found" }) };

  const gate = gateForStatus(item.status);
  if (!gate) return { statusCode: 409, headers: cors, body: JSON.stringify({ error: `Item is not at an approval gate (status: ${item.status})` }) };

  const isClient = auth.user.role === "client";
  if (isClient) {
    if (!auth.user.client_ids.includes(item.client_id)) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Not your item" }) };
    }
    if (item.approval_mode !== "client") {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "This item is not client-approvable" }) };
    }
  }

  const cleanFeedback = (feedback || "").toString().slice(0, 2000).trim();
  if (decision === "revision_requested" && !cleanFeedback) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Feedback required for a change request" }) };
  }

  const result = await executeDecision({
    item,
    decision,
    gate,
    feedback: cleanFeedback || null,
    approverEmail: auth.user.email,
    approverId: auth.user.id,
    actorIsClient: isClient,
  });

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, status: result.newStatus, revision_count: result.revisionCount }) };
}

exports.handler = async (event) => {
  const cors = { ...makeCors(event), "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (!SERVICE_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };

  try {
    if (event.httpMethod === "GET") {
      const rl = rateLimit("approval-link:" + clientIp(event), 30, 60_000);
      if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);
      return await handleTokenConfirmPage(event.queryStringParameters?.token);
    }

    if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };

    // Token POST comes from the confirm page as a form submit (no bearer).
    const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const rl = rateLimit("approval-link:" + clientIp(event), 15, 60_000);
      if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);
      const params = new URLSearchParams(event.body || "");
      return await handleTokenDecision(params.get("token"), params.get("feedback"));
    }

    // JSON POST with a token (programmatic one-click) or a bearer session.
    let parsed = {};
    try { parsed = JSON.parse(event.body || "{}"); } catch { /* fall through to session handler's own parse error */ }
    if (parsed.token) {
      const rl = rateLimit("approval-link:" + clientIp(event), 15, 60_000);
      if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);
      return await handleTokenDecision(parsed.token, parsed.feedback);
    }

    return await handleSessionDecision(event, cors);
  } catch (e) {
    console.error("[approval-decision] error:", e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
