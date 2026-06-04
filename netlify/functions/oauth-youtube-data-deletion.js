// /api/oauth/youtube/data-deletion
//
// Google OAuth revocation is not delivered through this webhook. If a channel
// id is supplied, delete that connected account and persist a status row.

const {
  confirmationCode,
  dataDeletionStatusUrl,
  deleteConnectedAccountByPlatformId,
  extractPlatformAccountId,
  parseRequestBody,
  recordDataDeletionRequest,
} = require("./_lib/oauth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const payload = { ...(event.queryStringParameters || {}), ...parseRequestBody(event) };
  const accountId = extractPlatformAccountId(payload);

  try {
    if (accountId) await deleteConnectedAccountByPlatformId("youtube", accountId);
    const code = confirmationCode();
    await recordDataDeletionRequest({
      platform: "youtube",
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
