// /api/oauth/youtube/deauthorize
//
// Google revocation does not call this webhook in the normal OAuth flow. This
// endpoint deletes a matching YouTube connected account when an id is supplied.

const {
  deleteConnectedAccountByPlatformId,
  extractPlatformAccountId,
  parseRequestBody,
} = require("./_lib/oauth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const payload = { ...(event.queryStringParameters || {}), ...parseRequestBody(event) };
  const accountId = extractPlatformAccountId(payload);

  try {
    const deletion = accountId
      ? await deleteConnectedAccountByPlatformId("youtube", accountId)
      : { deleted: 0 };
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledged: true, deleted: deletion.deleted }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
