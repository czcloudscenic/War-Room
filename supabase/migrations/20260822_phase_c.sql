-- Phase C (first slice) — approval-mode confirmation flag (estimate question #2,
-- decided under Danny's 8/22 "Make Vantus work" delegation).
-- Idempotent + additive. The app TOLERATES this column missing (the confirm
-- toggle feature-detects), so deploy order is flexible for this one — but
-- apply it promptly so the activation checklist can be honest about
-- "chose internal" vs "never consciously set".

alter table public.clients
  add column if not exists approval_mode_confirmed boolean not null default false;

comment on column public.clients.approval_mode_confirmed is
  'True once a human explicitly confirmed the client''s approval mode (approval_rule defaults to internal in the DB, so "set" was previously indistinguishable from "never chosen").';

-- Verify: select approval_mode_confirmed from public.clients limit 1;
