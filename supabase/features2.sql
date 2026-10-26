-- North Huddle round 2: news comments, polls, phone notification sign-ups.
-- Run AFTER setup.sql, admin.sql and features.sql. Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

create or replace function public.can_write(p text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    when exists(select 1 from public.banned where uid = auth.uid()) then false
    when p like 'data/users/' || auth.uid()::text || '/%' then true
    when p = 'profiles/' || auth.uid()::text then true
    when p = 'scores/'   || auth.uid()::text then true
    when p ~ '^(chat|gamechat|reactions|predictions|comments|votes)/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
    when p ~ '^leagues/' then true
    when p ~ '^requests/[^/]+$' then true
    else false end;
$$;
-- (badges/<uid> and polls/<id> are admin-only: nobody else matches a rule above.)

-- Phone notification sign-ups: each person manages their own; only admins (the alert sender) can read them all.
create table if not exists public.push_subs (
  endpoint text primary key,
  uid uuid not null default auth.uid(),
  sub jsonb not null,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists push_own on public.push_subs;
drop policy if exists push_admin_read on public.push_subs;
drop policy if exists push_admin_del on public.push_subs;
create policy push_own on public.push_subs for all using (uid = auth.uid()) with check (uid = auth.uid());
create policy push_admin_read on public.push_subs for select using (public.is_admin());
create policy push_admin_del on public.push_subs for delete using (public.is_admin());
grant select, insert, update, delete on public.push_subs to authenticated;
