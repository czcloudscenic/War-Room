// setup.js — ONE-TIME setup function
// Creates admin users + profiles rows in Supabase
// DELETE THIS FILE after running once!
//
// Usage: POST https://majestic-cassata-aa16e9.netlify.app/api/setup
//        with body: { "key": "warroom-setup-2026" }

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const SETUP_KEY    = "warroom-setup-2026"; // one-time auth token
const SETUP_PASSWORD = "Cloudai25%";

const ADMIN_EMAILS = [
  "cz@cloudscenic.com",
  "dv@cloudscenic.com",
  "ss@cloudscenic.com",
];

const headers = {
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "apikey": SERVICE_KEY,
  "Content-Type": "application/json",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

async function createUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password: SETUP_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "admin" },
    }),
  });
  const data = await res.json();
  return data;
}

async function upsertProfile(userId, email) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      ...headers,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id: userId, role: "admin", email }),
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  if (!SERVICE_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: cors, body: "Bad JSON" }; }

  if (body.key !== SETUP_KEY) {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Invalid setup key" }) };
  }

  const results = [];

  for (const email of ADMIN_EMAILS) {
    try {
      // Create user
      const user = await createUser(email);
      if (user.error) {
        // User may already exist — try to find them
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
        const listData = await listRes.json();
        const existing = listData.users?.find(u => u.email === email);
        if (existing) {
          await upsertProfile(existing.id, email);
          results.push({ email, status: "existing user — profile updated", id: existing.id });
        } else {
          results.push({ email, status: "failed", error: user.error.message || user.error });
        }
      } else {
        // New user created — insert profile
        const userId = user.id || user.user?.id;
        if (userId) {
          await upsertProfile(userId, email);
          results.push({ email, status: "created", id: userId });
        } else {
          results.push({ email, status: "created but no ID returned", raw: user });
        }
      }
    } catch (e) {
      results.push({ email, status: "error", error: e.message });
    }
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({
      ok: true,
      message: "Setup complete — DELETE this function file now!",
      results,
    }),
  };
};
