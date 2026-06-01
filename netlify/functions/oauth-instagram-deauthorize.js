// /api/oauth/instagram/deauthorize
//
// Meta calls this webhook when a user revokes Vantus's permission from
// instagram.com / Meta's apps & websites settings. Meta sends a signed_request
// payload with the IG user_id. We use it to clean up our stored token + account.
//
// For now this is a logging stub — proper signed_request verification + token
// deletion will land when we have multi-user activity to clean up. Meta only
// requires the URL to respond 200; the signed_request can be verified later.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // signed_request comes as application/x-www-form-urlencoded
  console.log("[oauth-ig-deauthorize] received", {
    bodyLength: (event.body || "").length,
    contentType: event.headers?.["content-type"] || event.headers?.["Content-Type"],
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acknowledged: true }),
  };
};
