-- North Huddle round 4: feedback inbox + security tightening.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once. Run AFTER round3.sql.

-- 1) Feedback inbox ----------------------------------------------------------
-- Anyone (signed in or not) can send feedback; only admins can read, mark read, or delete it.
create table if not exists public.feedback (
  id bigserial primary key,
  at timestamptz not null default now(),
  uid uuid,                                   -- member who sent it, or null for a guest
  name text not null default '',
  contact text not null default '',           -- optional email so the owner can reply
  kind text not null default 'idea',          -- idea | bug | other
  text text not null,
  page text not null default '',              -- which tab they were on
  device text not null default '',
  status text not null default 'new'          -- new | read | done
);
create index if not exists feedback_at_idx on public.feedback (at desc);
alter table public.feedback enable row level security;
drop policy if exists feedback_insert on public.feedback;
drop policy if exists feedback_admin_read on public.feedback;
drop policy if exists feedback_admin_update on public.feedback;
drop policy if exists feedback_admin_delete on public.feedback;
create policy feedback_insert on public.feedback for insert with check (
  (uid is null or uid = auth.uid())
  and length(text) between 3 and 2000
  and length(name) <= 60 and length(contact) <= 120 and length(page) <= 40 and length(device) <= 40
  and kind in ('idea','bug','other')
  and status = 'new'
  and not exists (select 1 from public.banned b where b.uid = auth.uid())
);
create policy feedback_admin_read   on public.feedback for select using (public.is_admin());
create policy feedback_admin_update on public.feedback for update using (public.is_admin()) with check (public.is_admin());
create policy feedback_admin_delete on public.feedback for delete using (public.is_admin());
grant insert on public.feedback to anon, authenticated;
grant usage, select on sequence public.feedback_id_seq to anon, authenticated;
grant select, update, delete on public.feedback to authenticated;

-- flood guard: at most 5 messages per member (or 20 from guests overall) in 10 minutes
create or replace function public.feedback_flood() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.uid is not null then
    if (select count(*) from public.feedback where uid = new.uid and at > now() - interval '10 minutes') >= 5 then
      raise exception 'Too many messages. Try again in a few minutes.';
    end if;
  else
    if (select count(*) from public.feedback where uid is null and at > now() - interval '10 minutes') >= 20 then
      raise exception 'Too many messages. Try again in a few minutes.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists feedback_flood on public.feedback;
create trigger feedback_flood before insert on public.feedback for each row execute function public.feedback_flood();

-- 2) Write rules (same as round 3, plus): ------------------------------------
--    • leagues: only that league's members can change it (creating = you must be the commissioner and a member)
--    • league chat: members only, and only as yourself
--    • chat / comments: 500-character cap
create or replace function public.can_write(p text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    when exists(select 1 from public.banned where uid = auth.uid()) then false
    when p like 'data/users/' || auth.uid()::text || '/%' then true
    when p = 'profiles/' || auth.uid()::text then true
    when p = 'scores/'   || auth.uid()::text then true
    when p ~ '^(chat|gamechat|comments)/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
         and length(coalesce(d->>'text','')) <= 500
         and coalesce(d->>'text','') !~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|gg|ly|co|xyz|me|tv|app|link|site|info|biz|ru|cn|shop|live|click)\M)'
    when p ~ '^(reactions|predictions|votes|pickem|ranks)/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
    when p ~ '^leagues/[^/]+$' then coalesce(d->'members','[]'::jsonb) ? auth.uid()::text
    when p ~ '^leagues/[^/]+/chat/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
         and length(coalesce(d->>'text','')) <= 500
         and exists(select 1 from public.docs l where l.path = 'leagues/' || split_part(p,'/',2) and coalesce(l.data->'members','[]'::jsonb) ? auth.uid()::text)
    when p ~ '^requests/[^/]+$' then true
    else false end;
$$;

-- joining an open league: the league (before your change) must still be setting up and have room
create or replace function public.league_joinable(p text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and p ~ '^leagues/[^/]+$'
    and not exists(select 1 from public.banned where uid = auth.uid())
    and coalesce(d->>'status','') = 'setup'
    and jsonb_array_length(coalesce(d->'members','[]'::jsonb)) < coalesce((d->>'size')::int, 0);
$$;

drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;
create policy docs_update on public.docs for update
  using (public.can_write(path, data) or public.league_joinable(path, data))
  with check (public.can_write(path, data));
-- deleting a whole league: commissioner (or admin) only
create policy docs_delete on public.docs for delete using (
  case when path ~ '^leagues/[^/]+$' then public.is_admin() or (data->>'commish' = auth.uid()::text and not exists(select 1 from public.banned where uid = auth.uid()))
       else public.can_write(path, data) end
);

-- 3) Update requests: must be sent as yourself, one per member per minute ---------------
create table if not exists public.req_log (uid uuid primary key, at timestamptz not null default now());
alter table public.req_log enable row level security;
create or replace function public.request_cooldown() returns trigger
language plpgsql security definer set search_path = public as $$
declare last timestamptz;
begin
  if new.col <> 'requests' or auth.uid() is null or public.is_admin() then return new; end if;
  if coalesce(new.data->>'by','') <> auth.uid()::text then raise exception 'Requests must be sent as yourself.'; end if;
  if coalesce(new.data->>'kind','') = 'pushtest' then return new; end if;
  select at into last from public.req_log where uid = auth.uid();
  if last is not null and last > now() - interval '60 seconds' then
    raise exception 'Please wait a minute before asking for another update.';
  end if;
  insert into public.req_log(uid, at) values (auth.uid(), now()) on conflict (uid) do update set at = excluded.at;
  return new;
end $$;
drop trigger if exists request_cooldown on public.docs;
create trigger request_cooldown before insert or update on public.docs for each row execute function public.request_cooldown();
