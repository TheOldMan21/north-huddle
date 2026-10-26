-- North Huddle: site visit log for the admin Activity tab.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
create table if not exists public.visits (
  id bigserial primary key,
  at timestamptz not null default now(),
  uid uuid,                 -- signed-in member, or null for a guest
  device text not null,     -- random id kept on that phone/computer (no personal info)
  kind text not null default '',   -- "Android phone", "iPhone", "Computer", ...
  app boolean not null default false,  -- opened from the installed app
  team text not null default ''
);
create index if not exists visits_at_idx on public.visits (at desc);
alter table public.visits enable row level security;
drop policy if exists visits_insert on public.visits;
drop policy if exists visits_admin_read on public.visits;
drop policy if exists visits_admin_del on public.visits;
-- anyone can record their own visit (guests can't claim to be a member)
create policy visits_insert on public.visits for insert with check (uid is null or uid = auth.uid());
create policy visits_admin_read on public.visits for select using (public.is_admin());
create policy visits_admin_del on public.visits for delete using (public.is_admin());
grant insert on public.visits to anon, authenticated;
grant usage, select on sequence public.visits_id_seq to anon, authenticated;
grant select, delete on public.visits to authenticated;
