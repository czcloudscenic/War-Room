// ── Generalized audit trail writer (Phase B, v3 spec §3.B.5) ─────────────────
// Who/what changed, human-or-agent, old → new, timestamp, reason. Mandatory on
// Facts of Record, credentials, scope, pricing, approval modes, recipients,
// and published items — hook the write sites, not the render sites.
//
// Best-effort by design: an audit failure must never block the change itself
// (the change is the business event; the audit row is its receipt). Failures
// log to console so /health picks them up.
//
// approvals + agent_events keep their own tables — this is for everything else.

import { sb } from '../services/supabaseClient';

const clip = (v) => {
  if (v === undefined || v === null) return null;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 400 ? s.slice(0, 397) + '…' : s;
};

/**
 * Write one audit row. Never throws.
 *   entityType : 'content_item' | 'client' | 'fact' | 'vault' | 'invoice' | ...
 *   entityId   : string (content_items ids are text; uuids stringify fine)
 *   actor      : { id, email } (the signed-in user) — or pass actorKind 'agent'/'system'
 */
export async function logAudit({ entityType, entityId, clientId = null, field = null, oldValue, newValue, actor = null, actorKind = 'human', reason = null }) {
  if (!sb) return false;
  try {
    const { error } = await sb.from('audit_log').insert({
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      client_id: clientId || null,
      field,
      old_value: clip(oldValue),
      new_value: clip(newValue),
      actor_kind: actorKind,
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      reason,
    });
    if (error) { console.warn('[audit] write failed:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[audit] write failed:', e.message);
    return false;
  }
}

/**
 * Diff two row snapshots and write one audit row per changed field.
 * `fields` bounds the diff to the fields that matter for this entity —
 * auditing every column is noise, auditing the mandated ones is the law.
 */
export async function auditDiff({ entityType, entityId, clientId = null, before = {}, after = {}, fields = [], actor = null, actorKind = 'human', reason = null }) {
  const changed = fields.filter(f => JSON.stringify(before?.[f] ?? null) !== JSON.stringify(after?.[f] ?? null));
  for (const field of changed) {
    await logAudit({ entityType, entityId, clientId, field, oldValue: before?.[field], newValue: after?.[field], actor, actorKind, reason });
  }
  return changed;
}
