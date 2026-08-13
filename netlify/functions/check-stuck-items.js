// check-stuck-items.js — daily bottleneck detector for the content pipeline.
//
// Finds content_items that have sat in one status past its threshold and
// closes the loop: bell notification (deduped per item/status/day), one Slack
// digest, an admin email digest, and exactly one auto-created "Unstick" task
// per item (auto-completed when the item moves). Client-approval items get a
// distinct "waiting on client" treatment: the approval-request email is
// re-sent with fresh one-click links.
//
// Staleness signal is updated_at — trustworthy since the touch trigger in
// 20260729_revision_caps.sql (fills it on any update that doesn't set it).
// Re-fire cadence and task bookkeeping live in stuck_alert_state
// (20260729_stuck_alert_state.sql), cloned from the runway pattern.
//
// Invocation gate (send-monthly-reports shape): scheduled runs carry next_run;
// manual runs need ?test=1&key=<CRON_TEST_KEY>. test=1 alone is a DRY RUN
// (reports candidates, sends nothing); add &fire=1 to send for real.

const { issueApprovalRequest } = require("./_lib/approvalRequest");
const { esc, emailShell, sendEmail } = require("./_lib/emailTemplates");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const SLACK        = process.env.SLACK_WEBHOOK_URL;
const TEST_KEY     = process.env.CRON_TEST_KEY || "";
const ADMIN_EMAILS = ["cz@cloudscenic.com", "dv@cloudscenic.com", "ss@cloudscenic.com"];

// Days an item may sit in a status before it counts as stuck.
const THRESHOLD_DAYS = {
  "Need Copy Approval":        3,
  "Need Content Approval":     3,
  "Needs Revisions":           4,
  "Ready For Copy Creation":   5,
  "Ready For Content Creation": 5,
  "Ready For Schedule":        2,
};
const REFIRE_HOURS = 48;

function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", ...(init.headers || {}),
    },
  });
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

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const statuses = Object.keys(THRESHOLD_DAYS);
  const statusList = statuses.map(s => `"${s}"`).join(",");

  // One read each: candidate items, client lookups, open alert states.
  const iRes = await sb(`content_items?select=id,title,status,client_id,updated_at,approval_mode,revision_count,due_date,block_reason,block_external,block_escalation_date&status=in.(${encodeURIComponent(statusList)})`);
  if (!iRes.ok) return { statusCode: 500, body: `content_items query failed (${iRes.status})` };
  const items = await iRes.json();

  const cRes = await sb(`clients?select=id,name,slack_webhook_url&status=eq.active`);
  const clients = new Map((cRes.ok ? await cRes.json() : []).map(c => [c.id, c]));

  const sRes = await sb(`stuck_alert_state?cleared_at=is.null&select=*`);
  const states = new Map((sRes.ok ? await sRes.json() : []).map(s => [s.content_item_id, s]));

  const results = { stuck: [], cleared: [], nudged: [], tasksCreated: [], tasksCompleted: [], notified: [] };
  const firedItems = [];

  const completeTask = async (taskId) => {
    if (!taskId) return false;
    const r = await sb(`tasks?id=eq.${taskId}&status=neq.done`, {
      method: "PATCH", body: JSON.stringify({ status: "done", updated_at: new Date(now).toISOString() }),
    });
    return r.ok;
  };

  const clearState = async (state, reason) => {
    await sb(`stuck_alert_state?content_item_id=eq.${encodeURIComponent(state.content_item_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ cleared_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }),
    });
    if (await completeTask(state.task_id)) results.tasksCompleted.push(state.content_item_id);
    results.cleared.push(`${state.content_item_id} (${reason})`);
  };

  for (const item of items) {
    const threshold = THRESHOLD_DAYS[item.status];
    const ageDays = (now - new Date(item.updated_at || 0).getTime()) / 86400000;
    const state = states.get(item.id);
    states.delete(item.id); // whatever remains afterward is stale state to clear

    // Phase B exception engine: a legitimate EXTERNAL wait pauses the SLA
    // clock (client delay ≠ our failure, R10) — until its escalation date, if
    // one is set, after which the alarm rings again.
    if (item.block_reason && item.block_external) {
      const escalation = item.block_escalation_date ? new Date(item.block_escalation_date + "T00:00:00Z").getTime() : null;
      if (!escalation || now < escalation) {
        if (state && !dryRun) await clearState(state, `SLA paused — external wait (${item.block_reason})`);
        continue;
      }
    }

    // Not stuck (fresh, or it moved and re-aged) → close any open alert.
    if (!(ageDays >= threshold)) {
      if (state && !dryRun) await clearState(state, `fresh in ${item.status}`);
      continue;
    }

    const stuckDays = Math.floor(ageDays);
    const client = clients.get(item.client_id);
    const waitingOnClient = item.approval_mode === "client" &&
      (item.status === "Need Copy Approval" || item.status === "Need Content Approval");

    // Re-fire cadence: status change re-alerts immediately; same status waits 48h.
    const sameStatus = state?.status === item.status;
    const lastAlert = state?.last_alert_at ? new Date(state.last_alert_at).getTime() : 0;
    if (sameStatus && now - lastAlert < REFIRE_HOURS * 3600000) continue;

    firedItems.push({ item, client, stuckDays, waitingOnClient });
    results.stuck.push(`${item.title} — ${item.status} ${stuckDays}d${waitingOnClient ? " (client)" : ""}`);
    if (dryRun) continue;

    const message = waitingOnClient
      ? `⏳ Waiting on client ${stuckDays}d: "${item.title}" (${client?.name || "—"}) — approval request re-sent`
      : `🪨 Stuck ${stuckDays}d in ${item.status}: "${item.title}"${client?.name ? ` (${client.name})` : ""}`;

    // Bell (deduped once per item/status/day).
    const nRes = await sb("notifications", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        type: "item_stuck",
        content_item_id: String(item.id),
        dedupe_key: `item_stuck:${item.id}:${item.status}:${today}`,
        client_id: item.client_id || null,
        recipient_email: null,
        payload: { item: { id: item.id, title: item.title, status: item.status, stuck_days: stuckDays }, message },
      }),
    }).catch(() => null);
    if (nRes?.ok) results.notified.push(item.id);

    // Client-approval items: nudge = re-send the one-click approval email.
    if (waitingOnClient) {
      try {
        const nudge = await issueApprovalRequest({ item, clientId: item.client_id });
        results.nudged.push(`${item.title}: ${nudge.ok ? (nudge.emails || []).join(",") : nudge.error}`);
      } catch (e) {
        results.nudged.push(`${item.title}: failed — ${e.message}`);
      }
    }

    // Ensure exactly one open Unstick task per item (id tracked in state).
    let taskId = state?.task_id || null;
    let taskStillOpen = false;
    if (taskId) {
      const tRes = await sb(`tasks?id=eq.${taskId}&status=neq.done&select=id`);
      taskStillOpen = tRes.ok && (await tRes.json()).length > 0;
    }
    if (!taskStillOpen) {
      const tRes = await sb("tasks", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title: `Unstick: ${item.title}`,
          description: waitingOnClient
            ? `"${item.title}" has waited on client approval for ${stuckDays} days. The approval-request email (one-click links) was re-sent automatically — chase directly if it stays quiet. Auto-created by check-stuck-items; completes itself when the item moves.`
            : `"${item.title}" has sat in "${item.status}" for ${stuckDays} days (threshold ${threshold}d). Auto-created by check-stuck-items; completes itself when the item moves.`,
          status: "backlog",
          priority: stuckDays >= threshold + 3 ? "urgent" : "high",
          client_id: item.client_id || null,
          due_date: today,
          source: "ai_ops",
          reason: `stuck ${item.status} ${stuckDays}d`,
        }),
      });
      const created = tRes.ok ? (await tRes.json())?.[0] : null;
      if (created?.id) { taskId = created.id; results.tasksCreated.push(item.title); }
    }

    // Alert-state upsert.
    await sb(`stuck_alert_state?on_conflict=content_item_id`, {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        content_item_id: item.id,
        client_id: item.client_id || null,
        status: item.status,
        stuck_days: stuckDays,
        first_detected_at: state?.first_detected_at || new Date(now).toISOString(),
        last_alert_at: new Date(now).toISOString(),
        cleared_at: null,
        task_id: taskId,
        last_snapshot: { status: item.status, stuck_days: stuckDays, waiting_on_client: waitingOnClient },
        updated_at: new Date(now).toISOString(),
      }),
    }).catch((e) => console.warn("[stuck] state upsert failed:", e.message));
  }

  // States whose items left the watched statuses entirely (approved, posted,
  // scrapped, deleted) never appeared above — close them out.
  if (!dryRun) {
    for (const state of states.values()) {
      await clearState(state, "left pipeline gates");
    }
  }

  // One Slack digest for everything that fired this run.
  if (!dryRun && firedItems.length && SLACK) {
    const lines = firedItems.slice(0, 20).map(({ item, client, stuckDays, waitingOnClient }) =>
      `• *${item.title}* — ${waitingOnClient ? `waiting on client ${stuckDays}d (nudged)` : `${item.status} · ${stuckDays}d`}${client?.name ? ` · ${client.name}` : ""}`
    ).join("\n");
    await fetch(SLACK, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: [
        { type: "header", text: { type: "plain_text", text: `🪨 ${firedItems.length} stuck item${firedItems.length === 1 ? "" : "s"} in the pipeline`, emoji: true } },
        { type: "section", text: { type: "mrkdwn", text: lines } },
        { type: "context", elements: [{ type: "mrkdwn", text: "Vantus · daily bottleneck check — Unstick tasks created, client approvals re-sent" }] },
      ] }),
    }).catch(() => {});
  }

  // Admin email digest (dry-run safe via emailTemplates).
  if (!dryRun && firedItems.length) {
    const rows = firedItems.map(({ item, client, stuckDays, waitingOnClient }) =>
      `<tr><td style="padding:9px 0;font-size:14px;font-weight:600;color:#1d1d1f;">${esc(item.title)}<span style="font-weight:400;color:rgba(0,0,0,0.45);">${client?.name ? " · " + esc(client.name) : ""}</span></td>` +
      `<td style="padding:9px 0;font-size:12px;color:#b25c00;text-align:right;white-space:nowrap;">${waitingOnClient ? `client · ${stuckDays}d` : `${esc(item.status)} · ${stuckDays}d`}</td></tr>`
    ).join("");
    await sendEmail({
      from: "Vantus Operations <notifications@cloudscenic.com>",
      to: ADMIN_EMAILS,
      subject: `🪨 ${firedItems.length} stuck item${firedItems.length === 1 ? "" : "s"} in the pipeline`,
      html: emailShell({
        brandLabel: "Vantus · Operations",
        heading: `${firedItems.length} item${firedItems.length === 1 ? "" : "s"} not moving`,
        headerGradient: "linear-gradient(135deg,#1a0d00,#2e1a00)",
        bodyHtml: `<table style="width:100%;border-collapse:collapse;">${rows}</table>`,
        footerLabel: "Vantus Operations · daily bottleneck check",
      }),
    });
  }

  console.log(`[stuck] ${firedItems.length} fired, ${results.cleared.length} cleared`, JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ ok: true, dryRun, ...results }) };
};
