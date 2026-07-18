const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
// Production: https://cloudscenic.app.n8n.cloud/webhook/11138e92-248c-4562-be17-5e07b9da928c
// Test:       https://cloudscenic.app.n8n.cloud/webhook-test/11138e92-248c-4562-be17-5e07b9da928c

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const SLACK_AGENT_LABELS = {
  qc_review:              "🛡️ *QC* — Deliverable Review",
  sean_briefing:          "📋 *Sean* — Morning Briefing",
  muse_generate_calendar: "✍️ *Muse* — Content Calendar",
  muse_save_calendar:     "✍️ *Muse* — Calendar Saved",
  muse_write_content:     "✍️ *Muse* — Content Written",
  scrappy_research:       "📡 *Scrappy* — Trend Research",
  scrappy_muse_collab:    "📡 *Scrappy* × *Muse* — Collab",
  muse_ig_ideas:          "✍️ *Muse* — 5 Instagram Ideas",
};

const SB_HEADERS = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

// ── agent_events logging ──
// Every handler invocation writes one row so we have real history of what
// agents actually did (replaces fake ACTIVITY_POOL theater).
const AGENT_PREFIX_MAP = {
  muse: "Muse", sean: "Sean",
  scrappy: "Scrappy",
  cid: "Scrappy",  // CID actions are Scrappy's domain
  qc: "QC",
};
function deriveAgentName(actionKey) {
  const prefix = (actionKey || "").split("_")[0];
  return AGENT_PREFIX_MAP[prefix] || "Unknown";
}
function deriveContentItemId(payload, result) {
  return (
    payload?.id ||
    payload?.itemId ||
    payload?.contentItemId ||
    result?.id ||
    result?.item?.id ||
    null
  );
}
function deriveSummary(result, action) {
  if (!result) return `${action} returned no result`;
  const s = result.message || result.summary || result.briefing || result.report || result.trends || `${action} completed`;
  return String(s).slice(0, 500);
}
async function logAgentEvent({ agent_name, action_key, payload, result_status, result_summary, content_item_id, client_id }) {
  try {
    await fetch(`${REST}/agent_events`, {
      method: "POST",
      headers: SB_HEADERS(),
      body: JSON.stringify({
        agent_name,
        action_key,
        content_item_id,
        client_id,
        payload,
        result_status,
        result_summary,
      }),
    });
  } catch (e) {
    console.warn("[agent_events] log failed:", e.message);
  }
}

const REST = `${SUPABASE_URL}/rest/v1`;

async function sbGet(table, params = "") {
  const res = await fetch(`${REST}/${table}${params}`, { headers: SB_HEADERS() });
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Move 1 — read client's brand voice from DB instead of hardcoding it inline.
// Falls back to a generic context if client_id is missing or brand_voice_md is empty,
// so prompts still work for orphaned requests (e.g. before a client is selected).
//
// Pillars are parsed from brand_voice_md if present (look for a "Pillars:" line or
// a "## Pillars" / "### Pillars" markdown block). Otherwise empty — handlers
// instruct Claude to derive them from the voice text directly.
function parsePillars(voiceMd) {
  if (!voiceMd) return [];
  // 1) Try "Pillars: a, b, c" or "Content pillars: a, b, c" inline form
  const inline = voiceMd.match(/(?:content\s+)?pillars?:\s*([^\n]+)/i);
  if (inline) {
    return inline[1].split(/[,|·•]/).map(s => s.trim()).filter(Boolean).slice(0, 12);
  }
  // 2) Try "## Pillars" or "### Pillars" block — collect bullets until next header
  const block = voiceMd.match(/#{2,3}\s*pillars?\s*\n([\s\S]*?)(?:\n#{1,3}|\n*$)/i);
  if (block) {
    return block[1].split("\n").map(line => line.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean).slice(0, 12);
  }
  return [];
}

async function getBrandContext(client_id) {
  const fallback = { name: "the brand", slug: null, voice: "", pillars: [], clientId: null };
  if (!client_id) return fallback;
  try {
    const rows = await sbGet("clients", `?id=eq.${client_id}&select=name,slug,brand_voice_md,brand_pillars,brand_dos,brand_donts`);
    const r = rows?.[0];
    if (!r) return { ...fallback, clientId: client_id };
    const voiceMd = r.brand_voice_md || "";
    // Prefer the structured Brand Manager fields; fall back to parsing the markdown.
    const pillars = (Array.isArray(r.brand_pillars) && r.brand_pillars.length) ? r.brand_pillars : parsePillars(voiceMd);
    const dos = Array.isArray(r.brand_dos) ? r.brand_dos : [];
    const donts = Array.isArray(r.brand_donts) ? r.brand_donts : [];
    // Compose structured guidelines so EVERY prompt that injects `voice` respects them.
    let guide = "";
    if (pillars.length) guide += `\nContent pillars: ${pillars.join(", ")}.`;
    if (dos.length) guide += `\nAlways: ${dos.join("; ")}.`;
    if (donts.length) guide += `\nNever: ${donts.join("; ")}.`;
    return {
      name: r.name || "the brand",
      slug: r.slug || null,
      voice: voiceMd + (guide ? `\n\nBrand guidelines:${guide}` : ""),
      pillars, dos, donts,
      clientId: client_id,
    };
  } catch (e) {
    console.warn("[brand] getBrandContext failed:", e.message);
    return { ...fallback, clientId: client_id };
  }
}

async function postToSlack(label, text) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${label}\n${text}` }),
    });
  } catch (e) {
    console.error("Slack post failed:", e.message);
  }
}

async function sbPatch(table, match, body) {
  const res = await fetch(`${REST}/${table}?${match}`, {
    method: "PATCH",
    headers: SB_HEADERS(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ai(system, user, maxTokens = 1200, model = "claude-haiku-4-5-20251001") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await res.json();
  if (!res.ok) {
    // Full diagnostic so the agent_events row tells us what's wrong
    throw new Error(`Anthropic ${res.status} ${d.error?.type || ""}: ${d.error?.message || JSON.stringify(d).slice(0, 300)}`);
  }
  return d.content?.[0]?.text || "";
}

// Like ai(), but the user turn is a content ARRAY (image blocks + text) so the
// model can see the actual deliverable. Used by the QC agent only.
async function aiVision(system, contentBlocks, maxTokens = 1600, model = "claude-sonnet-4-6") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: contentBlocks }],
    }),
  });
  const d = await res.json();
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status} ${d.error?.type || ""}: ${d.error?.message || JSON.stringify(d).slice(0, 300)}`);
  }
  return d.content?.[0]?.text || "";
}

// ─── QC AGENT ─────────────────────────────────────────────────────────────────
// The gate: nothing posts with a wrong price or the wrong hours. Hybrid design —
// deterministic code checks the hard facts (expired offers, price/phone strings),
// Claude vision judges legibility/brand/typos and extracts on-asset text for the
// code checks. Any 'blocker' issue → qc_status 'blocked' → scheduling stops.

// Deliverable files live on Google Drive as anyone-with-link. Pull the raw bytes
// so Claude can actually see the asset. Caps: 3 images, ~4.5MB each.
async function fetchDriveImage(file) {
  const id = file.driveId || ((file.url || "").match(/[-\w]{25,}/) || [])[0];
  if (!id) return null;
  try {
    const r = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, { redirect: "follow" });
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") || "").split(";")[0];
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4.5 * 1024 * 1024) return null;
    return { name: file.name, media_type: ct, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

// Deterministic factual checks — the part pure AI can miss ("9AM vs 10AM").
// Scans caption + CTA + Claude-extracted on-asset text against the Facts of Record.

module.exports = {
  SUPABASE_URL,
  SERVICE_KEY,
  ANTHROPIC_KEY,
  TAVILY_KEY,
  SLACK_WEBHOOK_URL,
  SLACK_AGENT_LABELS,
  SB_HEADERS,
  REST,
  deriveAgentName,
  deriveContentItemId,
  deriveSummary,
  logAgentEvent,
  sbGet,
  parsePillars,
  getBrandContext,
  postToSlack,
  sbPatch,
  ai,
  aiVision,
  fetchDriveImage,
};
