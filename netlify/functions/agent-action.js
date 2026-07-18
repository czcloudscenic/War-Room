// agent-action.js — Vantus Agent Action Engine
// Handles autonomous agent actions: read/write Supabase, AI generation.
// Per-client brand voice loaded from clients.brand_voice_md at request time (Move 1).
//
// Requires a valid @cloudscenic.com admin OR approved client_users session
// (Authorization: Bearer <access_token>).

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

// 60/min is generous for normal Vantus usage (humans clicking agent action buttons
// rarely exceed ~5/min). The cap exists to bound per-user Anthropic spend if a
// token leaks or a client loops on errors.
const AGENT_ACTION_RATE_LIMIT_MAX = 60;
const AGENT_ACTION_RATE_LIMIT_WINDOW_MS = 60_000;


const {
  SERVICE_KEY,
  ANTHROPIC_KEY,
  SLACK_AGENT_LABELS,
  deriveAgentName,
  deriveContentItemId,
  deriveSummary,
  logAgentEvent,
  getBrandContext,
  postToSlack,
} = require("./agent-action/_shared");
const { qc_review } = require("./agent-action/handlers/qc");
const {
  muse_write_content,
  muse_generate_calendar,
  muse_save_calendar,
  muse_from_brief,
  muse_ig_ideas,
  muse_idea_list,
  muse_film_brief,
} = require("./agent-action/handlers/muse");
const {
  scrappy_research,
  scrappy_muse_collab,
  scrappy_hook_analysis,
  scrappy_analyze_performance,
} = require("./agent-action/handlers/scrappy");
const { sean_briefing } = require("./agent-action/handlers/sean");
const { cid_build_brief, cid_ab_variations } = require("./agent-action/handlers/cid");
const { ops_assign } = require("./agent-action/handlers/ops");

exports.handler = async (event) => {
  const cors = makeCors(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  const rl = rateLimit(`agent-action:${auth.user.id}`, AGENT_ACTION_RATE_LIMIT_MAX, AGENT_ACTION_RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);

  if (!SERVICE_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };
  }
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };
  }

  const { action, payload = {}, client_id = null } = JSON.parse(event.body || "{}");
  const actionStartedAt = Date.now();
  const agent_name = deriveAgentName(action);
  let brand = await getBrandContext(client_id);
  // Per-request voice override — replaces brand.voice for this one call without
  // touching clients.brand_voice_md. Useful for "try a punchier tone" runs.
  const voiceOverride = (payload.voiceOverride || "").trim();
  if (voiceOverride) brand = { ...brand, voice: voiceOverride };

  try {
    let result;
    switch (action) {
      case "qc_review":              result = await qc_review(payload, brand); break;
      case "muse_write_content":     result = await muse_write_content(payload, brand); break;
      case "sean_briefing":          result = await sean_briefing(brand); break;
      case "muse_from_brief":        result = await muse_from_brief(payload, brand); break;
      case "muse_generate_calendar": result = await muse_generate_calendar(brand); break;
      case "muse_save_calendar":     result = await muse_save_calendar(payload); break;
      case "scrappy_research":       result = await scrappy_research(payload, brand); break;
      case "scrappy_muse_collab":    result = await scrappy_muse_collab(payload, brand); break;
      case "scrappy_hook_analysis":  result = await scrappy_hook_analysis(brand); break;
      case "cid_build_brief":        result = await cid_build_brief(payload, brand); break;
      case "cid_ab_variations":      result = await cid_ab_variations(payload, brand); break;
      case "muse_ig_ideas":          result = await muse_ig_ideas(payload, brand); break;
      case "muse_idea_list":         result = await muse_idea_list(payload, brand); break;
      case "muse_film_brief":        result = await muse_film_brief(payload, brand); break;
      case "scrappy_analyze_performance": result = await scrappy_analyze_performance(payload, brand); break;
      case "ops_assign":             result = await ops_assign(payload); break;
      default:
        await logAgentEvent({
          agent_name: "Unknown",
          action_key: action,
          payload,
          result_status: "skipped",
          result_summary: `Unknown action: ${action}`,
          content_item_id: null,
          client_id,
        });
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }

    const eventLog = logAgentEvent({
      agent_name,
      action_key: action,
      payload,
      result_status: "success",
      result_summary: deriveSummary(result, action),
      content_item_id: deriveContentItemId(payload, result),
      client_id,
    });

    const slackLabel = SLACK_AGENT_LABELS[action];
    const slackPost = (slackLabel && result) ? (async () => {
      const msg = result.message || result.summary || result.briefing || result.report || result.trends || `✅ ${action} completed`;
      await postToSlack(slackLabel, msg);
    })() : Promise.resolve();

    await Promise.all([eventLog, slackPost]);
    console.log(`[agent-action] ${action} completed in ${Date.now() - actionStartedAt}ms`);

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("agent-action error:", err);
    await logAgentEvent({
      agent_name,
      action_key: action,
      payload,
      result_status: "error",
      result_summary: String(err.message).slice(0, 500),
      content_item_id: deriveContentItemId(payload, null),
      client_id,
    });
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
