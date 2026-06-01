// /api/oauth/instagram/data-deletion
//
// Meta calls this when a user requests data deletion (GDPR / CCPA / Meta's
// own "delete my data" flow). We must return a JSON object with a URL the
// user can visit to confirm deletion status + a unique confirmation_code.
//
// For now this is a stub — proper deletion job will land when we have user
// data to delete. Meta requires the endpoint to exist and respond correctly
// during App Review.

const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  console.log("[oauth-ig-data-deletion] received", {
    bodyLength: (event.body || "").length,
  });

  // Confirmation code Meta will display to the user. Real implementation
  // would key this to a deletion job row so the status URL can report progress.
  const confirmationCode = crypto.randomBytes(8).toString("hex");
  const statusUrl = `https://usevantus.com/?data_deletion_status=${confirmationCode}`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: statusUrl,
      confirmation_code: confirmationCode,
    }),
  };
};
