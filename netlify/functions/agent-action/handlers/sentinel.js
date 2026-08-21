// handlers/sentinel.js — Scope Sentinel (v3 spec §3.D.1), the first NEW agent.
// R11 as software: any new request / revision / format / platform / shoot /
// reopened work gets CLASSIFIED before anyone works on it, so nothing is
// absorbed silently. Draft-first: the sentinel proposes, a human confirms.
//
// Guardrails (spec, non-negotiable):
//   - never quotes the client
//   - never changes scope itself — classification is a draft until a human decides
//   - never defaults unclear -> included: unclear = included_with_clarification
//     with the clarifying question written out
//
// Actions:
//   sentinel_classify — request text + client in -> scope_requests draft row out
//   sentinel_decide   — the human decision: confirm / dismiss / override class
//   Absorbed-value register = confirmed rows classified absorbed_intentionally;
//   the monthly roll-up is deterministic UI math, no AI.

const { REST, SB_HEADERS, sbGet, ai } = require("../_shared");

const CLASSES = [
  "included",
  "included_with_clarification",
  "swap_required",
  "priced_addition",
  "out_of_scope",
  "decline_recommended",
  "absorbed_intentionally",
];

function parseJSON(raw) {
  const cleaned = String(raw).replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

async function sbWrite(path, { method = "POST", body, headers = {} } = {}) {
  const res = await fetch(`${REST}/${path}`, {
    method,
    headers: { ...SB_HEADERS(), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`supabase ${method} ${path.split("?")[0]}: ${res.status} ${txt.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

// The agreement context the sentinel judges against — real columns only.
async function getScopeContext(client_id) {
  const clients = await sbGet(
    `clients?id=eq.${client_id}&select=name,retainer_amount,retainer_status,cadence,posts_per_week,included_revisions,approval_rule,client_facts`
  );
  const c = clients?.[0];
  if (!c) throw new Error("client not found");
  const recent = await sbGet(
    `scope_requests?client_id=eq.${client_id}&status=eq.confirmed&select=request_text,classification&order=created_at.desc&limit=8`
  );
  return { client: c, precedent: recent || [] };
}

async function sentinel_classify(payload) {
  const { client_id, request_text, content_item_id = null, request_source = "manual", actor_email = null } = payload;
  if (!client_id) throw new Error("client_id required");
  const text = String(request_text || "").trim();
  if (!text) throw new Error("request_text required");

  const { client, precedent } = await getScopeContext(client_id);

  const system = `You are the Scope Sentinel for a marketing agency. You classify incoming client requests against the client's agreement. You NEVER quote prices to the client, you NEVER change scope yourself, and when the agreement is unclear you NEVER default to "included" — unclear means "included_with_clarification" and you write the exact clarifying question.

Classify into exactly one of: ${CLASSES.join(", ")}.
- included: clearly inside the retainer/deliverable terms below.
- included_with_clarification: probably inside, but one stated ambiguity must be resolved first. Write the question.
- swap_required: doable inside scope only by swapping out an equivalent planned deliverable.
- priced_addition: real work outside the agreement; should be priced and proposed internally.
- out_of_scope: outside the agreement and not a natural paid addition.
- decline_recommended: outside scope AND doing it would be bad for the engagement.
- absorbed_intentionally: use ONLY when the request explicitly says the team already decided to absorb it.

Also estimate est_value: the fair dollar value of the ask (what it would bill standalone). Integer dollars, null if genuinely unestimable.

Respond with JSON only:
{"classification":"...","rationale":"2-3 plain sentences for the internal team","clarification":"the question to resolve, or null","est_value":123}`;

  const user = `CLIENT AGREEMENT FACTS
Client: ${client.name}
Retainer: ${client.retainer_amount != null ? `$${client.retainer_amount}/mo (${client.retainer_status || "status unknown"})` : "none recorded"}
Cadence: ${client.cadence || "not set"} · Posts/week: ${client.posts_per_week ?? "not set"}
Included revision rounds: ${client.included_revisions ?? "not set"}
Approval rule: ${client.approval_rule || "not set"}

CONFIRMED PRECEDENT (recent decided requests for this client):
${precedent.length ? precedent.map(p => `- [${p.classification}] ${String(p.request_text).slice(0, 140)}`).join("\n") : "none yet"}

NEW REQUEST (${request_source}):
${text.slice(0, 2000)}`;

  const raw = await ai(system, user, 900);
  const out = parseJSON(raw);
  if (!out || !CLASSES.includes(out.classification)) {
    throw new Error(`sentinel returned unusable classification: ${String(raw).slice(0, 160)}`);
  }

  const rows = await sbWrite("scope_requests", {
    body: {
      client_id,
      content_item_id,
      request_source,
      request_text: text,
      classification: out.classification,
      rationale: out.rationale || null,
      clarification: out.clarification || null,
      est_value: Number.isFinite(Number(out.est_value)) ? Number(out.est_value) : null,
      status: "draft",
      created_by: actor_email,
    },
    headers: { Prefer: "return=representation" },
  });
  return { ok: true, request: rows?.[0] || null };
}

async function sentinel_decide(payload) {
  const { id, decision, classification = null, est_value, actor_email = null } = payload;
  if (!id) throw new Error("id required");
  if (!["confirmed", "dismissed"].includes(decision)) throw new Error("decision must be confirmed|dismissed");
  if (classification && !CLASSES.includes(classification)) throw new Error("bad classification override");

  const patch = {
    status: decision,
    decided_by: actor_email,
    decided_at: new Date().toISOString(),
  };
  if (classification) patch.classification = classification; // human override wins
  if (est_value !== undefined && est_value !== null && Number.isFinite(Number(est_value))) {
    patch.est_value = Number(est_value);
  }
  const rows = await sbWrite(`scope_requests?id=eq.${id}`, {
    method: "PATCH",
    body: patch,
    headers: { Prefer: "return=representation" },
  });
  if (!rows?.length) throw new Error("scope request not found");
  return { ok: true, request: rows[0] };
}

module.exports = { sentinel_classify, sentinel_decide };
