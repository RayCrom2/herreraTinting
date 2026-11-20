import { Suspense } from "react";
import { requireStaff } from "../../lib/dal";
import { shopToday, addDaysToDateString } from "../../lib/schedule";
import { isValidDateString, isValidYearAndMonth } from "@/app/lib/validation";
import { groupByShopDay, type StaffBooking } from "./calendar";
import MonthGrid from "./MonthGrid";
import TimeGrid from "./TimeGrid";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
type CalendarView =
  | { view: "month"; month: string } // "YYYY-MM"
  | { view: "week"; date: string } // "YYYY-MM-DD" (starts at corrseponding sunday)
  | { view: "day"; date: string }; // "YYYY-MM-DD"

// Static shell renders instantly; anything reading the session, the URL or the database
// streams in behind <Suspense>. searchParams is passed down still unopened: awaiting it
// here would make the whole page dynamic.
export default function BookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={
        <p className="mx-auto mt-4 max-w-7xl text-zinc-400 md:px-4">
          Loading bookings...
        </p>
      }
    >
      <BookingsCalendar searchParams={searchParams} />
    </Suspense>
  );
}

// A query value is a string[] when the key repeats (?date=a&date=b); treat that as missing.
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Turns the raw query into a CalendarView. Anything missing or invalid falls back:
//   ?view=day&date=2026-11-24  -> { view: "day", date: "2026-11-24" }
//   ?view=week&date=2026-11-24 -> { view: "week", date: "2026-11-24" } (visibleDateRange snaps to Sunday)
//   ?month=2026-11             -> { view: "month", month: "2026-11" }
//   day/week with a bad date   -> that view for today at the shop
//   anything else              -> the current month at the shop
function parseView(params: Awaited<SearchParams>): CalendarView {
  const view = single(params.view);
  const today = shopToday();

  if (view === "day" || view === "week") {
    const date = single(params.date);
    return { view, date: date && isValidDateString(date) ? date : today };
  }

  const month = single(params.month);
  return {
    view: "month",
    month: month && isValidYearAndMonth(month) ? month : today.slice(0, 7),
  };
}

function visibleDateRange(cal: CalendarView): { start: string; end: string } {
  if (cal.view === "day" || cal.view === "week") {
    const day = cal.date;
    const dayOfWeek = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (cal.view === "day") return { start: day, end: day };
    return {
      start: addDaysToDateString(day, -dayOfWeek),
      end: addDaysToDateString(day, 6 - dayOfWeek),
    };
  }
  // Month: the Sunday on or before the 1st through the Saturday on or after the last day.
  const first = `${cal.month}-01`;
  const firstWeekday = new Date(`${first}T00:00:00Z`).getUTCDay();

  // Day 0 of next month rolls back to the last day of this month (handles 28–31 and leap years).
  const last = new Date(`${first}T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);

  return {
    start: addDaysToDateString(first, -firstWeekday),
    end: addDaysToDateString(
      last.toISOString().slice(0, 10),
      6 - last.getUTCDay(),
    ),
  };
}

// Every date from start to end, inclusive. ISO "YYYY-MM-DD" strings sort like dates, so <= works.
function buildDays(range: { start: string; end: string }): string[] {
  const days: string[] = [];
  for (
    let day = range.start;
    day <= range.end;
    day = addDaysToDateString(day, 1)
  ) {
    days.push(day);
  }
  return days;
}

async function BookingsCalendar({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requireStaff();
  const cal = parseView(await searchParams);
  const range = visibleDateRange(cal);

  // The range is in shop days, but starts_at is a UTC instant, and Pacific is UTC-8 or UTC-7.
  // Pad one day on each side so no booking near midnight is missed; rangeEnd is exclusive
  // (the day after range.end, plus the pad). Step 2's grouping by toShopTime() drops the extras.
  const rangeStart = `${addDaysToDateString(range.start, -1)}T00:00:00Z`;
  const rangeEnd = `${addDaysToDateString(range.end, 2)}T00:00:00Z`;

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      `id, starts_at, ends_at, booking_links  (
      quote_links ( quotes(film_type, quote_items(section, install, removal), quote_requests(id, first_name, last_name, phone, old_tint_condition, comment))))`,
    )
    .eq(`status`, "scheduled")
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .order("starts_at");

  if (error) throw new Error(`Failed to load bookings: ${error.message}`);

  // The client has no generated schema types, so it guesses every embed is an array.
  // These are all to-one links, which PostgREST returns as objects: StaffBooking is the real shape.
  const byDay = groupByShopDay(bookings as unknown as StaffBooking[], range);
  if (cal.view === "day" || cal.view === "week") {
    return <TimeGrid days={buildDays(range)} byDay={byDay} date={cal.date} />;
  }
  return <MonthGrid month={cal.month} range={range} byDay={byDay} />;
}
