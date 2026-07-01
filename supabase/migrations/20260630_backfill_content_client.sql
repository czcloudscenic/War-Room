-- Backfill orphaned content_items.client_id → VitalLyfe.
--
-- ROOT CAUSE of "all clients share the same data": the original multi-tenant
-- backfill (20260523_clients_multitenant.sql) only ran "if the VitalLyfe dev seed
-- row exists" — in prod it didn't match, so it was SKIPPED and legacy content kept
-- client_id = NULL. NULL matches no client, so every client's scoped filter returns
-- the same empty set. All pre-multi-tenant content belonged to VitalLyfe, so assign
-- every orphaned row to the VitalLyfe client.
--
-- Safe + idempotent: only touches rows where client_id IS NULL. No-op once clean.

do $$
declare vl_id uuid; n int;
begin
  select id into vl_id
    from public.clients
   where slug ilike '%vital%' or name ilike '%vital%'
   order by created_at nulls last
   limit 1;

  if vl_id is null then
    raise notice 'No VitalLyfe client found — backfill skipped. Create/identify the client, then set client_id manually.';
  else
    update public.content_items set client_id = vl_id where client_id is null;
    get diagnostics n = row_count;
    raise notice 'Backfilled % orphaned content_items to VitalLyfe (%).', n, vl_id;
  end if;
end $$;

-- Verify after running:
-- select c.name, count(ci.*) from public.content_items ci
--   join public.clients c on c.id = ci.client_id group by c.name order by 2 desc;
