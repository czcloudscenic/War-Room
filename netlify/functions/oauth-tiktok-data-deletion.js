// /api/oauth/tiktok/data-deletion
//
// Verifies TikTok-Signature when present, deletes matching account data by
// user_openid when supplied, and persists a confirmation-code status row.

const {
  confirmationCode,
  dataDeletionStatusUrl,
  deleteConnectedAccountByPlatformId,
  extractPlatformAccountId,
  parseRequestBody,
  recordDataDeletionRequest,
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
    if (accountId) await deleteConnectedAccountByPlatformId("tiktok", accountId);
    const code = confirmationCode();
    await recordDataDeletionRequest({
      platform: "tiktok",
      platformAccountId: accountId,
      confirmationCode: code,
      rawPayload: payload,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: dataDeletionStatusUrl(code),
        confirmation_code: code,
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
