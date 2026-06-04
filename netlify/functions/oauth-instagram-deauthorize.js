// /api/oauth/instagram/deauthorize
//
// Meta calls this webhook when a user revokes Vantus's permission.
// The signed_request payload is verified before deleting the stored account.

const {
  deleteConnectedAccountByPlatformId,
  parseRequestBody,
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
    const deletion = await deleteConnectedAccountByPlatformId("instagram", userId);
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
