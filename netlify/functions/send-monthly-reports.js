// send-monthly-reports.js — the monthly client report, on autopilot.
//
// Semi-auto Sprout flow (by choice — no Sprout API dependency):
//   1. Someone drops the month's Sprout PDF into Setup → Monthly reports
//      (client_reports row + PDF in the private client-reports bucket).
//   2. This cron runs daily (schedule in netlify.toml). Any unsent report for a
//      COMPLETED month, for an active client with report_schedule='monthly_1st',
//      gets emailed to clients.primary_email with the PDF attached, then stamped
//      sent_at/sent_to. So "send on the 1st" in practice: sendable from the 1st,
//      sent the day the PDF exists.
//   3. Nag: from the 28th (and the first 5 days of the next month) it pings Slack
//      + the bell if the month's PDF hasn't been dropped yet.
//
// Server-side with SUPABASE_SERVICE_KEY (no user session), same as the chase cron.
// Idempotent: sent_at gates re-sends; nags dedupe per (client, day) via the
// notifications unique index.
//
// Manual test: GET /.netlify/functions/send-monthly-reports?test=1&key=<CRON_TEST_KEY>
// → emails the most recent report to the ops owner WITHOUT marking it sent.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const SLACK        = process.env.SLACK_WEBHOOK_URL;
const OWNER_EMAIL  = process.env.OPS_OWNER_EMAIL || "dv@cloudscenic.com";
const TEST_KEY     = process.env.CRON_TEST_KEY || "";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

function monthLabel(ym) {
  const d = new Date(ym + "-01T00:00:00Z");
  return Number.isNaN(d.getTime()) ? ym : d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

async function downloadPdf(pdf_path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/client-reports/${pdf_path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`storage download ${res.status}`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function emailReport({ to, clientName, month, pdfBase64, testBanner }) {
  const label = monthLabel(month);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0a1a2e,#0d2a4a);padding:32px 32px 28px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Cloud Scenic × ${esc(clientName)}</div>
      <div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:-1px;line-height:1.1;">📈 ${esc(label)} Report</div>
    </div>
    <div style="padding:28px 32px;">
      ${testBanner ? `<div style="margin:0 0 16px;padding:12px 16px;background:#fff8e6;border-left:3px solid #ff9f0a;border-radius:6px;font-size:12px;color:#8a5a00;">TEST SEND — the client did not receive this.</div>` : ""}
      <p style="font-size:14px;color:#1d1d1f;margin:0 0 14px;">Hi ${esc(clientName)} team,</p>
      <p style="font-size:14px;color:#1d1d1f;margin:0 0 14px;">Your ${esc(label)} performance report is attached — reach, engagement, and what we're doing next month.</p>
      <p style="font-size:14px;color:#1d1d1f;margin:0;">Questions? Just reply to this email.</p>
      <div style="margin-top:26px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.07);font-size:11px;color:rgba(0,0,0,0.35);">
        Cloud Scenic · monthly report · ${esc(label)}
      </div>
    </div>
  </div>
</body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Cloud Scenic <notifications@cloudscenic.com>",
      to: Array.isArray(to) ? to : [to],
      subject: `📈 ${clientName} — ${label} Report`,
      html,
      attachments: [{ filename: `${clientName} - ${label} Report.pdf`, content: pdfBase64 }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `resend ${res.status}`);
  return data.id;
}

async function slack(text) {
  if (!SLACK) return;
  try { await fetch(SLACK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }); } catch {}
}

exports.handler = async (event) => {
  if (!SERVICE_KEY) return { statusCode: 500, body: "SUPABASE_SERVICE_KEY not set" };
  if (!RESEND_KEY)  return { statusCode: 500, body: "RESEND_API_KEY not set" };

  const qs = event?.queryStringParameters || {};
  let scheduled = false;
  try { scheduled = !!JSON.parse(event?.body || "{}").next_run; } catch {}
  const isTest = qs.test === "1";

  // Only the Netlify scheduler runs the real pass; humans need the test key.
  if (!scheduled && !isTest) return { statusCode: 403, body: "scheduled invocations only (use ?test=1&key=...)" };
  if (isTest && TEST_KEY && qs.key !== TEST_KEY) return { statusCode: 403, body: "bad test key" };

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const utcDay = now.getUTCDate();

  // ── TEST MODE: send the newest report to the ops owner, mark nothing ────────
  if (isTest) {
    const r = await sb(`client_reports?select=*,client:clients(name,primary_email)&order=created_at.desc&limit=1`);
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) return { statusCode: 200, body: "test: no reports uploaded yet" };
    const rep = rows[0];
    try {
      const pdf = await downloadPdf(rep.pdf_path);
      const id = await emailReport({ to: OWNER_EMAIL, clientName: rep.client?.name || "Client", month: rep.month, pdfBase64: pdf, testBanner: true });
      return { statusCode: 200, body: `test send ok → ${OWNER_EMAIL} (resend ${id})` };
    } catch (e) {
      return { statusCode: 500, body: `test send failed: ${e.message}` };
    }
  }

  const results = { sent: [], failed: [], nagged: [] };

  // ── SEND PASS: unsent reports for completed months ───────────────────────────
  const q = `client_reports?select=*,client:clients(id,name,primary_email,status,report_schedule)` +
            `&sent_at=is.null&month=lt.${currentMonth}&order=month.asc`;
  const res = await sb(q);
  const pending = res.ok ? await res.json() : [];

  for (const rep of pending) {
    const c = rep.client;
    if (!c || c.status !== "active" || c.report_schedule !== "monthly_1st") continue;
    const to = c.primary_email || OWNER_EMAIL;   // no client email → deliver to the team, loudly
    try {
      const pdf = await downloadPdf(rep.pdf_path);
      await emailReport({ to, clientName: c.name, month: rep.month, pdfBase64: pdf, testBanner: false });
      const sent_at = new Date().toISOString();
      await sb(`client_reports?id=eq.${rep.id}`, { method: "PATCH", body: JSON.stringify({ sent_at, sent_to: to, send_error: null }) });
      await sb("notifications", {
        method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          type: "report_sent",
          content_item_id: `report:${rep.id}`,
          client_id: c.id,
          recipient_email: null,
          payload: { item: { id: rep.id, month: rep.month }, message: `📈 ${monthLabel(rep.month)} report sent to ${c.name} (${to})` },
        }),
      }).catch(() => {});
      await slack(`📈 *Monthly report sent* — ${c.name}, ${monthLabel(rep.month)} → ${to}${c.primary_email ? "" : " ⚠️ (no client email on file — went to the team)"}`);
      results.sent.push(`${c.name}:${rep.month}`);
    } catch (e) {
      await sb(`client_reports?id=eq.${rep.id}`, { method: "PATCH", body: JSON.stringify({ send_error: String(e.message).slice(0, 300) }) });
      await slack(`⛔ *Monthly report FAILED* — ${c.name}, ${rep.month}: ${e.message}`);
      results.failed.push(`${c.name}:${rep.month}:${e.message}`);
    }
  }

  // ── NAG PASS: month's PDF not dropped yet ────────────────────────────────────
  // From the 28th nag about the month that's ending; in the first 5 days of the
  // new month nag about the month that just ended (still unsendable without it).
  let nagMonth = null;
  if (utcDay >= 28) nagMonth = currentMonth;
  else if (utcDay <= 5) {
    const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    nagMonth = d.toISOString().slice(0, 7);
  }
  if (nagMonth) {
    const cRes = await sb(`clients?select=id,name&status=eq.active&report_schedule=eq.monthly_1st`);
    const clients = cRes.ok ? await cRes.json() : [];
    const rRes = await sb(`client_reports?select=client_id&month=eq.${nagMonth}`);
    const have = new Set((rRes.ok ? await rRes.json() : []).map(r => r.client_id));
    const today = now.toISOString().slice(0, 10);
    for (const c of clients) {
      if (have.has(c.id)) continue;
      await sb("notifications", {
        method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          type: "report_missing",
          content_item_id: `report-missing:${c.id}:${today}`,  // once per client per day
          client_id: c.id,
          recipient_email: null,
          payload: { item: { id: c.id, month: nagMonth }, message: `📄 ${c.name}'s ${monthLabel(nagMonth)} Sprout PDF isn't in Vantus yet — drop it in Setup → Monthly reports.` },
        }),
      }).catch(() => {});
      results.nagged.push(`${c.name}:${nagMonth}`);
    }
    if (results.nagged.length) {
      await slack(`📄 *Report PDFs missing* for ${monthLabel(nagMonth)}: ${results.nagged.map(s => s.split(":")[0]).join(", ")} — drop them in Setup → Monthly reports.`);
    }
  }

  console.log("[reports]", JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify(results) };
};
