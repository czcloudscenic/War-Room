// Billing — Stripe seam (STUB, intentionally not wired).
//
// This is the ONLY place Stripe needs to be wired. When you're ready:
//   1. Add STRIPE_SECRET_KEY (+ STRIPE_WEBHOOK_SECRET) to Netlify env vars.
//   2. `npm i stripe` and uncomment the import below.
//   3. Implement:
//        action "create"  → stripe.invoices.create(...) for the client, then save the
//                           returned id to invoices.stripe_invoice_id (+ stripe_customer_id).
//        action "webhook" → verify the signature, and on `invoice.paid` update the local
//                           invoices row: status='paid', paid_at=now().
//
// The invoices table already has stripe_invoice_id / stripe_customer_id columns and a
// stripe_customers mapping table, so wiring Stripe is a flip from manual → auto — no
// schema change. Until then, Billing runs on manual create/send/mark-paid.

// const Stripe = require("stripe");
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 501,
      headers: cors,
      body: JSON.stringify({ error: "Stripe not wired yet — set STRIPE_SECRET_KEY + install the stripe package, then implement create-invoice + the webhook handler in this file." }),
    };
  }

  // TODO (wire Stripe here):
  //   const { action, invoice } = JSON.parse(event.body || "{}");
  //   if (action === "create")  { ...stripe.invoices.create... ; persist stripe_invoice_id }
  //   if (action === "webhook") { ...verify sig... ; on invoice.paid → mark local invoice paid }
  return { statusCode: 501, headers: cors, body: JSON.stringify({ error: "Stripe handler not implemented." }) };
};
