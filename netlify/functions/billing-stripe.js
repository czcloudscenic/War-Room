// Billing — Stripe integration.
//
// Two entry points on one function, distinguished at runtime:
//   • Webhook   — Stripe POSTs with a `Stripe-Signature` header. We verify the
//                 signature and, on invoice.paid, flip the local invoices row to
//                 paid. No auth (Stripe isn't a logged-in user; the signature IS
//                 the auth).
//   • Create    — the app POSTs { action:"create", invoice_id } with a bearer
//                 token. Admin-only. Creates + finalizes + sends a hosted Stripe
//                 invoice for the client, and writes stripe_invoice_id /
//                 stripe_customer_id back onto the local row.
//
// No schema change — invoices.stripe_* columns + stripe_customers already exist.
// Until STRIPE_SECRET_KEY is set the function 501s and Billing stays manual.

const Stripe = require("stripe");
const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function rawBody(event) {
  const body = event?.body || "";
  return event?.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
}

async function sbREST(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

exports.handler = async (event) => {
  const cors = { ...makeCors(event), "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method Not Allowed" }) };

  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 501, headers: cors, body: JSON.stringify({ error: "Stripe not wired yet — set STRIPE_SECRET_KEY." }) };
  }
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  // Webhook path — presence of the Stripe signature header decides it.
  const sig = event.headers?.["stripe-signature"] || event.headers?.["Stripe-Signature"];
  if (sig) return handleWebhook(event, stripe, cors, sig);

  // Create path — admin only.
  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);
  if (auth.user.role !== "admin") return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Admins only" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Bad JSON" }) }; }
  if (body.action !== "create") return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Unknown action" }) };
  if (!body.invoice_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing invoice_id" }) };

  return handleCreate(body.invoice_id, stripe, cors);
};

// ── Create + finalize + send a hosted Stripe invoice ──────────────────────────
async function handleCreate(invoiceId, stripe, cors) {
  // 1. Local invoice
  const inv = (await (await sbREST(`invoices?id=eq.${invoiceId}&select=*`)).json())?.[0];
  if (!inv) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Invoice not found" }) };
  if (!inv.client_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invoice has no client" }) };
  if (inv.stripe_invoice_id) return { statusCode: 409, headers: cors, body: JSON.stringify({ error: "Already sent via Stripe" }) };

  // 2. Client (needs a billing email)
  const client = (await (await sbREST(`clients?id=eq.${inv.client_id}&select=name,primary_email`)).json())?.[0];
  if (!client?.primary_email) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Client has no billing email — add one in the client profile." }) };

  // 3. Resolve or create the Stripe customer (cache the mapping)
  let customerId = inv.stripe_customer_id
    || (await (await sbREST(`stripe_customers?client_id=eq.${inv.client_id}&select=stripe_customer_id`)).json())?.[0]?.stripe_customer_id
    || null;
  if (!customerId) {
    const customer = await stripe.customers.create({ name: client.name || undefined, email: client.primary_email });
    customerId = customer.id;
    await sbREST("stripe_customers", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ client_id: inv.client_id, stripe_customer_id: customerId }) });
  }

  // 4. Line items → Stripe invoice items (amounts are dollars locally → cents in Stripe)
  const currency = (inv.currency || "usd").toLowerCase();
  const items = (Array.isArray(inv.line_items) && inv.line_items.length)
    ? inv.line_items
    : [{ description: `Invoice ${inv.number}`, amount: inv.amount, qty: 1 }];
  for (const li of items) {
    await stripe.invoiceItems.create({
      customer: customerId,
      currency,
      amount: Math.round((Number(li.amount) || 0) * (li.qty || 1) * 100),
      description: li.description || inv.number || "Services",
    });
  }

  // 5. Create → finalize → send
  const daysUntilDue = inv.due_date ? Math.max(1, Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000)) : 30;
  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    metadata: { vantus_invoice_id: String(inv.id), number: inv.number || "" },
  });
  const finalized = await stripe.invoices.finalizeInvoice(draft.id);
  try { await stripe.invoices.sendInvoice(draft.id); } catch (e) { console.warn("[stripe] sendInvoice:", e.message); }

  // 6. Persist back to the local row
  await sbREST(`invoices?id=eq.${inv.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      stripe_invoice_id: draft.id,
      stripe_customer_id: customerId,
      status: "sent",
      sent_at: new Date().toISOString(),
      issued_at: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }),
  });

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, stripe_invoice_id: draft.id, hosted_invoice_url: finalized.hosted_invoice_url }) };
}

// ── Webhook — verify signature, sync paid/void status ─────────────────────────
async function handleWebhook(event, stripe, cors, sig) {
  if (!STRIPE_WEBHOOK_SECRET) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "STRIPE_WEBHOOK_SECRET not set" }) };
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(rawBody(event), sig, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `Signature verification failed: ${e.message}` }) };
  }

  const stripeInvoiceId = evt.data?.object?.id;
  if (stripeInvoiceId) {
    if (evt.type === "invoice.paid" || evt.type === "invoice.payment_succeeded") {
      await sbREST(`invoices?stripe_invoice_id=eq.${stripeInvoiceId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
    } else if (evt.type === "invoice.voided" || evt.type === "invoice.marked_uncollectible") {
      await sbREST(`invoices?stripe_invoice_id=eq.${stripeInvoiceId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "void", updated_at: new Date().toISOString() }),
      });
    }
  }

  return { statusCode: 200, headers: cors, body: JSON.stringify({ received: true }) };
}
