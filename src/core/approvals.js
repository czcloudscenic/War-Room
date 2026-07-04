// Approval loop — turns a status change into an auditable decision.
//
// Today content_items.status only holds the *current* state; nothing records who
// approved/rejected what, when, with what feedback. These helpers write the
// approvals audit row, advance the item, bump revision_count on a kickback, and
// fire the existing Slack/email/n8n notification — so the ledger has a real
// paper trail. Collision-safe: new module, imports the existing singletons.

import { sb } from '../services/supabaseClient';
import { apiFetch } from '../services/apiFetch';

/** Next content_items.status for an approval at a given gate. */
function nextStatus(decision, stage) {
  if (decision === 'revision_requested') return 'Needs Revisions';
  if (stage === 'copy') return 'Ready For Content Creation'; // copy approved → into content production
  return 'Approved';                                          // content/client approved
}

/**
 * Record an approval decision on a deliverable.
 *   item     : the content_items row
 *   decision : 'approved' | 'revision_requested'
 *   stage    : 'copy' | 'content' | 'client'
 *   feedback : text (required-ish for a kickback)
 *   approver : { id, email } (the signed-in user)
 * Writes the audit row → advances the item → notifies. Returns the new status.
 */
export async function recordApproval({ item, decision, stage, feedback, approver } = {}) {
  const status = nextStatus(decision, stage);
  const itemId = item?.id;
  const clientId = item?.client_id;

  // 1. audit trail
  const { error: aErr } = await sb.from('approvals').insert({
    content_item_id: itemId,
    client_id: clientId,
    approver_id: approver?.id || null,
    approver_email: approver?.email || null,
    decision,
    stage: stage || null,
    feedback: feedback || null,
  });
  if (aErr) throw new Error('approval write failed: ' + aErr.message);

  // 2. advance the item. stage mirrors status everywhere else (App.jsx handleSave
  // sets stage: updated.status); patch both or boards keyed on stage mis-bucket.
  const patch = { status, stage: status, updated_at: new Date().toISOString() };
  if (decision === 'revision_requested') patch.revision_count = (Number(item?.revision_count) || 0) + 1;
  const { error: uErr } = await sb.from('content_items').update(patch).eq('id', itemId);
  if (uErr) throw new Error('status update failed: ' + uErr.message);

  // 3. notify (best-effort — never block the decision on a failed webhook)
  try {
    await apiFetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // revision_count makes the notify dedupe cycle-aware (approve → revise →
        // re-approve re-notifies). Must match the value the App.jsx realtime
        // detector reads from the row, or the two callers won't dedupe together.
        type: decision === 'revision_requested' ? 'revision_requested' : 'approved',
        item: { id: itemId, title: item?.title, status, revision_count: patch.revision_count ?? (Number(item?.revision_count) || 0) },
        client_id: clientId,
        feedback: feedback || null,
      }),
    });
  } catch { /* noop — Slack/email is a courtesy, not a gate */ }

  return { status, revision_count: patch.revision_count ?? item?.revision_count };
}

/** Inline ledger edits — assign owner / set due date. */
export async function setLedgerFields(itemId, fields) {
  const { error } = await sb.from('content_items')
    .update({ ...(fields || {}), updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw new Error(error.message);
}

/** The Friday "did it post?" action — stamp proof of publication. */
export async function markPosted(itemId) {
  const { error } = await sb.from('content_items')
    .update({ status: 'Posted', stage: 'Posted', posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw new Error(error.message);
}
