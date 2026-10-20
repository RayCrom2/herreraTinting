-- Quote schema v2: quote_requests > quotes > quote_items
--
-- WARNING: this is a fresh start. It DROPS quote_requests, quotes, quote_items and bookings
-- (if they exist) and everything in them. Only run it while the data is test data.

drop table if exists quote_links    cascade;
drop table if exists bookings       cascade;
drop table if exists quote_items    cascade;
drop table if exists quotes         cascade;
drop table if exists quote_requests cascade;

-- 1. The customer's request: who they are, their car, their comment
create table quote_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  first_name      text not null check (char_length(first_name) <= 50),
  last_name       text check (char_length(last_name) <= 100),   -- nullable for Instagram/phone leads
  phone           text check (phone ~ '^\d{10}$'),              -- 10 US digits, normalized by submitQuote

  vehicle_year    int  check (vehicle_year between 1800 and 2100),
  vehicle_make    text check (char_length(vehicle_make) <= 50),
  vehicle_model   text check (char_length(vehicle_model) <= 50),

  -- The customer's answer for the whole car. Staff set removal per window on quote_items.
  removal_request text check (removal_request in ('no', 'yes', 'not-sure')),

  source          text not null
                  check (source in ('website', 'instagram', 'phone', 'text', 'other')),

  comment         text check (char_length(comment) <= 500),

  replied_at      timestamptz                   -- null until staff send the quote(s); lock quotes once set
);

-- 2. A priced option under a request: one per film ('both' on the form creates two)
create table quotes (
  id                uuid primary key default gen_random_uuid(),
  quote_request_id  uuid not null references quote_requests(id) on delete cascade,

  film_type         text check (film_type in ('c2-carbon', 'pronano-ceramic')),  -- null for removal-only jobs
  total_cost_cents  int  check (total_cost_cents >= 0),                         -- sum of item prices, set by staff
  duration_minutes  int  check (duration_minutes > 0),                          -- sum of item durations, set by staff
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
  removal           boolean not null default false,   -- take old tint off; window was in customer's removal list
  price_cents       int check (price_cents >= 0),     -- null until staff price it
  duration_minutes  int check (duration_minutes > 0), -- null until staff set it

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

-- 5. Called by app/actions/submitQuote.ts. Creates the request, one quote per film,
--    and one item per window in a single transaction; any failure rolls back all of it.
drop function if exists public.submit_quote_request(text, text, text, int, text, text, text, text, text[], text, text);
create or replace function public.submit_quote_request(
  -- Parameters. Prefix them (p_) so they never clash with column names.
  p_first_name     text,
  p_last_name      text,
  p_phone          text,     -- already normalized to 10 digits in submitQuote
  p_vehicle_year   int,
  p_vehicle_make   text,
  p_vehicle_model  text,
  p_source         text,
  p_film           text,     -- 'c2-carbon' | 'pronano-ceramic' | 'both'
  p_windows        text[],   -- e.g. {'front-sides','sunroof'}
  p_removal_request text,     -- 'yes' | 'no' | 'not-sure'
  p_removal_windows text[],   -- e.g. {'front-sides','sunroof'}
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
  if coalesce(cardinality(p_windows), 0) = 0 then
    raise exception 'At least one window is required';
  end if;

  insert into public.quote_requests (first_name, last_name, phone, vehicle_year, vehicle_make, vehicle_model, removal_request, source, comment)
  values (p_first_name, p_last_name, p_phone, p_vehicle_year, p_vehicle_make, p_vehicle_model, p_removal_request, p_source, p_comment)
  returning id into v_request_id;

  v_films := case when p_film = 'both'
                  then array['c2-carbon', 'pronano-ceramic']
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
revoke execute on function public.submit_quote_request(text, text, text, int, text, text, text, text, text[], text, text[], text)
  from public, anon, authenticated;
grant execute on function public.submit_quote_request(text, text, text, int, text, text, text, text, text[], text, text[], text)
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

  -- Every window needs a price and a time before the customer sees it.
  if exists (
    select 1
    from public.quote_items i
    join public.quotes q on q.id = i.quote_id
    where q.quote_request_id = p_request_id
      and (i.price_cents is null or i.duration_minutes is null)
  ) then
    raise exception 'Every window needs a price and time before sending';
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
