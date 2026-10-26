-- North Huddle database setup. Paste all of this into Supabase → SQL Editor → New query, then tap Run.
-- Safe to run more than once.

-- 1) Tables -------------------------------------------------------------
create table if not exists public.docs (
  path text primary key,           -- e.g. "chat/abc123" or "leagues/XYZ/chat/m1"
  col  text not null,              -- parent collection, e.g. "chat"
  id   text not null,              -- last path segment
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists docs_col_idx on public.docs(col);

create table if not exists public.admins (uid uuid primary key);
create table if not exists public.locks  (path text primary key, holder text not null, expires timestamptz not null);

alter table public.docs   enable row level security;
alter table public.admins enable row level security;
alter table public.locks  enable row level security;

-- 2) Helpers -------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admins where uid = auth.uid());
$$;

-- Who may write a document. Hub data (news, stats, schedule...) is admin/bot only.
create or replace function public.can_write(p text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    when p like 'data/users/' || auth.uid()::text || '/%' then true
    when p = 'profiles/' || auth.uid()::text then true
    when p = 'scores/'   || auth.uid()::text then true
    when p ~ '^chat/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
    when p ~ '^leagues/' then true
    when p ~ '^requests/[^/]+$' then true
    else false end;
$$;

create or replace function public.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; r jsonb;
begin
  if jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then return b; end if;
  r := a;
  for k in select jsonb_object_keys(b) loop
    if r ? k then r := jsonb_set(r, array[k], public.jsonb_deep_merge(r->k, b->k));
    else r := r || jsonb_build_object(k, b->k); end if;
  end loop;
  return r;
end $$;

-- Merge-update (nested objects merge, everything else replaces). Runs with the caller's permissions.
create or replace function public.doc_update(p_path text, p_patch jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update public.docs set data = public.jsonb_deep_merge(data, p_patch), updated_at = now() where path = p_path;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- Short cooperative lease used for league edits.
create or replace function public.doc_acquire(p_path text, p_holder text, p_ttl_ms int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null then return false; end if;
  insert into public.locks(path, holder, expires)
    values (p_path, p_holder, now() + make_interval(secs => greatest(p_ttl_ms, 200) / 1000.0))
  on conflict (path) do update set holder = excluded.holder, expires = excluded.expires
    where public.locks.expires < now() or public.locks.holder = excluded.holder
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- 3) Access rules ---------------------------------------------------------
drop policy if exists docs_read   on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
drop policy if exists admins_read on public.admins;
drop policy if exists admins_write on public.admins;

-- Everyone (even signed out) can read the hub; private settings only by their owner.
create policy docs_read on public.docs for select
  using (path not like 'data/users/%' or path like 'data/users/' || auth.uid()::text || '/%');
create policy docs_insert on public.docs for insert with check (public.can_write(path, data));
create policy docs_update on public.docs for update using (public.can_write(path, data)) with check (public.can_write(path, data));
create policy docs_delete on public.docs for delete using (public.can_write(path, data));
create policy admins_read  on public.admins for select using (true);
create policy admins_write on public.admins for all using (public.is_admin()) with check (public.is_admin());

grant select on public.docs, public.admins to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
grant insert, delete on public.admins to authenticated;
grant execute on function public.doc_update(text, jsonb), public.doc_acquire(text, text, int), public.is_admin() to authenticated;

-- 4) Admins: the site owner and the update bot become admins automatically when they sign up.
create or replace function public.auto_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) in ('krege21@gmail.com', 'huddlebot@northhuddle.app') then
    insert into public.admins(uid) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created_admin on auth.users;
create trigger on_auth_user_created_admin after insert on auth.users
  for each row execute function public.auto_admin();
insert into public.admins(uid)
  select id from auth.users where lower(email) in ('krege21@gmail.com', 'huddlebot@northhuddle.app')
  on conflict do nothing;

-- 5) Live updates ----------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
