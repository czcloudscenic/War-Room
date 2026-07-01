-- Client Analytics: attribute connected social accounts to a client.
--
-- account_posts (views/engagement) join to connected_accounts, but there was no
-- way to say "this IG account belongs to VitalLyfe." Add a nullable client_id so
-- social metrics roll up per client on the Client Analytics page. Admin sets it
-- per account (an account with no client_id just doesn't attribute to anyone).
--
-- Additive + idempotent. Apply in the Vantus SQL editor (wjcstqqihtebkpyuacop).

alter table public.connected_accounts
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists connected_accounts_client_idx on public.connected_accounts (client_id);
