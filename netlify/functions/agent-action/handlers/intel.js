// handlers/intel.js — Content Intel: Studio Intel's analysis core, multi-tenant.
// Ported 2026-08-13 from the STUDIO-INTEL-TO-VANTUS guide (Studio sources:
// engine.mjs ideas mode, brief.js digest, metrics.js rate math, knowledge.js
// prompt scaffold). Studio's personal KNOWLEDGE block is replaced by the
// per-client brand context Vantus already carries (brand.voice from
// getBrandContext). Nothing here auto-posts, ever.
//
// Three actions:
//   intel_score_content   — deterministic rates -> content_analysis, then one
//                           AI winners/losers read (scrappy_analyze_performance
//                           precedent: digest in, JSON-only out, tolerant parse)
//   intel_generate_ideas  — 3-5 shoot-worthy ideas from live performance data
//                           + the taste loop (approved/killed prior ideas)
//   intel_set_idea_status — the approve/kill write for the taste loop

const { REST, SB_HEADERS, sbGet, ai } = require("../_shared");

// Tolerant JSON extraction (ported from Studio's anthropic.js).
function parseJSON(raw) {
  const cleaned = String(raw).replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

async function sbWrite(path, { method = "POST", body, headers = {} } = {}) {
  const res = await fetch(`${REST}/${path}`, {
    method,
    headers: { ...SB_HEADERS(), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`supabase ${method} ${path.split("?")[0]}: ${res.status} ${txt.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

// ── Metric math (ported from Studio's src/lib/metrics.js). Reads
// account_posts.metrics jsonb, tolerating Studio-style and Graph-API key names.
function readMetrics(post) {
  const m = (post && post.metrics) || {};
  const num = (v) => (v == null ? null : Number(v));
  const views = num(m.views ?? m.plays) || 0;
  const reach = num(m.reach) || 0;
  const saves = num(m.saves ?? m.saved) || 0;
  const shares = num(m.shares) || 0;
  // IG's DM "sends" was never calibrated as a distinct metric; Studio mapped
  // sends <- shares. Same documented fallback here.
  const sends = num(m.sends) ?? shares;
  // follows-from-post: IG's API does not reliably expose it (null on all 57
  // Studio posts even with full scopes). Stays null; do not request it.
  const follows = m.follows == null ? null : Number(m.follows);
  // ig_reels_avg_watch_time arrives in MILLISECONDS from the Graph API.
  const avg_watch_sec = m.avg_watch_sec != null
    ? Number(m.avg_watch_sec)
    : (m.ig_reels_avg_watch_time != null ? Number(m.ig_reels_avg_watch_time) / 1000 : null);
  const likes = num(m.likes) || 0;
  const comments = num(m.comments) || 0;
  return { views, reach, saves, shares, sends, follows, avg_watch_sec, likes, comments };
}

function computeRates(n, videoLengthSec) {
  return {
    send_rate: n.views ? n.sends / n.views : 0,
    save_rate: n.views ? n.saves / n.views : 0,
    follow_rate: (n.reach && n.follows != null) ? n.follows / n.reach : null,
    hook_hold: (videoLengthSec && n.avg_watch_sec != null) ? n.avg_watch_sec / videoLengthSec : null,
  };
}

// Video length: never populated in Studio either (its UI showed "-" for
// hook-hold). Look in raw jsonb in case the sync captured a duration; else null.
function videoLength(post) {
  const r = (post && post.raw) || {};
  const v = r.video_duration ?? r.duration ?? null;
  return v == null ? null : Number(v);
}

// Studio's seeded control-reel benchmarks: fallback when a client has no rows.
const DEFAULT_BENCH = { send_rate: 0.013, follow_rate: 0.0006, save_rate: 0.005 };

// ── Loaders (all scoped by client_id; Studio had one global IG account) ──
async function loadClientPosts(client_id, limit = 60) {
  const accounts = await sbGet("connected_accounts", `?client_id=eq.${client_id}&select=id,platform`);
  const igIds = (accounts || [])
    .filter(a => String(a.platform || "").toLowerCase().includes("instagram"))
    .map(a => a.id);
  if (!igIds.length) return [];
  const posts = await sbGet("account_posts", `?account_id=in.(${igIds.join(",")})&select=*&order=posted_at.desc&limit=${limit}`);
  return posts || [];
}

async function loadBenchmarks(client_id) {
  const rows = await sbGet("content_benchmarks", `?client_id=eq.${client_id}&select=key,value`);
  const bench = { ...DEFAULT_BENCH };
  for (const r of rows || []) if (r.value != null) bench[r.key] = Number(r.value);
  return bench;
}

const DEFAULT_PILLARS = [
  { key: "TOF", label: "Reach", desc: "Cold reach. Judged on views and shares." },
  { key: "MOF", label: "Trust", desc: "Proof, builds, teardowns. Judged on saves and watch time." },
  { key: "BOF", label: "Offer", desc: "Conversion posts. Judged on DM opens and joins." },
];
async function loadPillars(client_id) {
  const rows = await sbGet("clients", `?id=eq.${client_id}&select=content_pillars`);
  const p = rows && rows[0] && rows[0].content_pillars;
  return Array.isArray(p) && p.length ? p : DEFAULT_PILLARS;
}

// ── The performance brief (ported from Studio's brief.js, generalized:
// per-client benchmark rows instead of hardcoded prose; Studio's personal
// "KNOWN READS" narrative and comments section dropped — Vantus does not
// ingest comments yet). The taste loop survives: approved = more like this,
// rejected = never like this.
function buildBrief(posts, bench, priorIdeas) {
  const rows = posts.map(p => {
    const n = readMetrics(p);
    if (!n.views && !n.reach) return null;
    return {
      cap: (p.caption || "").replace(/\s+/g, " ").slice(0, 70),
      views: n.views,
      watch: n.avg_watch_sec != null ? n.avg_watch_sec.toFixed(1) : "?",
      share: n.views ? (n.shares / n.views * 100).toFixed(2) : "?",
      save: n.views ? (n.saves / n.views * 100).toFixed(2) : "?",
      date: String(p.posted_at || "").slice(0, 10),
    };
  }).filter(Boolean).sort((a, b) => b.views - a.views);

  const fmt = r => `- ${r.date} · ${r.views}v · watch ${r.watch}s · share ${r.share}% · save ${r.save}% · "${r.cap}"`;
  const liked = (priorIdeas || []).filter(i => i.status === "approved").slice(0, 20);
  const killed = (priorIdeas || []).filter(i => i.status === "rejected").slice(0, 30);

  return [
    `RECENT POSTS, top by views:`,
    ...rows.slice(0, 8).map(fmt),
    `\nBOTTOM (what's dying):`,
    ...rows.slice(-4).map(fmt),
    `\nBENCHMARK BARS: send-rate ${(bench.send_rate * 100).toFixed(2)}%/view · save-rate ${(bench.save_rate * 100).toFixed(2)}%/view · follow-rate ${(bench.follow_rate * 100).toFixed(3)}%/reach.`,
    ...(liked.length || killed.length ? [
      `\nTASTE (law: approved = more like this; killed = NEVER anything resembling these):`,
      ...liked.map(i => `+ APPROVED [${i.pillar || "?"}]: ${i.hook}`),
      ...killed.map(i => `- KILLED [${i.pillar || "?"}]: ${i.hook}`),
    ] : []),
  ].join("\n");
}

// ── Prompts. {brand.voice} replaces Studio's hardcoded personal KNOWLEDGE.
// VOICE_RULES survive as generic anti-slop defaults (good agency-wide law).
const VOICE_RULES = `HARD VOICE RULES (never violate):
- Operator, NOT guru. Never coach/mentor energy, never "here's how you can too", never income claims.
- BANNED: "X spots left", "DM me", "link in bio", engagement-bait, emoji-spam, "game-changer",
  "unlock", "let's dive in", "in today's fast-paced world". Authentic > polished. No em-dashes in captions.
- Money is shown on screen (real dashboards, real numbers the brand actually has), never claimed in a hook.
- Every idea must be rooted in a REAL system or REAL number from the brand context. Nothing invented.`;

function ideasSystem(brandVoice, pillars) {
  const pillarSpec = pillars.map(p => `"${p.key}" (${p.label}: ${p.desc})`).join(" | ");
  return `You are the idea engine for a short-form content account.

BRAND CONTEXT (who this account is; every idea must be rooted in real systems and real numbers found here):
${brandVoice || "(no brand context set for this client yet; produce only ideas grounded in the performance data)"}

${VOICE_RULES}

You will receive the account's live performance data. If a TASTE section is present, treat it as
law: APPROVED hooks show what actually gets shot, produce more in that vein; KILLED hooks show
what gets rejected, never produce anything resembling them.

SIGNAL RULE: performance data validates the FORMAT. If a bit or format reads as fatigued in the
data (falling watch time on reuse), do NOT rerun it; find a genuinely new opening angle or skip it.

QUALITY BAR, fewer but better: produce 3-5 ideas MAX, and only ideas you would bet a shoot on. An
idea qualifies only if it is (a) rooted in a real system/number from the brand context, (b) filmable
TODAY one-take with phone or screen, (c) not resembling anything KILLED, (d) not a fatigued rerun.
If only 3 clear the bar, return 3. Never pad. For each:
- hook: scroll-stopping first line / on-screen text (first 1-2s carry everything)
- pillar: ${pillarSpec}
- angle: one line on the take
- script: shot-ready 15-45s beats in the brand voice, real, specific
- signal: which data point this rides (short)
- fit_score: 0.0-1.0 vs what's currently performing
Aim for a spread across pillars, but quality beats the mix; never force a pillar.
Return ONLY JSON:
{"ideas":[{"hook":"","pillar":"","angle":"","script":"","signal":"","fit_score":0.0}]}`;
}

function scoreSystem(brandVoice, pillars, bench) {
  const pillarSpec = pillars.map(p => `"${p.key}" (${p.label}: ${p.desc})`).join(" | ");
  return `You are the performance analyst for a short-form content account.

BRAND CONTEXT:
${brandVoice || "(no brand context set for this client yet)"}

You will receive the account's recent posts with computed rates and benchmark bars
(send-rate bar ${(bench.send_rate * 100).toFixed(2)}%/view, save-rate bar ${(bench.save_rate * 100).toFixed(2)}%/view).
For EACH post: classify its funnel pillar (${pillarSpec}), call a verdict, and give one
specific line on why. Verdicts: "winner" = beats the bars or the account median on the
metric that matters for its pillar; "loser" = clearly below; "normal" = everything else.
Then write a 3-5 sentence summary: what is working, what is dying, the single next move.
Be specific, cite the numbers given, invent nothing.
Return ONLY JSON:
{"posts":[{"id":"","pillar":"","verdict":"","why":""}],"summary":""}`;
}

// ── ACTION: intel_generate_ideas — payload { client_id } ──
async function intel_generate_ideas(payload = {}, brand = {}) {
  const client_id = payload.client_id;
  if (!client_id) return { error: "client_id required" };

  const [posts, bench, pillars, priorIdeas] = await Promise.all([
    loadClientPosts(client_id),
    loadBenchmarks(client_id),
    loadPillars(client_id),
    sbGet("content_ideas", `?client_id=eq.${client_id}&select=hook,pillar,status&order=created_at.desc&limit=50`),
  ]);
  if (!posts.length) return { error: "no synced instagram posts for this client" };

  const brief = buildBrief(posts, bench, priorIdeas);
  const user = `LIVE ACCOUNT DATA:\n\n${brief}\n\nCONSTRAINTS: 3-5 ideas MAX (only what clears the quality bar, never pad). Keep each script tight (55 words of beats or fewer).`;
  const raw = await ai(ideasSystem(brand.voice, pillars), user, 2200);
  const out = parseJSON(raw) || {};
  const ideas = (Array.isArray(out.ideas) ? out.ideas : []).map(i => ({
    client_id,
    hook: String(i.hook || "").slice(0, 300),
    pillar: i.pillar || null,
    angle: i.angle || null,
    script: i.script || null,
    signal: i.signal || null,
    fit_score: Number(i.fit_score) || 0,
    status: "draft",
    source_context: { brief_head: brief.slice(0, 500) },
    model: null,
  }));
  if (ideas.length) {
    await sbWrite("content_ideas", { headers: { Prefer: "return=minimal" }, body: ideas });
  }
  return { inserted: ideas.length, ideas: out.ideas || [], summary: `${ideas.length} ideas drafted for ${brand.name || "client"}` };
}

// ── ACTION: intel_score_content — payload { client_id, limit? } ──
async function intel_score_content(payload = {}, brand = {}) {
  const client_id = payload.client_id;
  if (!client_id) return { error: "client_id required" };
  const limit = Math.min(Number(payload.limit) || 30, 60);

  const [posts, bench, pillars] = await Promise.all([
    loadClientPosts(client_id, limit),
    loadBenchmarks(client_id),
    loadPillars(client_id),
  ]);
  if (!posts.length) return { error: "no synced instagram posts for this client" };

  // 1. deterministic rates -> content_analysis (upsert on client_id + account_post_id)
  const scored = posts.map(p => {
    const n = readMetrics(p);
    const r = computeRates(n, videoLength(p));
    return { post: p, n, ...r };
  });
  await sbWrite("content_analysis?on_conflict=client_id,account_post_id", {
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: scored.map(s => ({
      client_id,
      account_post_id: s.post.id,
      views: s.n.views,
      reach: s.n.reach,
      send_rate: s.send_rate,
      save_rate: s.save_rate,
      follow_rate: s.follow_rate,
      hook_hold: s.hook_hold,
      computed_at: new Date().toISOString(),
    })),
  });

  // 2. AI read: winners/losers digest, one call
  const digest = scored
    .sort((a, b) => b.n.views - a.n.views)
    .map(s => `id=${s.post.id} · ${String(s.post.posted_at || "").slice(0, 10)} · ${s.n.views}v · send ${(s.send_rate * 100).toFixed(2)}% · save ${(s.save_rate * 100).toFixed(2)}% · watch ${s.n.avg_watch_sec != null ? s.n.avg_watch_sec.toFixed(1) + "s" : "?"} · "${(s.post.caption || "").replace(/\s+/g, " ").slice(0, 60)}"`)
    .join("\n");
  const raw = await ai(scoreSystem(brand.voice, pillars, bench), `POSTS:\n${digest}`, 1800);
  const out = parseJSON(raw) || { posts: [], summary: "" };
  const reads = Array.isArray(out.posts) ? out.posts : [];

  // 3. patch AI fields onto the matching rows
  const validPillars = new Set(pillars.map(p => p.key));
  for (const r of reads) {
    if (r.id == null) continue;
    await sbWrite(`content_analysis?client_id=eq.${client_id}&account_post_id=eq.${encodeURIComponent(r.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: {
        pillar: validPillars.has(r.pillar) ? r.pillar : null,
        ai_verdict: ["winner", "loser", "normal"].includes(r.verdict) ? r.verdict : null,
        ai_notes: r,
        model: null,
      },
    }).catch(e => console.warn("[intel] ai patch failed:", e.message));
  }

  return { scored: scored.length, ai_reads: reads.length, summary: out.summary || "" };
}

// ── ACTION: intel_set_idea_status — payload { id, status } (the taste loop) ──
async function intel_set_idea_status(payload = {}) {
  const { id, status } = payload;
  if (!id || !["draft", "approved", "rejected", "posted"].includes(status)) {
    return { error: "id and status (draft|approved|rejected|posted) required" };
  }
  await sbWrite(`content_ideas?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: { status, updated_at: new Date().toISOString() },
  });
  return { id, status, summary: `idea ${status}` };
}

module.exports = {
  intel_generate_ideas,
  intel_score_content,
  intel_set_idea_status,
  // pure helpers, reused by the intel-refresh cron
  readMetrics,
  computeRates,
  loadClientPosts,
};
