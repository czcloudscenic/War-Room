// verify-publishes.js — daily publish-verification sweep (Phase B, §3.B.1).
//
// The truth doctrine: nothing is "posted" without evidence. This cron closes
// two gaps the manual Mark-Posted button can't:
//
//   1. FLAG: items whose publish_date has passed while still Scheduled/Approved
//      and carrying no receipt → verification_status 'awaiting' + one bell
//      notification (deduped per item/day). CommandView surfaces them as
//      at-risk until a human records the live URL.
//   2. AUTO-VERIFY: items with a platform_post_id whose real post exists in
//      account_posts (the platform-sync mirror) → 'verified' with the
//      permalink as the receipt, verification_source 'account_posts'.
//      (platform_post_id has no writer yet — this is the ready-made join for
//      when the Sprout/platform wiring lands in Phase C.)
//
// Invocation gate (check-stuck-items shape): scheduled runs carry next_run;
// manual runs need ?test=1&key=<CRON_TEST_KEY>. test=1 alone is a DRY RUN.

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
  const dryRun = isTest && qs.fire !== "1";

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const results = { flagged: [], verified: [], notified: [] };

  // ── 1. FLAG past-due unverified items ──────────────────────────────────────
  // publish_date is a text column ('YYYY-MM-DD'); compare in JS to stay safe.
  const fRes = await sb(`content_items?select=id,title,client_id,status,publish_date&verification_status=eq.unverified&status=in.(${encodeURIComponent('"Scheduled","Approved"')})&publish_date=not.is.null`);
  const candidates = fRes.ok ? await fRes.json() : [];
  for (const item of candidates) {
    const pd = String(item.publish_date || "").slice(0, 10);
    if (!pd || pd > today) continue;
    results.flagged.push(`${item.title} (planned ${pd})`);
    if (dryRun) continue;

    await sb(`content_items?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH", body: JSON.stringify({ verification_status: "awaiting" }),
    }).catch(() => {});

    const nRes = await sb("notifications", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        type: "publish_unverified",
        content_item_id: String(item.id),
        dedupe_key: `publish_unverified:${item.id}:${today}`,
        client_id: item.client_id || null,
        recipient_email: null,
        payload: { item: { id: item.id, title: item.title, publish_date: pd }, message: `"${item.title}" was planned for ${pd} but has no publish receipt — confirm it went out and record the live URL.` },
      }),
    }).catch(() => null);
    if (nRes?.ok) results.notified.push(item.id);
  }

  // ── 2. AUTO-VERIFY via the platform mirror ─────────────────────────────────
  const vRes = await sb(`content_items?select=id,title,client_id,platform_post_id&platform_post_id=not.is.null&verification_status=in.(${encodeURIComponent('"unverified","awaiting"')})`);
  const linkable = vRes.ok ? await vRes.json() : [];
  for (const item of linkable) {
    const pRes = await sb(`account_posts?platform_post_id=eq.${encodeURIComponent(item.platform_post_id)}&select=permalink,posted_at&limit=1`);
    const post = pRes.ok ? (await pRes.json())?.[0] : null;
    if (!post) continue;
    results.verified.push(item.title);
    if (dryRun) continue;
    await sb(`content_items?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        verification_status: "verified",
        verification_source: "account_posts",
        live_url: post.permalink || null,
        verified_at: new Date(now).toISOString(),
        posted_at: post.posted_at || new Date(now).toISOString(),
        status: "Posted", stage: "Posted",
      }),
    }).catch(() => {});
    // Receipt in the generalized audit trail (service key bypasses RLS).
    await sb("audit_log", {
      method: "POST",
      body: JSON.stringify({
        entity_type: "content_item", entity_id: String(item.id), client_id: item.client_id || null,
        field: "verification_status", old_value: "awaiting", new_value: "verified",
        actor_kind: "system", reason: `matched account_posts ${item.platform_post_id}${post.permalink ? ` — ${post.permalink}` : ""}`,
      }),
    }).catch(() => {});
  }

  console.log(`[verify-publishes] flagged ${results.flagged.length}, auto-verified ${results.verified.length}`, JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ ok: true, dryRun, ...results }) };
};
