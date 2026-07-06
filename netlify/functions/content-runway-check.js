// content-runway-check.js — the "never get blindsided by an empty queue" cron.
//
// Why: Dynasty ran out of content with zero warning (2026-07). This watches
// every tracked client's content runway daily and closes the loop end-to-end:
//
//   1. MEASURE  — Sprout scheduled queue end-date (hard signal, when mapped) or
//                 pipeline inventory ÷ burn (content_items model) as fallback.
//                 Math lives in src/utils/runway.mjs — the SAME module the UI
//                 uses, so the dashboard and this cron can never disagree.
//   2. ALERT    — Slack #content card (CONTENT_SLACK_WEBHOOK_URL) + one summary
//                 email (Resend) to the content team. Re-fire: warning 3d,
//                 critical/empty daily (runway_alert_state bookkeeping).
//   3. ACT      — auto-creates a "Book shoot: {client}" tasks row (source
//                 'ai_ops', due = book-by date). The existing chase-overdue-tasks
//                 cron then escalates it for free if ignored.
//   4. CLEAR    — queue extends → alert state clears + the open book-shoot task
//                 auto-completes. Unlogged shoots fire a false alarm on purpose
//                 (fails loud, forces the log) — never suppress on staleness.
//
// Monday adds the full digest: every tracked client green/yellow/red, sent even
// when all green (silence must never be ambiguous), unconfigured clients flagged.
//
// Server-side with SUPABASE_SERVICE_KEY, modeled on send-monthly-reports.js.
// Manual test: GET /.netlify/functions/content-runway-check?test=1&key=<CRON_TEST_KEY>
//   → dry run, returns computed snapshots, writes/sends NOTHING.
//   &fire=1  → also sends Slack/email with a TEST banner (still writes no state).
//   &digest=1 → force the digest branch in the same test semantics.

const R = require("../../src/utils/runway.mjs"); // bundled by esbuild (netlify.toml)

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const SLACK        = process.env.CONTENT_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
const SPROUT_TOKEN = process.env.SPROUT_API_TOKEN;
const TEST_KEY     = process.env.CRON_TEST_KEY || "";
const ALERT_EMAILS = (process.env.RUNWAY_ALERT_EMAILS || "cz@cloudscenic.com,ss@cloudscenic.com,dv@cloudscenic.com")
  .split(",").map(s => s.trim()).filter(Boolean);

const SEV_META = {
  warning:  { emoji: "🟡", color: "#ff9f0a", label: "Content low" },
  critical: { emoji: "🔴", color: "#ff453a", label: "Content critical" },
  empty:    { emoji: "⛔", color: "#ff453a", label: "OUT OF CONTENT" },
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

async function slackPost(payload) {
  if (!SLACK) return;
  try { await fetch(SLACK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); } catch {}
}

// ── Sprout Social (graceful: any failure → nulls → content_items model) ───────
// Verified against the live token 2026-07-06: v1 API, customer 2001000.
// analytics/posts WORKS (sent posts incl. Stories → measured burn).
// The scheduled queue is NOT exposed by the public API (publishing/posts is a
// draft-CREATE endpoint only), so queueEndDate stays null and runway comes from
// pipeline inventory ÷ burn. Everything wrapped — Sprout down must never kill a run.
const SPROUT_BASE = "https://api.sproutsocial.com/v1";
let _sproutCustomerId = null;

async function sproutFetch(path, init = {}) {
  const res = await fetch(`${SPROUT_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SPROUT_TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`sprout ${path} ${res.status}`);
  return res.json();
}

async function sproutCustomerId() {
  if (_sproutCustomerId) return _sproutCustomerId;
  const data = await sproutFetch("/metadata/client");
  _sproutCustomerId = data?.data?.[0]?.customer_id;
  if (!_sproutCustomerId) throw new Error("sprout: no customer id");
  return _sproutCustomerId;
}

// Returns { queueEndDate, burnPerDay, lastPostAt, noPosts14d } for a client's
// profile ids, nulls on any gap. lastPostAt powers drought (deadzone) detection.
async function sproutSignals(profileIds, now) {
  const out = { queueEndDate: null, burnPerDay: null, lastPostAt: null, noPosts14d: false };
  if (!SPROUT_TOKEN || !Array.isArray(profileIds) || !profileIds.length) return out;
  try {
    const cid = await sproutCustomerId();
    const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);

    // Burn + last-post: sent posts, trailing 14 days, across the client's profiles.
    try {
      const sent = await sproutFetch(`/${cid}/analytics/posts`, {
        method: "POST",
        body: JSON.stringify({
          filters: [
            `customer_profile_id.eq(${profileIds.join(", ")})`,
            `created_time.in(${fmt(now - 14 * 86400000)}...${fmt(now + 86400000)})`,
          ],
          fields: ["created_time"],
          page: 1,
        }),
      });
      const times = (Array.isArray(sent?.data) ? sent.data : [])
        .map(p => Date.parse(p.created_time)).filter(t => !Number.isNaN(t));
      if (times.length > 0) {
        out.burnPerDay = times.length / 14;
        out.lastPostAt = new Date(Math.max(...times)).toISOString();
      } else {
        out.noPosts14d = true; // mapped profiles, dead silent for 14+ days
      }
    } catch (e) { console.log("[runway] sprout burn unavailable:", e.message); }

    // Scheduled queue: intentionally absent — Sprout's public API doesn't list
    // the publishing calendar (verified 2026-07-06; drafts-create only). If they
    // ever ship it, populate out.queueEndDate here and the rest of the system
    // (runway.mjs queue path, alert cards, digest) lights up unchanged.
  } catch (e) { console.log("[runway] sprout skipped:", e.message); }
  return out;
}

// ── delivery ──────────────────────────────────────────────────────────────────
function fmtDays(d) {
  if (d == null) return "—";
  return d < 10 ? `${Math.round(d * 10) / 10}d` : `${Math.round(d)}d`;
}

function fmtGap(d) {
  if (d == null) return null;
  return d < 1 ? "several times a day" : d < 1.5 ? "about daily" : `every ~${Math.round(d)} days`;
}

function alertBlocks(name, snap, testBanner) {
  const meta = SEV_META[snap.severity];
  const isDrought = snap.mode === "drought";
  const burnLabel = snap.burn.perDay != null
    ? `${Math.round(snap.burn.perDay * 10) / 10}/day (${snap.burn.source === "sprout" ? "Sprout measured" : snap.burn.source === "posted_at" ? "measured" : "cadence est."})`
    : "—";
  const sinceLabel = snap.drought?.daysSincePost != null
    ? `${snap.drought.floor ? "14+" : Math.round(snap.drought.daysSincePost * 10) / 10} days ago`
    : "unknown";

  const fields = isDrought
    ? [
        { type: "mrkdwn", text: `*Posting stopped:*\nlast post ${sinceLabel}` },
        { type: "mrkdwn", text: `*Normal rhythm:*\n${fmtGap(snap.drought?.expectedGapDays) || "no baseline"}` },
        { type: "mrkdwn", text: `*Burn:*\n${burnLabel}` },
        { type: "mrkdwn", text: `*Book a shoot:*\nNOW — content is dead` },
      ]
    : [
        { type: "mrkdwn", text: `*Runway:*\n${fmtDays(snap.runwayDays)}${snap.queueEndDate ? ` (queue dies ${snap.queueEndDate.slice(0, 10)})` : ""}` },
        { type: "mrkdwn", text: `*Book a shoot by:*\n${snap.bookBy || "NOW"}` },
        { type: "mrkdwn", text: `*Burn:*\n${burnLabel}` },
        { type: "mrkdwn", text: `*Pipeline buffer:*\n${snap.inventory.ready} ready + ${snap.inventory.production} in production` },
      ];

  const headline = isDrought
    ? `${meta.emoji} ${name} stopped posting — last post ${sinceLabel}${testBanner ? " [TEST]" : ""}`
    : `${meta.emoji} ${meta.label} — ${name}: ${fmtDays(snap.runwayDays)} left, book by ${snap.bookBy || "NOW"}${testBanner ? " [TEST]" : ""}`;

  return {
    // top-level text = Slack's notification/preview line (attachment-only
    // messages preview as empty — the "Pre view empty" bug)
    text: headline,
    attachments: [{
      color: meta.color,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `${meta.emoji} ${isDrought ? "POSTING STOPPED" : meta.label} — ${name}${testBanner ? " [TEST]" : ""}`, emoji: true } },
        { type: "section", fields },
        { type: "context", elements: [{ type: "mrkdwn", text: `Last shoot: ${snap.lastShoot || "none logged"} · lead time ${snap.leadTimeDays}d · Vantus content runway` }] },
      ],
    }],
  };
}

async function sendAlertEmail(fired, testBanner) {
  if (!RESEND_KEY || !fired.length) return;
  const rows = fired.map(({ name, snap }) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.06);font-weight:600;">${SEV_META[snap.severity].emoji} ${esc(name)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.06);">${fmtDays(snap.runwayDays)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.06);font-weight:600;color:#b45309;">${esc(snap.bookBy || "NOW")}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.06);">${snap.inventory.ready} ready / ${snap.inventory.production} in prod</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2e1a0a,#4a2a0d);padding:28px 32px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Vantus · Content Runway</div>
      <div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px;">⏳ ${fired.length} client${fired.length > 1 ? "s" : ""} running low on content</div>
    </div>
    <div style="padding:20px 18px 28px;">
      ${testBanner ? `<div style="margin:0 0 14px;padding:12px 16px;background:#fff8e6;border-left:3px solid #ff9f0a;border-radius:6px;font-size:12px;color:#8a5a00;">TEST RUN — no state was written.</div>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1d1d1f;">
        <tr style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(0,0,0,0.4);">
          <th style="padding:6px 14px;">Client</th><th style="padding:6px 14px;">Runway</th><th style="padding:6px 14px;">Book by</th><th style="padding:6px 14px;">Pipeline</th>
        </tr>
        ${rows}
      </table>
      <p style="font-size:12px;color:rgba(0,0,0,0.45);margin:18px 14px 0;">A “Book shoot” task was created in Vantus for each. Log shoots in Vantus → Content Runway the moment they’re booked.</p>
    </div>
  </div>
</body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Vantus <notifications@cloudscenic.com>",
        to: ALERT_EMAILS,
        subject: `⏳ Content runway: ${fired.map(f => f.name).join(", ")}`,
        html,
      }),
    });
  } catch (e) { console.log("[runway] alert email failed:", e.message); }
}

const DIGEST_META = {
  monday: { emoji: "📆", title: "Monday content runway digest", footerAllGreen: "All clients green. Nothing needs booking this week.", footer: "Book-by dates above are the last responsible day to schedule a shoot." },
  friday: { emoji: "🔔", title: "Friday runway check — in case we missed it", footerAllGreen: "All clear going into the weekend.", footer: "Anything red/yellow above survived the week unhandled — deal with it before Monday." },
};

async function sendDigest(snapshots, isTest, variant = "monday") {
  const rank = { empty: 0, critical: 1, warning: 2 };
  const sorted = [...snapshots].sort((a, b) => {
    const ra = a.snap.severity ? rank[a.snap.severity] : (a.snap.configured ? 3 : 4);
    const rb = b.snap.severity ? rank[b.snap.severity] : (b.snap.configured ? 3 : 4);
    return ra - rb || (a.snap.runwayDays ?? 1e9) - (b.snap.runwayDays ?? 1e9);
  });
  const lines = sorted.map(({ name, snap }) => {
    if (snap.mode === "drought") {
      const since = snap.drought?.floor ? "14+" : Math.round(snap.drought?.daysSincePost ?? 0);
      return `🔴 *${name}* — posting STOPPED (last post ${since}d ago) · no inventory logged · book a shoot NOW`;
    }
    if (!snap.configured) return `⚪ *${name}* — untracked (log a shoot or set posts/week to start runway math)`;
    const dot = snap.severity === "empty" || snap.severity === "critical" ? "🔴" : snap.severity === "warning" ? "🟡" : "🟢";
    return `${dot} *${name}* — ${fmtDays(snap.runwayDays)} runway · ${snap.inventory.ready} ready / ${snap.inventory.production} in prod · burn ${snap.burn.perDay != null ? (Math.round(snap.burn.perDay * 10) / 10) + "/day" : "—"}${snap.severity ? ` · *book by ${snap.bookBy}*` : ""}`;
  });
  const allGreen = sorted.every(s => !s.snap.severity && s.snap.configured);
  const meta = DIGEST_META[variant] || DIGEST_META.monday;
  const title = `${meta.emoji} ${meta.title}${isTest ? " [TEST]" : ""}`;
  await slackPost({
    text: title,
    attachments: [{
      color: allGreen ? "#30d158" : "#ff9f0a",
      blocks: [
        { type: "header", text: { type: "plain_text", text: title, emoji: true } },
        { type: "section", text: { type: "mrkdwn", text: lines.join("\n") || "_no tracked clients_" } },
        { type: "context", elements: [{ type: "mrkdwn", text: allGreen ? meta.footerAllGreen : meta.footer }] },
      ],
    }],
  });
}

// ── the run ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (!SERVICE_KEY) return { statusCode: 500, body: "SUPABASE_SERVICE_KEY not set" };

  const qs = event?.queryStringParameters || {};
  let scheduled = false;
  try { scheduled = !!JSON.parse(event?.body || "{}").next_run; } catch {}
  const isTest = qs.test === "1";
  if (!scheduled && !isTest) return { statusCode: 403, body: "scheduled invocations only (use ?test=1&key=...)" };
  if (isTest && TEST_KEY && qs.key !== TEST_KEY) return { statusCode: 403, body: "bad test key" };
  const testFire = isTest && qs.fire === "1";

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  // Two weekly touchpoints (cron fires 15:00 UTC = same calendar day in PT):
  // Monday = the update, Friday = the "in case we missed it" pass.
  const utcDow = new Date(now).getUTCDay();
  const digestVariant = utcDow === 1 ? "monday" : utcDow === 5 ? "friday" : null;

  // Tracked clients + their items + alert state, three reads.
  const cRes = await sb(`clients?select=id,name,slug,posts_per_week,shoot_lead_time_days,content_tracking_enabled,sprout_profile_ids,n8n_webhook_url&status=eq.active&content_tracking_enabled=is.true`);
  const clients = cRes.ok ? await cRes.json() : [];
  if (!clients.length) return { statusCode: 200, body: JSON.stringify({ tracked: 0 }) };

  const ids = clients.map(c => c.id).join(",");
  const iRes = await sb(`content_items?select=id,client_id,status,posted_at,campaign&client_id=in.(${ids})`);
  const items = iRes.ok ? await iRes.json() : [];
  const sRes = await sb(`runway_alert_state?client_id=in.(${ids})`);
  const states = new Map((sRes.ok ? await sRes.json() : []).map(s => [s.client_id, s]));

  const snapshots = [];
  const fired = [];
  const results = { fired: [], cleared: [], tasksCreated: [], tasksCompleted: [] };

  for (const c of clients) {
    const own = items.filter(i => i.client_id === c.id);
    const sprout = await sproutSignals(c.sprout_profile_ids, now);
    const snap = R.clientRunway(c, own, { now, sproutQueueEndDate: sprout.queueEndDate, sproutBurnPerDay: sprout.burnPerDay });
    snapshots.push({ name: c.name, client: c, snap });

    const state = states.get(c.id);
    const prevSeverity = state?.severity || null;

    // CLEAR: recovered (or newly green) — close the loop.
    if (!snap.severity) {
      if (prevSeverity && !isTest) {
        await sb(`runway_alert_state?client_id=eq.${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ severity: null, cleared_at: new Date(now).toISOString(), last_snapshot: snapshotJson(snap), updated_at: new Date(now).toISOString() }),
        });
        // auto-complete the open book-shoot task
        const tRes = await sb(`tasks?client_id=eq.${c.id}&source=eq.ai_ops&status=neq.done&reason=like.runway*&select=id`);
        for (const t of (tRes.ok ? await tRes.json() : [])) {
          await sb(`tasks?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ status: "done", updated_at: new Date(now).toISOString() }) });
          results.tasksCompleted.push(c.name);
        }
        await slackPost({ text: `🟢 *${c.name}* content runway recovered — ${fmtDays(snap.runwayDays)} of queue. Book-shoot task auto-completed.` });
        results.cleared.push(c.name);
      }
      continue;
    }

    // FIRE: escalation always fires; same severity respects re-fire cadence.
    const escalated = snap.severity !== prevSeverity;
    if (!escalated && !R.refireDue(snap.severity, state?.last_alert_at, now)) continue;

    fired.push({ name: c.name, snap });
    results.fired.push(`${c.name}:${snap.severity}`);
    if (isTest && !testFire) continue; // dry run: report only

    await slackPost(alertBlocks(c.name, snap, isTest));

    if (!isTest) {
      // bell notification (dedupe: once per client per severity per day)
      await sb("notifications", {
        method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          type: `runway_${snap.severity === "warning" ? "low" : snap.severity}`,
          content_item_id: `runway:${c.id}`,
          client_id: c.id,
          recipient_email: null,
          dedupe_key: `runway_${snap.severity}:${c.id}:${today}`,
          payload: { item: { id: c.id }, message: `${SEV_META[snap.severity].emoji} ${c.name}: ${fmtDays(snap.runwayDays)} of content left — book a shoot by ${snap.bookBy || "NOW"}.` },
        }),
      }).catch(() => {});

      // alert state upsert
      await sb(`runway_alert_state?on_conflict=client_id`, {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          client_id: c.id, severity: snap.severity,
          last_alert_at: new Date(now).toISOString(), cleared_at: null,
          last_snapshot: snapshotJson(snap), updated_at: new Date(now).toISOString(),
        }),
      });

      // ACT: ensure exactly one open book-shoot task per client
      const tRes = await sb(`tasks?client_id=eq.${c.id}&source=eq.ai_ops&status=neq.done&reason=like.runway*&select=id&limit=1`);
      const open = tRes.ok ? await tRes.json() : [];
      if (!open.length) {
        const sinceLabel = snap.drought?.daysSincePost != null
          ? `${snap.drought.floor ? "14+" : Math.round(snap.drought.daysSincePost)}d since last post`
          : null;
        const desc = snap.mode === "drought"
          ? `Posting has STOPPED (${sinceLabel}; normal rhythm ${snap.burn.perDay != null ? Math.round(snap.burn.perDay * 10) / 10 + "/day" : "unknown"}). No inventory logged in Vantus — book a shoot and log it via Content Runway → Log shoot. Auto-created by content-runway-check; completes itself when posting resumes or inventory lands.`
          : `Content runway ${fmtDays(snap.runwayDays)} (${snap.severity}). Pipeline buffer: ${snap.inventory.ready} ready + ${snap.inventory.production} in production. Auto-created by content-runway-check; completes itself when the queue extends.`;
        await sb("tasks", {
          method: "POST",
          body: JSON.stringify({
            title: `Book shoot: ${c.name}`,
            description: desc,
            status: "backlog",
            priority: snap.severity === "warning" ? "high" : "urgent",
            client_id: c.id,
            due_date: snap.bookBy || today,
            source: "ai_ops",
            reason: snap.mode === "drought"
              ? `runway drought: ${sinceLabel || "posting stopped"}`
              : `runway ${snap.severity}: ${fmtDays(snap.runwayDays)} left, lead time ${snap.leadTimeDays}d`,
          }),
        });
        results.tasksCreated.push(c.name);
      }

      // optional n8n subscriber (out of critical path, fire-and-forget)
      if (c.n8n_webhook_url) {
        fetch(c.n8n_webhook_url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "runway_alert", client: c.name, ...snapshotJson(snap) }),
        }).catch(() => {});
      }
    }
  }

  if (fired.length && (!isTest || testFire)) await sendAlertEmail(fired, isTest);
  if ((digestVariant && !isTest) || qs.digest === "1") {
    await sendDigest(snapshots, isTest, qs.digest === "1" ? (qs.variant || "monday") : digestVariant);
  }

  const body = { tracked: clients.length, ...results };
  if (isTest) body.snapshots = snapshots.map(({ name, snap }) => ({ name, ...snapshotJson(snap) }));
  console.log("[runway]", JSON.stringify({ tracked: clients.length, ...results }));
  return { statusCode: 200, body: JSON.stringify(body) };
};

function snapshotJson(snap) {
  return {
    mode: snap.mode,
    runway_days: snap.runwayDays != null ? Math.round(snap.runwayDays * 10) / 10 : null,
    queue_end_date: snap.queueEndDate ? String(snap.queueEndDate).slice(0, 10) : null,
    inventory_ready: snap.inventory.ready,
    inventory_production: snap.inventory.production,
    burn_per_day: snap.burn.perDay != null ? Math.round(snap.burn.perDay * 100) / 100 : null,
    burn_source: snap.burn.source,
    severity: snap.severity,
    book_by: snap.bookBy,
    days_since_post: snap.drought?.daysSincePost != null ? Math.round(snap.drought.daysSincePost * 10) / 10 : null,
    posting_stalled: !!snap.drought?.stalled,
  };
}
