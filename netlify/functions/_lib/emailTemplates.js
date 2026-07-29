// emailTemplates — the shared Vantus email shell + Resend sender.
//
// Every feature-pack email (approval request, decision received, revision cap,
// stuck item, intake) renders through the same card so the pre-deploy render
// check is one pass. Matches the visual language of the existing notify.js /
// chase-overdue-tasks.js emails (light card on #f5f5f7, gradient header).
//
// sendEmail is Resend-guarded: with RESEND_API_KEY unset (prod today, localhost
// always) it logs a dry-run line and reports ok:false + dryRun:true instead of
// throwing — callers treat email as best-effort.

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

/**
 * The standard card. bodyHtml is trusted markup — escape all interpolations
 * with esc() before passing them in.
 */
function emailShell({ brandLabel, heading, headerGradient, bodyHtml, footerLabel }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,Inter,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:${headerGradient || "linear-gradient(135deg,#0a1a2e,#0d2a4a)"};padding:32px 32px 28px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${esc(brandLabel)}</div>
      <div style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-1px;line-height:1.15;">${heading}</div>
    </div>
    <div style="padding:28px 32px;">
      ${bodyHtml}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.07);font-size:11px;color:rgba(0,0,0,0.35);">
        ${esc(footerLabel || "Vantus")} · ${new Date().toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  </div>
</body></html>`;
}

/** A big tappable CTA button row (approve / request changes). */
function ctaButton({ href, label, background }) {
  return `<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;margin:0 8px 8px 0;background:${background};color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${esc(label)}</a>`;
}

/** Key-value detail table rows (matches the notify.js item card). */
function detailRows(pairs) {
  return `<table style="width:100%;border-collapse:collapse;">` + pairs
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) =>
      `<tr><td style="padding:8px 0;font-size:11px;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:1px;width:110px;">${esc(k)}</td>` +
      `<td style="padding:8px 0;font-size:13px;color:rgba(0,0,0,0.75);">${esc(v)}</td></tr>`
    ).join("") + `</table>`;
}

/** Resend send, dry-run safe. to: string | string[]. */
async function sendEmail({ from, to, subject, html }) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const recipients = Array.isArray(to) ? to : [to];
  if (!RESEND_KEY) {
    console.log(`[email dry-run] to=${recipients.join(",")} subject="${subject}" (RESEND_API_KEY not set)`);
    return { channel: "email", ok: false, dryRun: true, to: recipients, error: "RESEND_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from || "Vantus <notifications@cloudscenic.com>", to: recipients, subject, html }),
    });
    const data = await res.json().catch(() => ({}));
    return { channel: "email", ok: res.ok, to: recipients, id: data.id, error: data.message };
  } catch (e) {
    return { channel: "email", ok: false, to: recipients, error: e.message };
  }
}

module.exports = { esc, emailShell, ctaButton, detailRows, sendEmail };
