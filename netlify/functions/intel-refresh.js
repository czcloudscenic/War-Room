// intel-refresh.js — nightly deterministic refresh of content_analysis rates
// for every client with a connected Instagram account. NO AI calls (the
// winners/losers read stays on-demand via agent-action intel_score_content),
// so this costs nothing but a few Supabase round-trips.
//
// Invocation gate (check-stuck-items shape): scheduled runs carry next_run;
// manual runs need ?test=1&key=<CRON_TEST_KEY>. test=1 alone is a DRY RUN
// (computes and reports, writes nothing).

const { readMetrics, computeRates, loadClientPosts } = require("./agent-action/handlers/intel");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const TEST_KEY     = process.env.CRON_TEST_KEY || "";

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
  const dryRun = isTest;

  const aRes = await sb(`connected_accounts?select=client_id,platform`);
  const accounts = aRes.ok ? await aRes.json() : [];
  const clientIds = [...new Set(
    accounts
      .filter(a => String(a.platform || "").toLowerCase().includes("instagram"))
      .map(a => a.client_id)
      .filter(Boolean)
  )];

  const results = [];
  for (const client_id of clientIds) {
    const posts = await loadClientPosts(client_id, 30);
    const rows = posts.map(p => {
      const n = readMetrics(p);
      const r = computeRates(n, null); // hook_hold needs a video length; null-safe
      return {
        client_id,
        account_post_id: p.id,
        views: n.views,
        reach: n.reach,
        send_rate: r.send_rate,
        save_rate: r.save_rate,
        follow_rate: r.follow_rate,
        hook_hold: r.hook_hold,
        computed_at: new Date().toISOString(),
      };
    });
    if (rows.length && !dryRun) {
      await sb("content_analysis?on_conflict=client_id,account_post_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      }).catch(e => console.warn("[intel-refresh] upsert failed:", e.message));
    }
    results.push({ client_id, posts: rows.length });
  }

  console.log(`[intel-refresh] ${clientIds.length} clients, dryRun=${dryRun}`, JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ ok: true, dryRun, clients: clientIds.length, results }) };
};
