-- North Huddle admin page support. Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- Banned members can still read the site but can't post, chat or play.
create table if not exists public.banned (uid uuid primary key, at timestamptz not null default now());
alter table public.banned enable row level security;
drop policy if exists banned_read on public.banned;
drop policy if exists banned_write on public.banned;
create policy banned_read  on public.banned for select using (true);
create policy banned_write on public.banned for all using (public.is_admin()) with check (public.is_admin());
grant select on public.banned to anon, authenticated;
grant insert, delete on public.banned to authenticated;

-- Same write rules as before, plus: banned members can't write anything.
create or replace function public.can_write(p text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    when exists(select 1 from public.banned where uid = auth.uid()) then false
    when p like 'data/users/' || auth.uid()::text || '/%' then true
    when p = 'profiles/' || auth.uid()::text then true
    when p = 'scores/'   || auth.uid()::text then true
    when p ~ '^chat/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
    when p ~ '^leagues/' then true
    when p ~ '^requests/[^/]+$' then true
    else false end;
$$;

-- Member list for the admin page (admins only).
create or replace function public.admin_users()
returns table(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, name text, photo text, is_admin boolean, banned boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           coalesce(nullif(d.data->>'name',''), u.raw_user_meta_data->>'name', ''),
           coalesce(d.data->>'photo', ''),
           exists(select 1 from public.admins a where a.uid = u.id),
           exists(select 1 from public.banned b where b.uid = u.id)
    from auth.users u
    left join public.docs d on d.path = 'profiles/' || u.id::text
    order by u.created_at desc;
end $$;
revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;
