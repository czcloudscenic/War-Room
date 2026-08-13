import React from 'react';

const DAY_MS = 86400000;

const META = {
  fresh: { color: '#30d158', background: 'rgba(48,209,88,0.08)' },
  due: { color: '#ff9f0a', background: 'rgba(255,159,10,0.08)' },
  stale: { color: '#ff453a', background: 'rgba(255,69,58,0.08)' },
};

const SIZE = {
  sm: { fontSize: 8.5, padding: '2px 7px' },
  md: { fontSize: 9.5, padding: '3px 9px' },
};

function reviewAgeDays(lastReviewedAt, now = Date.now()) {
  const reviewedAt = Date.parse(lastReviewedAt || '');
  if (Number.isNaN(reviewedAt)) return null;
  return Math.max(0, (now - reviewedAt) / DAY_MS);
}

export function freshnessState({ lastReviewedAt, reviewFrequencyDays }) {
  const ageDays = reviewAgeDays(lastReviewedAt);
  const frequency = Number(reviewFrequencyDays);

  if (ageDays === null || !Number.isFinite(frequency) || frequency <= 0) return 'stale';
  if (ageDays > frequency) return 'stale';
  if (ageDays > frequency * 0.8) return 'due';
  return 'fresh';
}

export default function FreshnessBadge({
  owner,
  lastReviewedAt,
  reviewFrequencyDays,
  size = 'sm',
}) {
  const state = freshnessState({ lastReviewedAt, reviewFrequencyDays });
  const ageDays = reviewAgeDays(lastReviewedAt);
  const days = ageDays === null ? null : Math.floor(ageDays);
  const label = state === 'fresh'
    ? `Fresh · ${days}d ago`
    : state === 'due'
      ? 'Review due'
      : days === null
        ? 'STALE'
        : `STALE · ${days}d`;
  const reviewed = ageDays === null ? 'Never reviewed' : new Date(lastReviewedAt).toLocaleString();
  const tooltip = `${owner || 'Unassigned owner'} · ${reviewed}`;
  const meta = META[state];
  const dimensions = SIZE[size] || SIZE.sm;

  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 20,
        border: `1px solid ${meta.color}45`,
        background: meta.background,
        color: meta.color,
        fontFamily: "'Geist Mono', monospace",
        fontWeight: 700,
        letterSpacing: 0.5,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...dimensions,
      }}
    >
      {label}
    </span>
  );
}
