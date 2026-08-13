// ── TRUTH layer primitives (Phase B, v3 spec §3.B) ───────────────────────────
// Pure functions: no I/O, no React. Callers inject the rows.
//
// Three jobs live here:
//   1. Block-reason taxonomy for the exception engine (§3.B.4) — every blocked
//      record carries WHY, WHO owns it, and whether the wait is external
//      (external waits pause SLA timers: client delay ≠ our failure, R10).
//   2. Facts freshness (§3.B.7) — stale critical facts BLOCK dependent
//      client-facing work. Thresholds here are the single source; the
//      FreshnessBadge UI mirrors them exactly.
//   3. Version drift (§3.B.2) — the approved version is the only schedulable
//      version; detect when creative fields moved after approval.

export const BLOCK_REASONS = [
  { key: 'internal_delay',   label: 'Internal delay',    external: false },
  { key: 'client_approval',  label: 'Client approval',   external: true  },
  { key: 'missing_info',     label: 'Missing info',      external: true  },
  { key: 'missing_asset',    label: 'Missing asset',     external: false },
  { key: 'platform_failure', label: 'Platform failure',  external: true  },
  { key: 'payment',          label: 'Payment',           external: true  },
];
export const blockReasonMeta = (key) => BLOCK_REASONS.find(r => r.key === key) || null;

// ── Freshness ────────────────────────────────────────────────────────────────
// never reviewed → stale; past frequency → stale; past 80% of frequency → due.
export function freshnessState({ lastReviewedAt, reviewFrequencyDays } = {}, now = Date.now()) {
  const freq = Number(reviewFrequencyDays) > 0 ? Number(reviewFrequencyDays) : 30;
  if (!lastReviewedAt) return 'stale';
  const days = (now - new Date(lastReviewedAt).getTime()) / 86400000;
  if (Number.isNaN(days) || days > freq) return 'stale';
  if (days > freq * 0.8) return 'due';
  return 'fresh';
}

/** Facts-of-Record freshness for a client row. Falls back to facts_updated_at
 *  (editing facts counts as reviewing them). */
export function factsFreshness(client, now = Date.now()) {
  const lastReviewedAt = client?.facts_last_reviewed_at || client?.facts_updated_at || null;
  const state = freshnessState({ lastReviewedAt, reviewFrequencyDays: client?.facts_review_frequency_days }, now);
  const days = lastReviewedAt ? Math.floor((now - new Date(lastReviewedAt).getTime()) / 86400000) : null;
  return { state, days, lastReviewedAt, owner: client?.facts_owner || null };
}

// ── Version snapshots + drift ────────────────────────────────────────────────
// The creative surface of a deliverable — what a client actually approves.
export const CREATIVE_FIELDS = ['title', 'caption', 'script', 'cta', 'hashtags', 'files', 'review_video_path'];

export function creativeSnapshot(item = {}) {
  const snap = {};
  for (const f of CREATIVE_FIELDS) snap[f] = item[f] ?? null;
  return snap;
}

/** Field names whose current value differs from a version's snapshot. */
export function versionDrift(item, versionRow) {
  if (!item || !versionRow) return [];
  const snap = versionRow.snapshot && Object.keys(versionRow.snapshot).length
    ? versionRow.snapshot
    : creativeSnapshot(versionRow);
  const cur = creativeSnapshot(item);
  return CREATIVE_FIELDS.filter(f => JSON.stringify(cur[f] ?? null) !== JSON.stringify(snap[f] ?? null));
}

// ── Schedule gates (consumed by EditContentModal's SOP checklist) ────────────
// Returns extra gates for client-facing statuses. Stale facts HARD-block (the
// spec's freshness gate); missing approved-version lineage warns in v1 so
// pre-Phase-B items that were legitimately approved don't brick.
const CLIENT_FACING_STATUSES = ['Ready For Schedule', 'Scheduled', 'Posted'];

export function truthGates({ status, approvalMode, approvedVersionId, client } = {}, now = Date.now()) {
  const gates = [];
  if (!CLIENT_FACING_STATUSES.includes(status)) return gates;

  if (client) {
    const fresh = factsFreshness(client, now);
    gates.push({
      label: 'Facts of Record fresh',
      ok: fresh.state !== 'stale',
      hard: fresh.state === 'stale',
      fix: fresh.lastReviewedAt
        ? `Facts are stale (${fresh.days}d, cycle ${client.facts_review_frequency_days || 30}d) — review them in Setup §5 before client-facing work ships`
        : 'Facts of Record have never been reviewed — fill and review them in Setup §5 first',
    });
  }

  if (approvalMode && approvalMode !== 'auto') {
    gates.push({
      label: 'Approved version on record',
      ok: !!approvedVersionId,
      hard: false, // warn in v1 — legacy items approved before lineage existed
      fix: 'No approved version recorded — approve it through the Ledger/Approvals so lineage exists',
    });
  }
  return gates;
}
