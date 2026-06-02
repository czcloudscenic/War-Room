// /api/oauth/youtube/data-deletion
//
// Google/YouTube deletion cleanup can be wired here when we add verified
// request handling. We return a JSON object with a URL the user can visit to
// confirm deletion status + a unique confirmation_code.
//
// For now this is a stub. Proper deletion job tracking will land when we have
// user activity to clean up for this platform.

const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  console.log("[oauth-youtube-data-deletion] received", {
    bodyLength: (event.body || "").length,
  });

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
