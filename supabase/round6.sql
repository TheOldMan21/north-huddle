-- North Huddle round 6: security hardening.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once. Run AFTER round5.sql.

-- 1) Write rules (same as round 4) plus:
--    • size caps on everything members can save (no multi-megabyte docs)
--    • profiles: short name/bio, photo must be an https link
--    • requests: only the three kinds the site sends, only as yourself
create or replace function public.can_write(p text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    when exists(select 1 from public.banned where uid = auth.uid()) then false
    when pg_column_size(d) > (case when p ~ '^leagues/[^/]+$' then 400000 when p like 'data/users/%' then 120000 when p like 'scores/%' then 60000 else 20000 end) then false
    when p like 'data/users/' || auth.uid()::text || '/%' then true
    when p = 'profiles/' || auth.uid()::text then length(coalesce(d->>'name','')) <= 40 and length(coalesce(d->>'bio','')) <= 300
         and length(coalesce(d->>'fav','')) <= 60 and (coalesce(d->>'photo','') = '' or d->>'photo' ~ '^https://[^\s"<>]{4,600}$')
    when p = 'scores/'   || auth.uid()::text then true
    when p ~ '^(chat|gamechat|comments)/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
         and length(coalesce(d->>'text','')) <= 500
         and coalesce(d->>'text','') !~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|gg|ly|co|xyz|me|tv|app|link|site|info|biz|ru|cn|shop|live|click)\M)'
    when p ~ '^(reactions|predictions|votes|pickem|ranks)/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
    when p ~ '^leagues/[^/]+$' then coalesce(d->'members','[]'::jsonb) ? auth.uid()::text
    when p ~ '^leagues/[^/]+/chat/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
         and length(coalesce(d->>'text','')) <= 500
         and exists(select 1 from public.docs l where l.path = 'leagues/' || split_part(p,'/',2) and coalesce(l.data->'members','[]'::jsonb) ? auth.uid()::text)
    when p ~ '^requests/(update|team-[a-z]{2,4}|pushtest-[0-9a-f-]{36})$' then coalesce(d->>'by','') = auth.uid()::text
         and coalesce(d->>'kind','') in ('update','team','pushtest')
    else false end;
$$;

-- 2) Leagues: only the commissioner can hand off the commissioner role or remove other members.
--    (Anyone can still leave a league themselves.)
create or replace function public.league_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; boss text; gone text;
begin
  if new.col <> 'leagues' or new.path !~ '^leagues/[^/]+$' or auth.uid() is null or public.is_admin() then return new; end if;
  boss := coalesce(old.data->>'commish','');
  if coalesce(new.data->>'commish','') is distinct from boss and me <> boss then
    raise exception 'Only the commissioner can change the commissioner.';
  end if;
  for gone in select jsonb_array_elements_text(coalesce(old.data->'members','[]'::jsonb))
              except select jsonb_array_elements_text(coalesce(new.data->'members','[]'::jsonb)) loop
    if gone <> me and me <> boss then raise exception 'Only the commissioner can remove members.'; end if;
  end loop;
  return new;
end $$;
drop trigger if exists league_guard on public.docs;
create trigger league_guard before update on public.docs for each row execute function public.league_guard();

-- 3) Locks: nobody can hold an edit lock for more than 30 seconds.
create or replace function public.doc_acquire(p_path text, p_holder text, p_ttl_ms int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null or length(p_path) > 200 or length(p_holder) > 100 then return false; end if;
  insert into public.locks(path, holder, expires)
    values (p_path, p_holder, now() + make_interval(secs => least(greatest(p_ttl_ms, 200), 30000) / 1000.0))
  on conflict (path) do update set holder = excluded.holder, expires = excluded.expires
    where public.locks.expires < now() or public.locks.holder = excluded.holder
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- 4) No more "auto-admin by email": the owner and the bot are already admins. Removing this means nobody can
--    become an admin just by signing up with one of those addresses if an account is ever deleted.
drop trigger if exists on_auth_user_created_admin on auth.users;
drop function if exists public.auto_admin();

-- 5) Guests: ignore junk device codes and cap how fast one code can check in.
create or replace function public.guest_checkin(p_device text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if p_device is null or p_device !~ '^[a-z0-9]{4,32}$' then return null; end if;
  insert into public.guests (device) values (p_device)
    on conflict (device) do update set last_seen = now(), visits = public.guests.visits + case when public.guests.last_seen < now() - interval '20 minutes' then 1 else 0 end
    returning n into v;
  return v;
end $$;

-- 6) Who's an admin is visible only to admins.
drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select using (uid = auth.uid() or public.is_admin());

-- 7) Keep docs.updated_at honest on every change (the admin System tab uses it).
create or replace function public.docs_touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.docs_touch();

-- remember which setup files have run (shown on the admin System tab)
insert into public.docs (path, col, id, data) values ('sys/schema', 'sys', 'schema', jsonb_build_object('round', 6, 'at', now()))
  on conflict (path) do update set data = jsonb_build_object('round', greatest(6, coalesce((public.docs.data->>'round')::int, 0)), 'at', now()), updated_at = now();
