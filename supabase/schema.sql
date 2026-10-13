-- Quote schema v2: quote_requests > quotes > quote_items
--
-- WARNING: this is a fresh start. It DROPS quote_requests, quotes, quote_items and bookings
-- (if they exist) and everything in them. Only run it while the data is test data.

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

  unique (quote_request_id, film_type)          -- no two Ceramic quotes on one request
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
  removal           boolean not null default false,   -- take old tint off; true at submit when removal_request = 'yes'
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
  p_removal        text,     -- 'no' | 'yes' | 'not-sure'
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
  values (p_first_name, p_last_name, p_phone, p_vehicle_year, p_vehicle_make, p_vehicle_model, p_removal, p_source, p_comment)
  returning id into v_request_id;

  v_films := case when p_film = 'both'
                  then array['c2-carbon', 'pronano-ceramic']
                  else array[p_film] end;

  foreach v_film in array v_films loop
    insert into public.quotes (quote_request_id, film_type)
    values (v_request_id, v_film)
    returning id into v_quote_id;

    -- One item per window. install defaults to true.
    insert into public.quote_items (quote_id, section, removal)
    select v_quote_id, x, p_removal = 'yes'
    from unnest(p_windows) as x;
  end loop;

  return v_request_id;
end;
$$;

-- Only server code should call it
revoke execute on function public.submit_quote_request(text, text, text, int, text, text, text, text, text[], text, text)
  from public, anon, authenticated;
grant execute on function public.submit_quote_request(text, text, text, int, text, text, text, text, text[], text, text)
  to service_role;
