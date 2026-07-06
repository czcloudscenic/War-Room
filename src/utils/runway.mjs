// ── Content runway math ──
//
// The ONE implementation of inventory / burn / runway / severity, shared by:
//   • RunwayRoute.jsx + the ClientsRoute badge (browser, via Vite)
//   • netlify/functions/content-runway-check.js (cron, via esbuild require)
// .mjs on purpose: unambiguous ESM for Vite, Node, and esbuild despite the
// repo's "type":"commonjs". Pure functions only — no I/O, no Date.now();
// `now` is always injected so the cron, the UI, and tests agree.
//
// Model (spec 2026-07-06):
//   inventory  = content_items not posted / not scrapped, bucketed ready vs production
//   burn/day   = Sprout measured → posted_at trailing window → posts_per_week/7
//   runway     = scheduled queue end (Sprout) when known, else inventory ÷ burn
//   severity   = warning (< shoot_lead_time_days) → critical (< 5d) → empty (≤ 0)

const DAY_MS = 86400000;

// Statuses that count as "ready to go out" vs "still in production".
// Posted/Scrapped never count as inventory (and posted_at wins over status).
export const READY_STATUSES = ["Approved", "Ready For Schedule", "Scheduled"];
export const TERMINAL_STATUSES = ["Posted", "Scrapped"];

export const CRITICAL_DAYS = 5;

// ── inventory ──
export function bucketInventory(items) {
  let ready = 0, production = 0;
  for (const it of items || []) {
    if (it.posted_at || TERMINAL_STATUSES.includes(it.status)) continue;
    if (READY_STATUSES.includes(it.status)) ready++;
    else production++;
  }
  return { ready, production, total: ready + production };
}

// ── burn ──
// Measured posting rate from posted_at stamps in the trailing window.
// Returns null when nothing posted in-window (no signal ≠ zero burn).
export function measuredBurnPerDay(items, now, windowDays = 14) {
  const cutoff = now - windowDays * DAY_MS;
  let posted = 0;
  for (const it of items || []) {
    if (!it.posted_at) continue;
    const ts = Date.parse(it.posted_at);
    if (!Number.isNaN(ts) && ts >= cutoff && ts <= now) posted++;
  }
  return posted > 0 ? posted / windowDays : null;
}

// Burn ladder: Sprout measured → posted_at measured → cadence estimate.
// Returns { perDay, source } with source 'sprout'|'posted_at'|'cadence'|null.
export function resolveBurn({ sproutBurnPerDay, items, postsPerWeek, now }) {
  if (sproutBurnPerDay != null && sproutBurnPerDay > 0) {
    return { perDay: sproutBurnPerDay, source: "sprout" };
  }
  const measured = measuredBurnPerDay(items, now);
  if (measured != null) return { perDay: measured, source: "posted_at" };
  const cadence = Number(postsPerWeek);
  if (Number.isFinite(cadence) && cadence > 0) {
    return { perDay: cadence / 7, source: "cadence" };
  }
  return { perDay: null, source: null };
}

// ── runway ──
export function inventoryRunwayDays(inventoryTotal, burnPerDay) {
  if (burnPerDay == null || burnPerDay <= 0) return null;
  return inventoryTotal / burnPerDay;
}

// Days until the Sprout scheduled queue runs dry. 0 when already past.
export function queueRunwayDays(queueEndDate, now) {
  if (!queueEndDate) return null;
  const ts = typeof queueEndDate === "number" ? queueEndDate : Date.parse(queueEndDate);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, (ts - now) / DAY_MS);
}

// ── severity + dates ──
export function severityFor(runwayDays, leadTimeDays) {
  if (runwayDays == null) return null; // unconfigured — digest flags it, never alerts
  if (runwayDays <= 0) return "empty";
  if (runwayDays < CRITICAL_DAYS) return "critical";
  if (runwayDays < leadTimeDays) return "warning";
  return null;
}

// The last responsible day to book a shoot: runway end minus lead time,
// clamped to today (if you're already inside the lead window, book NOW).
export function bookByDate(now, runwayDays, leadTimeDays) {
  if (runwayDays == null) return null;
  const ms = now + Math.max(0, runwayDays - leadTimeDays) * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

// Re-fire cadence: warning every 3d, critical/empty daily.
export function refireDue(severity, lastAlertAt, now) {
  if (!severity) return false;
  if (!lastAlertAt) return true;
  const last = typeof lastAlertAt === "number" ? lastAlertAt : Date.parse(lastAlertAt);
  if (Number.isNaN(last)) return true;
  const gapDays = severity === "warning" ? 3 : 1;
  return now - last >= gapDays * DAY_MS;
}

// ── drought (deadzone) detection ──
// The Sprout-only signal for clients with no logged inventory: how long since
// they last posted vs their normal gap. Stalled = posting stopped = content is
// dying/dead NOW, regardless of what the (empty) pipeline claims.
export function droughtInfo({ lastPostAt, noPosts14d, burnPerDay, now }) {
  if (noPosts14d) {
    // mapped profiles, zero posts in the trailing window — mega-drought
    return { daysSincePost: 14, expectedGapDays: null, stalled: true, floor: true };
  }
  if (!lastPostAt) return { daysSincePost: null, expectedGapDays: null, stalled: false, floor: false };
  const ts = typeof lastPostAt === "number" ? lastPostAt : Date.parse(lastPostAt);
  if (Number.isNaN(ts)) return { daysSincePost: null, expectedGapDays: null, stalled: false, floor: false };
  const daysSincePost = (now - ts) / DAY_MS;
  const expectedGapDays = burnPerDay && burnPerDay > 0 ? 1 / burnPerDay : null;
  // stalled when the silence is 2x their normal rhythm (never under 3 days,
  // so weekend gaps don't cry wolf); no rhythm baseline → 7-day default
  const threshold = expectedGapDays != null ? Math.max(3, 2 * expectedGapDays) : 7;
  return { daysSincePost, expectedGapDays, stalled: daysSincePost >= threshold, floor: false };
}

// Most recent shoot batch, from LogShootModal's campaign convention
// ("Shoot YYYY-MM-DD"), falling back to nothing (null) — display-only.
export function lastShootDate(items) {
  let best = null;
  for (const it of items || []) {
    const m = /^Shoot (\d{4}-\d{2}-\d{2})$/.exec(it.campaign || "");
    if (m && (!best || m[1] > best)) best = m[1];
  }
  return best;
}

// ── the one-stop snapshot ──
// client: { posts_per_week, shoot_lead_time_days, content_tracking_enabled }
// items:  this client's content_items rows
// opts:   { now, sproutQueueEndDate?, sproutBurnPerDay? }
export function clientRunway(client, items, opts = {}) {
  const now = opts.now ?? Date.parse(new Date().toISOString()); // callers should inject
  const leadTime = Number(client?.shoot_lead_time_days) > 0 ? Number(client.shoot_lead_time_days) : 14;

  const inventory = bucketInventory(items);
  const burn = resolveBurn({
    sproutBurnPerDay: opts.sproutBurnPerDay,
    items,
    postsPerWeek: client?.posts_per_week,
    now,
  });

  const scheduledRunwayDays = queueRunwayDays(opts.sproutQueueEndDate, now);
  // A pipeline with ZERO rows is missing data, not zero inventory — don't
  // declare "0 pieces left" for a client nobody has logged yet. Predictive
  // runway turns on with the first logged shoot; until then drought detection
  // (below) is the alarm.
  const hasPipelineData = (items || []).length > 0;
  const invRunwayDays = hasPipelineData ? inventoryRunwayDays(inventory.total, burn.perDay) : null;

  // Sprout's queue-end is the hard signal when we have it; the pipeline
  // inventory is the buffer shown alongside, not a reprieve from the alert
  // (unscheduled pieces still need someone to schedule them).
  const effectiveRunwayDays = scheduledRunwayDays != null ? scheduledRunwayDays : invRunwayDays;
  let severity = severityFor(effectiveRunwayDays, leadTime);
  let mode = effectiveRunwayDays == null ? null
    : scheduledRunwayDays != null ? "queue" : "inventory";

  // Drought fallback: no runway model available (or it reads healthy while
  // posting has actually stopped) → the deadzone signal wins.
  const drought = droughtInfo({
    lastPostAt: opts.sproutLastPostAt,
    noPosts14d: opts.sproutNoPosts14d,
    burnPerDay: burn.perDay,
    now,
  });
  if (drought.stalled && (effectiveRunwayDays == null || severity == null)) {
    severity = "empty";
    mode = "drought";
  }

  return {
    tracked: !!client?.content_tracking_enabled,
    configured: effectiveRunwayDays != null || mode === "drought",
    mode,                                   // 'queue' | 'inventory' | 'drought' | null
    inventory,
    burn,                                   // { perDay, source }
    scheduledRunwayDays,
    inventoryRunwayDays: invRunwayDays,
    runwayDays: effectiveRunwayDays,
    severity,                               // null | warning | critical | empty
    leadTimeDays: leadTime,
    bookBy: mode === "drought" ? null : bookByDate(now, effectiveRunwayDays, leadTime),
    queueEndDate: opts.sproutQueueEndDate ?? null,
    lastShoot: lastShootDate(items),
    drought,                                // { daysSincePost, expectedGapDays, stalled, floor }
  };
}
