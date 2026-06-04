// /api/oauth/tiktok/deauthorize
//
// TikTok sends JSON webhooks. When TikTok-Signature is present, verify it
// before deleting the connected account by user_openid.

const {
  deleteConnectedAccountByPlatformId,
  extractPlatformAccountId,
  parseRequestBody,
  verifyTikTokSignature,
} = require("./_lib/oauth");

const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const verified = verifyTikTokSignature(event, TIKTOK_CLIENT_SECRET);
  if (!verified.ok) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: verified.reason }),
    };
  }

  const payload = parseRequestBody(event);
  const accountId = extractPlatformAccountId(payload);

  try {
    const deletion = accountId
      ? await deleteConnectedAccountByPlatformId("tiktok", accountId)
      : { deleted: 0 };
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acknowledged: true,
        deleted: deletion.deleted,
        verified_signature: verified.present,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
