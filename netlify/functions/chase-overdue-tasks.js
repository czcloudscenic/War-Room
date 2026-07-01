// chase-overdue-tasks.js — scheduled "chase" for the AI Operations board.
//
// Runs daily (schedule in netlify.toml). Finds tasks that are past their
// due_date and not done, then nudges the assignee + Danny (owner) so nothing
// rots in the backlog. Sends a per-assignee email digest via Resend, a Slack
// summary, and writes in-app notification rows for the bell.
//
// Runs server-side with SUPABASE_SERVICE_KEY (no user session) — this is why it
// does its own sending rather than calling /api/notify (which is session-gated
// and shaped for content-approval events).
//
// Idempotent-ish: one notification row per (task, day) via the notifications
// unique index on (type, content_item_id), so a same-day re-run won't double-post
// the in-app bell. Email is best-effort and not deduped (the cron fires once/day).

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const SLACK        = process.env.SLACK_WEBHOOK_URL;
const OWNER_EMAIL  = process.env.OPS_OWNER_EMAIL || "dv@cloudscenic.com"; // Danny

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function daysOverdue(due) {
  const t = new Date(due + "T00:00:00Z").getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

async function sendEmail(to, subject, rows, heading) {
  if (!RESEND_KEY) return { channel: "email", to, ok: false, error: "RESEND_API_KEY not set" };
  const list = rows.map(t => {
    const d = daysOverdue(t.due_date);
    const client = t.client?.name ? ` · ${esc(t.client.name)}` : "";
    return `<tr>
      <td style="padding:10px 0;font-size:14px;font-weight:600;color:#1d1d1f;">${esc(t.title)}<span style="font-weight:400;color:rgba(0,0,0,0.45);">${client}</span></td>
      <td style="padding:10px 0;font-size:12px;color:${d >= 3 ? "#cc0000" : "#b25c00"};text-align:right;white-space:nowrap;">${d === 0 ? "due today" : `${d}d overdue`}</td>
    </tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1a0d00,#2e1a00);padding:30px 32px 26px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Vantus · Operations</div>
      <div style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-1px;line-height:1.1;">${esc(heading)}</div>
    </div>
    <div style="padding:24px 32px 28px;">
      <table style="width:100%;border-collapse:collapse;">${list}</table>
      <div style="margin-top:24px;padding-top:18px;border-top:1px solid rgba(0,0,0,0.07);font-size:11px;color:rgba(0,0,0,0.35);">
        ${rows.length} open item${rows.length === 1 ? "" : "s"} past due · Vantus Operations
      </div>
    </div>
  </div>
</body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Vantus Operations <notifications@cloudscenic.com>", to: [to], subject, html }),
    });
    const data = await res.json().catch(() => ({}));
    return { channel: "email", to, ok: res.ok, id: data.id, error: data.message };
  } catch (e) {
    return { channel: "email", to, ok: false, error: e.message };
  }
}

exports.handler = async () => {
  if (!SERVICE_KEY) {
    console.error("[chase] SUPABASE_SERVICE_KEY not set — aborting");
    return { statusCode: 500, body: "SUPABASE_SERVICE_KEY not set" };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Overdue = has a due_date strictly before today AND not done.
  // Embed assignee (email/name) + client (name) in one round-trip.
  const q = `tasks?select=id,title,status,priority,due_date,assignee_id,assignee:team_members(name,email),client:clients(name)` +
            `&status=neq.done&due_date=lt.${today}&due_date=not.is.null&order=due_date.asc`;
  const res = await sb(q);
  if (!res.ok) {
    const txt = await res.text();
    console.error("[chase] task query failed:", res.status, txt.slice(0, 200));
    return { statusCode: 500, body: "task query failed" };
  }
  const overdue = await res.json();

  if (!Array.isArray(overdue) || overdue.length === 0) {
    console.log("[chase] no overdue tasks");
    return { statusCode: 200, body: "no overdue tasks" };
  }

  const results = [];

  // ── In-app notifications (bell) — one row per task/day, deduped by the
  //    (type, content_item_id) unique index. Best-effort. ──
  for (const t of overdue) {
    const assignee = t.assignee?.name || "Unassigned";
    await sb("notifications", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        type: "task_overdue",
        content_item_id: `task:${t.id}:${today}`, // dedupe key: once per task per day
        recipient_email: null,                     // broadcast to admins
        payload: {
          item: { id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, assignee, client: t.client?.name || null },
          message: `⏰ Overdue: "${t.title}" — ${daysOverdue(t.due_date)}d past due (${assignee})`,
        },
      }),
    }).catch((e) => console.warn("[chase] notification insert failed:", e.message));
  }

  // ── Per-assignee email digests ──
  const byAssignee = new Map();
  for (const t of overdue) {
    const email = t.assignee?.email;
    if (!email) continue;                  // no email on roster row → skip personal digest
    if (!byAssignee.has(email)) byAssignee.set(email, { name: t.assignee?.name || email, tasks: [] });
    byAssignee.get(email).tasks.push(t);
  }
  for (const [email, { name, tasks }] of byAssignee) {
    results.push(await sendEmail(email, `⏰ ${tasks.length} overdue task${tasks.length === 1 ? "" : "s"}`, tasks, `${name.split(" ")[0]}, you have ${tasks.length} item${tasks.length === 1 ? "" : "s"} past due`));
  }

  // ── Owner (Danny) gets the full board digest ──
  results.push(await sendEmail(OWNER_EMAIL, `⏰ ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} across the team`, overdue, `${overdue.length} task${overdue.length === 1 ? "" : "s"} past due`));

  // ── Slack summary ──
  if (SLACK) {
    const lines = overdue.slice(0, 20).map(t => `• *${t.title}* — ${daysOverdue(t.due_date)}d overdue${t.assignee?.name ? ` (${t.assignee.name})` : ""}${t.client?.name ? ` · ${t.client.name}` : ""}`).join("\n");
    try {
      const r = await fetch(SLACK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            { type: "header", text: { type: "plain_text", text: `⏰ ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}`, emoji: true } },
            { type: "section", text: { type: "mrkdwn", text: lines || "—" } },
            { type: "context", elements: [{ type: "mrkdwn", text: "Vantus Operations · daily chase" }] },
          ],
        }),
      });
      results.push({ channel: "slack", ok: r.ok });
    } catch (e) {
      results.push({ channel: "slack", ok: false, error: e.message });
    }
  }

  console.log(`[chase] ${overdue.length} overdue task(s) chased`, JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ ok: true, overdue: overdue.length, results }) };
};
