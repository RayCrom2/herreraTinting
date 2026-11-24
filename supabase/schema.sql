-- Quote schema v2: quote_requests > quotes > quote_items
--
-- WARNING: this is a fresh start. It DROPS quote_requests, quotes, quote_items, bookings,
-- prices and install_times (if they exist) and everything in them, including the price list.
-- Only run it while the data is test data.

drop table if exists booking_links  cascade;
drop table if exists quote_links    cascade;
drop table if exists bookings       cascade;
drop table if exists quote_items    cascade;
drop table if exists quotes         cascade;
drop table if exists quote_requests cascade;
drop table if exists prices         cascade;
drop table if exists install_times  cascade;

-- 1. The customer's request: who they are, their car, their comment
create table quote_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  first_name      text not null check (char_length(first_name) <= 50),
  last_name       text check (char_length(last_name) <= 100),   -- nullable for Instagram/phone leads
  phone           text check (phone ~ '^\d{10}$'),              -- 10 US digits, normalized by submitQuote

  vehicle_type    text check (vehicle_type in ('coupe', 'sedan', 'suv', 'truck')),
  vehicle_year    int  check (vehicle_year between 1800 and 2100),
  vehicle_make    text check (char_length(vehicle_make) <= 50),
  vehicle_model   text check (char_length(vehicle_model) <= 50),

  -- The customer's answer for the whole car. Staff set removal per window on quote_items.
  removal_request text check (removal_request in ('no', 'yes', 'not-sure')),
  old_tint_condition text[] check (
    old_tint_condition <@ array['peeling','bubbly','faded','blurry_hazy','discolored','fine','other']
    and cardinality(old_tint_condition) > 0
  ),

  source          text not null
                  check (source in ('website', 'instagram', 'phone', 'text', 'other')),

  comment         text check (char_length(comment) <= 500),

  replied_at      timestamptz,                   -- null until staff send the quote(s); lock quotes once set
  check (old_tint_condition is null or removal_request = 'yes')
);

-- 2. A priced option under a request: one per film ('both' on the form creates two)
create table quotes (
  id                uuid primary key default gen_random_uuid(),
  quote_request_id  uuid not null references quote_requests(id) on delete cascade,

  film_type         text check (film_type in ('c2-carbon', 'pronano-ceramic')),  -- null for removal-only jobs
  -- Per request, not per film: savePricing writes the same three values onto every quote.
  -- The total isn't stored; the app adds item install prices + removal_price_cents.
  duration_minutes  int  check (duration_minutes > 0),                          -- total time for the job; null until staff set it
  removal_price_cents int check (removal_price_cents >= 0),                     -- one price for all removal; null if none or not priced yet
  staff_note        text,

  unique (quote_request_id, film_type),         -- no two Ceramic quotes on one request
  unique (id, quote_request_id)                 -- lets quote_links reference (quote, request) as a pair
);

-- at most one removal-only quote (no film) per request
create unique index quotes_one_removal_only
  on quotes (quote_request_id)
  where film_type is null;

-- 3. One row per window area on a quote. Values match windowOptions in app/components/QuoteForm.tsx.
create table quote_items (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null references quotes(id) on delete cascade,

  section           text not null
                    check (section in (
                      'windshield',
                      'sunstrip',
                      'front-sides',
                      'rear-sides',
                      'rear-windshield',
                      'sunroof'
                    )),

  install           boolean not null default true,    -- put new tint on this area
  removal           boolean not null default false,   -- take old tint off; priced once per quote (quotes.removal_price_cents)
  install_price_cents int,                            -- null until staff price it

  check ((install and install_price_cents >= 0) or install_price_cents is null),
  check (install or removal),                         -- a row must do something
  unique (quote_id, section)                          -- each window area appears once per quote
);

-- 4. Lock the tables to server code (service role); no access from the browser
alter table quote_requests enable row level security;
alter table quotes         enable row level security;
alter table quote_items    enable row level security;

grant select, insert, update, delete on public.quote_requests to service_role;
grant select, insert, update, delete on public.quotes         to service_role;
grant select, insert, update, delete on public.quote_items    to service_role;

drop function if exists public.submit_quote_request(text, text, text, text, int, text, text, text, text, text[], text, text[], text[], text);
-- 5. Called by app/actions/submitQuote.ts. Creates the request, one quote per film,
--    and one item per window in a single transaction; any failure rolls back all of it.
create or replace function public.submit_quote_request(
  -- Parameters. Prefix them (p_) so they never clash with column names.
  p_first_name     text,
  p_last_name      text,
  p_phone          text,     -- already normalized to 10 digits in submitQuote
  p_vehicle_type   text,
  p_vehicle_year   int,
  p_vehicle_make   text,
  p_vehicle_model  text,
  p_source         text,
  p_film           text,     -- 'c2-carbon' | 'pronano-ceramic' | 'both' | 'null' (removal only)
  p_windows        text[],   -- e.g. {'front-sides','sunroof'}
  p_removal_request text,     -- 'yes' | 'no' | 'not-sure'
  p_removal_windows text[],   -- e.g. {'front-sides','sunroof'}
  p_old_tint_condition text[], -- e.g {'bubbly', 'blurry_hazy'}
  p_comment        text default null   -- optional, so it goes last
)
returns uuid                    -- the new quote_requests.id
language plpgsql
security invoker                -- runs with the caller's permissions (your secret key)
set search_path = ''            -- forces fully-qualified names (public.table); stops search_path tricks
as $$
declare
  v_request_id  uuid;
  v_quote_id    uuid;
  v_films       text[];         -- 'both' expands to two films
  v_film        text;
begin
    -- Removal Only (no film) has nothing to install; a film needs windows to install on.
  if (p_film is null) <> (coalesce(cardinality(p_windows), 0) = 0) then
    raise exception 'Film and tint windows do not match';
  end if;
  if coalesce(cardinality(p_windows), 0) = 0
    and coalesce(cardinality(p_removal_windows), 0) = 0 then
    raise exception 'At least one window to tint or remove is required';
  end if;



  insert into public.quote_requests (first_name, last_name, phone, vehicle_type, vehicle_year, vehicle_make, vehicle_model, removal_request, old_tint_condition, source, comment)
  values (p_first_name, p_last_name, p_phone, p_vehicle_type, p_vehicle_year, p_vehicle_make, p_vehicle_model, p_removal_request, nullif(p_old_tint_condition, '{}'), p_source, p_comment)
  returning id into v_request_id;

  v_films := case when p_film is null then array[null::text]   -- removal only
             when p_film = 'both' then array['c2-carbon', 'pronano-ceramic']
             else array[p_film] end;


  foreach v_film in array v_films loop
    insert into public.quotes (quote_request_id, film_type)
    values (v_request_id, v_film)
    returning id into v_quote_id;

    -- One item per window.
    insert into public.quote_items (quote_id, section, install, removal)
    select v_quote_id, x, x = any(p_windows), x = any(p_removal_windows)
    from (select distinct unnest(p_windows || p_removal_windows) as x) as s;

  end loop;

  return v_request_id;
end;
$$;

-- Only server code should call it
revoke execute on function public.submit_quote_request(text, text, text, text, int, text, text, text, text, text[], text, text[], text[], text)
  from public, anon, authenticated;
grant execute on function public.submit_quote_request(text, text, text, text, int, text, text, text, text, text[], text, text[], text[], text)
  to service_role;

-- 6. Staff access: logged-in staff (the authenticated role) via app/lib/dal.ts.
--    Sign-ups are disabled, so every authenticated user is staff.

-- Layer 1: grants (which operations are allowed at all)
grant select, insert, update on public.quote_requests to authenticated;
grant select, insert, update, delete on public.quotes      to authenticated;
grant select, insert, update, delete on public.quote_items to authenticated;

-- Layer 2: RLS policies (which rows). Staff can see and work on every row.
create policy "Staff read requests"   on public.quote_requests for select to authenticated using (true);
create policy "Staff add requests"    on public.quote_requests for insert to authenticated with check (true);
create policy "Staff update requests" on public.quote_requests for update to authenticated using (true) with check (true);

create policy "Staff manage quotes"   on public.quotes      for all to authenticated using (true) with check (true);
create policy "Staff manage items"    on public.quote_items for all to authenticated using (true) with check (true);

-- 7. Customer links: the no-login URL a customer opens to see and accept their quote.
--    One live link per request. The URL token is never stored, only its SHA-256 hash,
--    so a leaked table can't be turned back into working links.
create table quote_links (
  id                 uuid primary key default gen_random_uuid(),
  quote_request_id   uuid not null references quote_requests(id) on delete cascade,

  token_hash         text not null unique
                     check (token_hash ~ '^[0-9a-f]{64}$'),   -- hex sha256; rejects a raw token by mistake

  -- What people did. "Expired" isn't a status: a link is expired once expires_at < now().
  status             text not null default 'active'
                     check (status in ('active', 'accepted', 'declined', 'revoked')),
  accepted_quote_id  uuid,                                     -- the film option the customer chose

  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '14 days',

  check ((status = 'accepted') = (accepted_quote_id is not null)),

  -- The accepted quote must belong to this link's own request (skipped while it's null).
  constraint quote_links_accepted_quote_fkey
    foreign key (accepted_quote_id, quote_request_id)
    references quotes (id, quote_request_id)
);

-- at most one live link per request
create unique index quote_links_one_active
  on quote_links (quote_request_id)
  where status = 'active';

alter table quote_links enable row level security;

-- Staff create links (via send_quote), see their status, and revoke them. No delete: keep the history.
grant select, insert, update on public.quote_links to authenticated;
create policy "Staff manage links" on public.quote_links for all to authenticated using (true) with check (true);

-- The customer page and accept action look links up server-side with the secret key.
grant select, update on public.quote_links to service_role;

-- 8. Called by the staff "Send quote" action. Locks the request and creates its link in one
--    transaction; if any check fails, nothing changes.
create or replace function public.send_quote(
  p_request_id  uuid,
  p_token_hash  text      -- sha256 of the URL token, computed in the server action
)
returns uuid              -- the new quote_links.id
language plpgsql
security invoker          -- runs as the calling staff member, so their grants and RLS apply
set search_path = ''
as $$
declare
  v_link_id uuid;
begin
  -- "replied_at is null" makes this a one-time switch: a double click or two staff sending
  -- at once can't both succeed.
  update public.quote_requests
  set replied_at = now()
  where id = p_request_id and replied_at is null;

  if not found then
    raise exception 'Quote request not found or already sent';
  end if;

  -- Every tinted window needs a price.
  if exists (
    select 1
    from public.quote_items i
    join public.quotes q on q.id = i.quote_id
    where q.quote_request_id = p_request_id
      and i.install and i.install_price_cents is null
  ) then
    raise exception 'Not ready to send: every tinted window needs a price';
  end if;

  -- Every quote needs a time, and a removal price if any of its windows have removal.
  if exists (
    select 1
    from public.quotes q
    where q.quote_request_id = p_request_id
      and (q.duration_minutes is null
        or (q.removal_price_cents is null
            and exists (select 1 from public.quote_items i
                        where i.quote_id = q.id and i.removal)))
  ) then
    raise exception 'Not ready to send: the quote needs a time, and a removal price if it includes removal';
  end if;

  insert into public.quote_links (quote_request_id, token_hash)
  values (p_request_id, p_token_hash)
  returning id into v_link_id;

  return v_link_id;
end;
$$;

-- Only logged-in staff can send. (Every authenticated user is staff; see claude/memory.md.)
revoke execute on function public.send_quote(uuid, text) from public, anon;
grant execute on function public.send_quote(uuid, text) to authenticated;



-- 9. Called by the staff "Resend quote" action. Revokes previous quote_link and inserts a 
-- new entry into the table; this allows staff to resend lost or expired quotes.
create or replace function public.resend_quote(
  p_request_id  uuid,
  p_token_hash  text      -- sha256 of the URL token, computed in the server action
)
returns uuid              -- the new quote_links.id
language plpgsql
security invoker          -- runs as the calling staff member, so their grants and RLS apply
set search_path = ''
as $$
declare
  v_link_id uuid;
begin
  -- "replied_at is not null" ensures that this was a quote that was already sent to the client.
  perform 1
  from public.quote_requests
  where id = p_request_id and replied_at is not null
  for update;

  if not found then
    raise exception 'Quote request not found or not sent yet';
  end if;

  -- As long as the quote wasn't already rejected or accepted, a new link is able to be created
  if exists (
    select 1
    from public.quote_links l
    where l.quote_request_id = p_request_id
      and l.status in ('accepted', 'declined')
  ) then
    raise exception 'Customer already responded to this quote';
  end if;

  update public.quote_links l
    set status = 'revoked'
    where l.quote_request_id = p_request_id and l.status = 'active';
  
  insert into public.quote_links (quote_request_id, token_hash)
  values (p_request_id, p_token_hash)
  returning id into v_link_id;

  return v_link_id;
end;
$$;

-- Only logged-in staff can send. (Every authenticated user is staff; see claude/memory.md.)
revoke execute on function public.resend_quote(uuid, text) from public, anon;
grant execute on function public.resend_quote(uuid, text) to authenticated;

-- 10. Default install prices staff start from when pricing a quote. One row per vehicle type, film and window.
--     Removal isn't here: it varies too much, so staff price it by hand.
create table prices (
  vehicle_type      text not null check (vehicle_type in ('coupe', 'sedan', 'suv', 'truck')),
  film_type         text not null check (film_type in ('c2-carbon', 'pronano-ceramic')),
  section           text not null check (section in (
                      'windshield', 'sunstrip', 'side-pair',
                      'rear-windshield', 'sunroof'
                    )),

  install_price_cents       int not null check (install_price_cents >= 0),

  primary key (vehicle_type, film_type, section)
);

alter table prices enable row level security;
grant select on public.prices to authenticated;
create policy "Staff read prices" on public.prices for select to authenticated using (true);

-- 11. Default install time per vehicle type and window. Time doesn't depend on the film,
--     so it's stored once here instead of on every film's row in prices.
create table install_times (
  vehicle_type      text not null check (vehicle_type in ('coupe', 'sedan', 'suv', 'truck')),
  section           text not null check (section in (
                      'windshield', 'sunstrip', 'side-pair',
                      'rear-windshield', 'sunroof'
                    )),

  install_duration_minutes  int not null check (install_duration_minutes > 0),

  primary key (vehicle_type, section)
);

alter table install_times enable row level security;
grant select on public.install_times to authenticated;
create policy "Staff read install times" on public.install_times for select to authenticated using (true);

-- 12. Booking_links, generated after quote is accepted and has a 14 day TTL
--     A foreign key can't check that the parent quote link is 'accepted'; the function
--     that creates a booking link must check quote_links.status = 'accepted' itself.
create table booking_links (
  id                 uuid primary key default gen_random_uuid(),
  quote_link_id      uuid not null references quote_links(id) on delete cascade,
  token_hash         text not null unique
                     check (token_hash ~ '^[0-9a-f]{64}$'),   -- hex sha256; rejects a raw token by mistake
  status             text not null default 'active' check (status in ('active', 'used', 'revoked')),
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '14 days'
  
);
create unique index booking_links_one_active
  on booking_links (quote_link_id)
  where status = 'active';

alter table booking_links enable row level security;

-- Staff see link status and revoke/regenerate links. No delete: keep the history.
grant select, insert, update on public.booking_links to authenticated;
create policy "Staff manage booking links" on public.booking_links for all to authenticated using (true) with check (true);

-- The customer flow runs server-side with the secret key: the accept action creates the
-- link (insert), and the booking page and book action look it up and mark it used.
grant select, insert, update on public.booking_links to service_role;

-- 13. Called by the customer's accept action. Accepts the chosen quote and creates its
--     booking link in one transaction; if the quote link isn't active, nothing changes.
create or replace function public.accept_quote(
  p_quote_link_token_hash  text,      -- sha256 of the quote_link URL token, computed in the server action
  p_quote_id    uuid,
  p_booking_link_token_hash text     -- sha256 of the booking_link URL token, computed in the server action
)
returns uuid              -- the new booking_links.id
language plpgsql
security invoker          -- runs as the caller (service_role via the accept action), so its grants apply
set search_path = ''
as $$
declare
  v_quote_link_id uuid;
  v_booking_link_id uuid;
begin
  update public.quote_links
  set status = 'accepted', accepted_quote_id = p_quote_id
  where token_hash = p_quote_link_token_hash
    and status = 'active'
    and expires_at > now()
  returning id into v_quote_link_id;

  if not found then 
    raise exception 'Quote link is invalid, expired, or already answered';
  end if;
  insert into public.booking_links (quote_link_id, token_hash)
    values (v_quote_link_id, p_booking_link_token_hash)
  returning id into v_booking_link_id;
  
  return v_booking_link_id;

end;
$$;

revoke execute on function public.accept_quote(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_quote(text, uuid, text) to service_role;

-- 14. Add bookings table to represent booking_links being used successfully
create extension if not exists btree_gist;
create table bookings (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  booking_link_id   uuid not null references booking_links(id) on delete restrict unique,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status            text not null default 'scheduled'
                    check (status in ('scheduled', 'cancelled', 'completed', 'no_show')),

  check(ends_at > starts_at),
  exclude using gist (tstzrange(starts_at, ends_at) with &&) where (status = 'scheduled')
);

alter table bookings enable row level security;

-- Staff see bookings and can cancel or mark booking as completed, cancelled, or as a 'no show'. No delete: keep the history.
-- No insert: every booking comes from a customer's booking link via book_appointment.
grant select, update on public.bookings to authenticated;
create policy "Staff manage bookings" on public.bookings for all to authenticated using (true) with check (true);

-- The customer flow runs server-side with the secret key: the book action inserts the
-- booking through book_appointment. Customers never change a booking afterwards.
grant select, insert on public.bookings to service_role;

-- 15. Called by the customer's book action. Uses the booking link and creates the booking
--     in one transaction; if the link isn't active, or the slot is taken or too close to
--     another job, nothing changes.
create or replace function public.book_appointment(
  p_booking_link_token_hash  text,   -- sha256 of the URL token, computed in the server action
  p_date                     date,   -- the calendar day picked, "YYYY-MM-DD"
  p_start_minutes            int     -- minutes after midnight, shop time (540 = 9:00 AM)
)
returns uuid              -- the new bookings.id
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking_link_id uuid;
  v_quote_link_id   uuid;
  v_duration        int;
  v_starts_at       timestamptz;
  v_booking_id      uuid;
begin
  update public.booking_links
  set status = 'used'
  where token_hash = p_booking_link_token_hash
    and status = 'active'
    and expires_at > now()
  returning id, quote_link_id into v_booking_link_id, v_quote_link_id;

  if not found then 
    raise exception 'Booking link is invalid, expired, or already used';
  end if;

  select q.duration_minutes into v_duration
  from public.quote_links l
  join public.quotes q on q.id = l.accepted_quote_id
  where l.id = v_quote_link_id;

  if v_duration is null then
    raise exception 'Accepted quote has no duration';
  end if;

  v_starts_at := (p_date + make_interval(mins => p_start_minutes))
                  at time zone 'America/Los_Angeles';

  -- Customers need 15 minutes between jobs (matches timeBetweenAppointments in lib/booking.ts).
  -- Only this function checks it, so a staff reschedule can still place jobs closer together;
  -- the exclude constraint still stops true overlaps for everyone.
  if exists (
    select 1
    from public.bookings b
    where b.status = 'scheduled'
      and tstzrange(b.starts_at - interval '15 minutes', b.ends_at + interval '15 minutes')
          && tstzrange(v_starts_at, v_starts_at + make_interval(mins => v_duration))
  ) then
    raise exception 'That time slot is already booked'
      using errcode = 'exclusion_violation';
  end if;

  -- The bookings exclude constraint rejects overlapping scheduled bookings. Re-raise with a
  -- readable message but keep the 23P01 code, so the book action can tell "slot taken" apart
  -- from a bad link (P0001). Raising again aborts the whole call, so the link stays active.
  begin
    insert into public.bookings (booking_link_id, starts_at, ends_at)
      values (v_booking_link_id, v_starts_at, v_starts_at + make_interval(mins => v_duration))
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      raise exception 'That time slot is already booked'
        using errcode = 'exclusion_violation';
  end;

  return v_booking_id;
end;
$$;

revoke execute on function public.book_appointment(text, date, int) from public, anon, authenticated;
grant execute on function public.book_appointment(text, date, int) to service_role;
