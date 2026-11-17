-- North Huddle round 5: numbered guests (Guest 1, Guest 2, …) that stay the same on a returning device.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
create table if not exists public.guests (
  device text primary key,                    -- the random code the site keeps on that phone/computer
  n bigserial unique,                         -- guest number, in order of first visit
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  visits int not null default 1
);
alter table public.guests enable row level security;
drop policy if exists guests_admin_read on public.guests;
create policy guests_admin_read on public.guests for select using (public.is_admin());
grant select on public.guests to authenticated;

-- give every guest who has already visited a number, oldest first
insert into public.guests (device, first_seen, last_seen, visits)
select device, min(at), max(at), count(*) from public.visits
where uid is null and device ~ '^[a-z0-9]{4,32}$'
group by device order by min(at)
on conflict (device) do nothing;

-- the site calls this once per visit for guests: returns their number (creating it the first time)
create or replace function public.guest_checkin(p_device text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if p_device is null or p_device !~ '^[a-z0-9]{4,32}$' then return null; end if;
  insert into public.guests (device) values (p_device)
    on conflict (device) do update set last_seen = now(), visits = public.guests.visits + 1
    returning n into v;
  return v;
end $$;
revoke all on function public.guest_checkin(text) from public;
grant execute on function public.guest_checkin(text) to anon, authenticated;

-- remember which setup files have run (shown on the admin System tab)
insert into public.docs (path, col, id, data) values ('sys/schema', 'sys', 'schema', jsonb_build_object('round', 5, 'at', now()))
  on conflict (path) do update set data = jsonb_build_object('round', greatest(5, coalesce((public.docs.data->>'round')::int, 0)), 'at', now()), updated_at = now();
