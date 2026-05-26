// Master Control — Anthropic proxy
// Receives agent chat messages from the Vantus frontend
// and forwards them to Anthropic securely server-side.
//
// Requires a valid @cloudscenic.com Supabase session (Authorization: Bearer <access_token>).

const { requireUser, unauthorized, cors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

// /api/chat hits the Anthropic API on every call → caps the per-user blast radius
// if a token leaks or an automated client misbehaves. 30 req/min is generous for
// human chat use; the cap exists for budget protection, not normal-use throttling.
const CHAT_RATE_LIMIT_MAX = 30;
const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;

exports.handler = async (event) => {
  const corsHeaders = cors(event);
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  // Rate limit per authenticated user.id
  const rl = rateLimit(`chat:${auth.user.id}`, CHAT_RATE_LIMIT_MAX, CHAT_RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, corsHeaders);

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
