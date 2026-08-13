// ── Content version lineage (Phase B, v3 spec §3.B.2) ────────────────────────
// Immutable version rows on content_items: every meaningful creative change
// snapshots a version; every approval captures THE version that was approved
// and points content_items.approved_version_id at it. The approved version is
// the only schedulable version — truthGates()/versionDrift() (core/truth.js)
// enforce/flag downstream.
//
// Version writes are best-effort receipts: they warn, never block the save or
// the approval that triggered them (same tolerance pattern as Phase A's
// skill_briefs). The server-side approval path (approval-decision.js) mirrors
// this logic with the service key — change both together.

import { sb } from '../services/supabaseClient';
import { creativeSnapshot } from './truth.js';

/**
 * Snapshot the item's creative surface as the next version row.
 *   source   : 'save' | 'approval' | 'system'
 *   approved : { stage, by } — set only when the snapshot IS an approval capture
 * Returns the inserted row, or null on failure (warned, never thrown).
 */
export async function snapshotVersion(item, { source = 'save', createdBy = null, approved = null } = {}) {
  if (!sb || !item?.id) return null;
  try {
    const { data: maxRows, error: mErr } = await sb
      .from('content_versions')
      .select('version_no')
      .eq('content_item_id', item.id)
      .order('version_no', { ascending: false })
      .limit(1);
    if (mErr) throw mErr;
    const versionNo = ((maxRows?.[0]?.version_no) || 0) + 1;

    const snap = creativeSnapshot(item);
    const row = {
      content_item_id: item.id,
      client_id: item.client_id || null,
      version_no: versionNo,
      title: snap.title,
      caption: snap.caption,
      script: snap.script,
      cta: snap.cta,
      hashtags: snap.hashtags,
      files: snap.files || [],
      review_video_path: snap.review_video_path,
      snapshot: snap,
      source,
      created_by: createdBy,
      approved_stage: approved?.stage || null,
      approved_by: approved?.by || null,
      approved_at: approved ? new Date().toISOString() : null,
    };
    const { data, error } = await sb.from('content_versions').insert(row).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.warn('[versions] snapshot failed:', e.message || e);
    return null;
  }
}

/**
 * Approval capture: snapshot the item as an approved version AND point
 * content_items.approved_version_id at it. Called from recordApproval on an
 * 'approved' decision. Best-effort.
 */
export async function captureApprovedVersion(item, { stage, approverEmail } = {}) {
  const version = await snapshotVersion(item, {
    source: 'approval',
    createdBy: approverEmail || null,
    approved: { stage: stage || null, by: approverEmail || null },
  });
  if (!version) return null;
  try {
    const { error } = await sb.from('content_items')
      .update({ approved_version_id: version.id })
      .eq('id', item.id);
    if (error) throw error;
  } catch (e) {
    console.warn('[versions] approved_version_id update failed:', e.message || e);
  }
  return version;
}

/** Version history, newest first. Returns [] on any failure (table tolerant). */
export async function fetchVersions(itemId, limit = 30) {
  if (!sb || !itemId) return [];
  try {
    const { data, error } = await sb.from('content_versions')
      .select('*')
      .eq('content_item_id', itemId)
      .order('version_no', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[versions] fetch failed:', e.message || e);
    return [];
  }
}
