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
  // revision_count is NOT patched here: the approvals_bump_revision DB trigger
  // (20260729_revision_caps.sql) increments it atomically on the audit insert,
  // covering every writer (admin session, service-key portal decisions).
  const patch = { status, stage: status, updated_at: new Date().toISOString() };
  const { error: uErr } = await sb.from('content_items').update(patch).eq('id', itemId);
  if (uErr) throw new Error('status update failed: ' + uErr.message);

  // The count the row holds after the trigger ran — used for the cycle-aware
  // notify dedupe key, which must match what the App.jsx realtime detector
  // reads off the updated row.
  const revisionCount = decision === 'revision_requested'
    ? (Number(item?.revision_count) || 0) + 1
    : (Number(item?.revision_count) || 0);

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
        item: { id: itemId, title: item?.title, status, revision_count: revisionCount },
        client_id: clientId,
        feedback: feedback || null,
      }),
    });
  } catch { /* noop — Slack/email is a courtesy, not a gate */ }

  // 4. Revision-cap check (soft — flags, never blocks). The portal/one-click
  // path does the same check server-side in approval-decision.js.
  if (decision === 'revision_requested' && clientId) {
    try {
      const { data: c } = await sb.from('clients').select('included_revisions, name').eq('id', clientId).single();
      const cap = c?.included_revisions != null ? Number(c.included_revisions) : null;
      if (cap != null && revisionCount >= cap) {
        await apiFetch('/api/notify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'revision_cap_reached',
            item: { id: itemId, title: item?.title, revision_count: revisionCount, cap, client: c?.name },
            client_id: clientId,
          }),
        });
      }
    } catch { /* courtesy, not a gate */ }
  }

  return { status, revision_count: revisionCount };
}

/**
 * Fire the approval-request notification when an item ENTERS a client approval
 * gate (Need Copy/Content Approval) and the item is client-approvable. The
 * backend issues one-click tokens + emails the client; dedupe is cycle-aware
 * so this and the App.jsx realtime detector collapse to one send.
 * Fire-and-forget: never blocks the save that triggered it.
 */
const NEED_APPROVAL_STATUSES = ['Need Copy Approval', 'Need Content Approval'];
export function maybeNotifyApprovalRequested(item, prevStatus) {
  const status = item?.status;
  if (!NEED_APPROVAL_STATUSES.includes(status)) return;
  if (status === prevStatus) return;
  if (item?.approval_mode !== 'client') return;
  apiFetch('/api/notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'approval_requested',
      item: {
        id: item.id,
        title: item.title,
        status,
        campaign: item.campaign,
        platform: item.platform,
        revision_count: Number(item.revision_count) || 0,
        client_id: item.client_id,
      },
      client_id: item.client_id || null,
    }),
  }).catch(() => { /* courtesy, not a gate */ });
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
