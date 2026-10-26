-- North Huddle: game-day chat, score predictions, chat reactions.
-- Run AFTER setup.sql and admin.sql. Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

create or replace function public.can_write(p text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_admin() then true
    when exists(select 1 from public.banned where uid = auth.uid()) then false
    when p like 'data/users/' || auth.uid()::text || '/%' then true
    when p = 'profiles/' || auth.uid()::text then true
    when p = 'scores/'   || auth.uid()::text then true
    when p ~ '^(chat|gamechat|reactions|predictions)/[^/]+$' then coalesce(d->>'uid','') = auth.uid()::text
    when p ~ '^leagues/' then true
    when p ~ '^requests/[^/]+$' then true
    else false end;
$$;

-- Faster lookups for game chat and predictions by game.
create index if not exists docs_game_idx on public.docs ((data->>'game')) where col in ('gamechat','predictions');
