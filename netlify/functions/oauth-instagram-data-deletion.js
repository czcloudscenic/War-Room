// /api/oauth/instagram/data-deletion
//
// Meta sends a signed_request. We verify it, delete the connected account,
// persist the confirmation code, and return a status URL for the user.

const {
  confirmationCode,
  dataDeletionStatusUrl,
  deleteConnectedAccountByPlatformId,
  parseRequestBody,
  recordDataDeletionRequest,
  verifyMetaSignedRequest,
} = require("./_lib/oauth");

const IG_APP_SECRET = process.env.META_INSTAGRAM_APP_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const body = parseRequestBody(event);
  const verified = verifyMetaSignedRequest(body.signed_request, IG_APP_SECRET);
  if (!verified.ok) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: verified.reason }),
    };
  }

  const userId = verified.payload?.user_id;
  if (!userId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "signed_request missing user_id" }),
    };
  }

  try {
    await deleteConnectedAccountByPlatformId("instagram", userId);
    const code = confirmationCode();
    await recordDataDeletionRequest({
      platform: "instagram",
      platformAccountId: userId,
      confirmationCode: code,
      rawPayload: verified.payload,
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
