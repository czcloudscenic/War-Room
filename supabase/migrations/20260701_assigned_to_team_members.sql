-- Repoint content_items.assigned_to FK from profiles(id) -> team_members(id).
--
-- The deliverable "owner" is the editable team roster (team_members), which the
-- Ledger + Operations already resolve against — but the column's FK pointed at
-- profiles(id) (auth logins). That mismatch meant owner assignment never worked.
-- This aligns the schema with the UI so any roster member can own a deliverable,
-- and the roster grows as the team hires.
--
-- Additive + idempotent. Apply in the Supabase SQL editor (wjcstqqihtebkpyuacop).
-- assigned_to has been null in practice (assignment never worked), so no data loss.

-- 1. Clear any orphaned values that wouldn't satisfy the new FK.
update public.content_items
   set assigned_to = null
 where assigned_to is not null
   and assigned_to not in (select id from public.team_members);

-- 2. Drop the old FK (Postgres default constraint name for the column).
alter table public.content_items
  drop constraint if exists content_items_assigned_to_fkey;

-- 3. Add the new FK -> team_members, idempotently.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'content_items_assigned_to_fkey'
      and table_name = 'content_items'
  ) then
    alter table public.content_items
      add constraint content_items_assigned_to_fkey
      foreign key (assigned_to) references public.team_members(id) on delete set null;
  end if;
end $$;
