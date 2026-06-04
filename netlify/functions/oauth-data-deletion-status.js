// /api/oauth/data-deletion-status
//
// Public status lookup for platform data-deletion confirmation codes.

const { getDataDeletionRequest } = require("./_lib/oauth");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const code = event.queryStringParameters?.code || event.queryStringParameters?.confirmation_code;
  if (!code) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "confirmation code required" }),
    };
  }

  try {
    const row = await getDataDeletionRequest(code);
    if (!row) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "confirmation code not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmation_code: row.confirmation_code,
        platform: row.platform,
        status: row.status,
        requested_at: row.requested_at,
        completed_at: row.completed_at,
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
