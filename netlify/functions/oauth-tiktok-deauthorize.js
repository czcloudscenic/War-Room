// /api/oauth/tiktok/deauthorize
//
// TikTok can call this webhook when a user revokes Vantus's permission. We use
// it to clean up our stored token + account when we add verified webhook
// handling.
//
// For now this is a logging stub. It exists so the platform-side app config has
// a stable URL and can respond 200 while proper verification/deletion lands.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  console.log("[oauth-tiktok-deauthorize] received", {
    bodyLength: (event.body || "").length,
    contentType: event.headers?.["content-type"] || event.headers?.["Content-Type"],
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acknowledged: true }),
  };
};
