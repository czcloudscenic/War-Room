-- Fix #3.1 — last hardcoded VitalLyfe reference at the agent layer.
--
-- The cid_library table has a column `vitallyfe_adaptation` that was named
-- back when VitalLyfe was the only client. Move 1 made the agent layer
-- multi-tenant; this rename closes the last leftover.
--
-- Idempotent: only renames if the old name exists. Safe to re-run.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cid_library'
      and column_name = 'vitallyfe_adaptation'
  ) then
    alter table public.cid_library rename column vitallyfe_adaptation to client_adaptation;
    raise notice 'renamed cid_library.vitallyfe_adaptation -> client_adaptation';
  else
    raise notice 'cid_library.vitallyfe_adaptation already renamed (or never existed) — skipping';
  end if;
end $$;
