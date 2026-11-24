import Link from "next/link";
import {
  addDaysToDateString,
  shopToday,
  appointmentSlotsByDay,
  minutesTo12HourTime,
} from "@/app/lib/schedule";
import {
  jobStyle,
  shortName,
  shortTime,
  type PlacedBooking,
  type StaffBooking,
} from "./calendar";
import CalendarHeader, { bookingHref, viewHref } from "./CalendarHeader";
import { shortBookingTime } from "@/app/lib/booking";

// "2026-11" + 1 -> "2026-12", "2026-01" - 1 -> "2025-12". Day 1 of the month, so no day overflow.
function addMonths(month: string, n: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const inCurrentMonth = (date: string, month: string): boolean =>
  date.slice(0, 7) === month;
const dayNumber = (date: string): number => Number(date.slice(-2));
const isClosed = (date: string): boolean =>
  appointmentSlotsByDay[new Date(`${date}T00:00:00Z`).getUTCDay()].length === 0;
const getMonthName = (month: string) => {
  const idx = Number(month.split("-")[1]);
  return MONTHS[idx - 1];
};

// "Tue, Nov 24" for a "YYYY-MM-DD" string. UTC in and out, so no zone can shift the day.
const agendaDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

// Server component: just markup and links, no client state. Clicking a day changes the URL,
// and the page re-renders as the day view (see BookingsCalendar).
export default function MonthGrid({
  month,
  range,
  byDay,
}: {
  month: string; // "YYYY-MM", the month being shown
  range: { start: string; end: string }; // from visibleDateRange: a Sunday through a Saturday, inclusive
  byDay: Map<string, PlacedBooking<StaffBooking>[]>;
}) {
  // Every date the grid shows, in order. Always 28, 35 or 42 of them, starting on a Sunday.
  const days: string[] = [];
  for (let d = range.start; d <= range.end; d = addDaysToDateString(d, 1)) {
    days.push(d);
  }

  const today = shopToday();
  // "November 2026": the year matters once you can page across December/January.
  const monthTitle = `${getMonthName(month)} ${month.slice(0, 4)}`;
  // Day/Week from the toggle land on today if it's in this month, otherwise the 1st.
  const anchorDate = inCurrentMonth(today, month) ? today : `${month}-01`;
  const viewUrl = viewHref("Month", `${month}-01`);

  // Dates in this month (not the spill-over) that have bookings, in order, for the mobile agenda.
  const agendaDays = days.filter(
    (d) => inCurrentMonth(d, month) && byDay.has(d),
  );

  return (
    <div className="mx-auto max-w-7xl md:px-4 grid">
      <CalendarHeader
        title={monthTitle}
        view="Month"
        date={anchorDate}
        prevHref={viewHref("Month", `${addMonths(month, -1)}-01`)}
        nextHref={viewHref("Month", `${addMonths(month, 1)}-01`)}
        todayHref={viewHref("Month", today)}
      />
      {/* Header row: Sun … Sat. Single letters on phones, where a column is ~45px wide. */}
      <div className="grid grid-cols-7 pb-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-500">
        {WEEKDAYS.map((name) => (
          <div key={name}>
            <span className="md:hidden">{name[0]}</span>
            <span className="hidden md:inline">{name}</span>
          </div>
        ))}
      </div>

      {/* The days. grid-cols-7 wraps them into weeks, so no need to split them into rows.
          The grid lines are the zinc background showing through a 1px gap between cells. */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-zinc-800 bg-zinc-800">
        {days.map((date) => {
          const dayNo = dayNumber(date);
          const inMonth = inCurrentMonth(date, month);
          const dayIsToday = date === today;
          const closed = isClosed(date);
          const dayBookings = byDay.get(date) ?? [];
          const hasShortBooking = dayBookings.find(
            (b) => b.endMinutes - b.startMinutes < shortBookingTime,
          );
          return (
            <div
              key={date}
              className={`min-h-16 p-1 md:min-h-28 md:p-2 ${
                closed ? "bg-zinc-900/60" : "bg-background"
              } ${inMonth ? "" : "text-zinc-600"} ${hasShortBooking ? "max-md:border max-md:border-red-600" : ""}`}
            >
              <Link
                href={`/staff/bookings?view=day&date=${date}`}
                aria-label={date}
                className={`inline-flex size-7 items-center justify-center rounded-full text-sm transition-colors ${
                  dayIsToday
                    ? "bg-red-600 font-bold text-white hover:bg-red-500"
                    : "hover:bg-zinc-800"
                }`}
              >
                {dayNo}
              </Link>
              {/* Desktop: one truncated line per booking (at most two a day: two slots).
                  Each opens that booking's details over the month. */}
              <ul className="mt-1 hidden space-y-1 md:block">
                {dayBookings.map(({ booking, startMinutes, endMinutes }) => {
                  const job = jobStyle(
                    booking.booking_links.quote_links.quotes?.film_type,
                  );
                  const isShortBooking =
                    endMinutes - startMinutes <= shortBookingTime;

                  return (
                    <li key={booking.id}>
                      <Link
                        href={bookingHref(viewUrl, booking.id)}
                        scroll={false}
                        className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-zinc-800 ${isShortBooking ? "border border-red-600" : ""}`}
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${job.bgColor}`}
                        />
                        <span className="truncate">
                          <span className="text-zinc-400">
                            {shortTime(startMinutes)}
                          </span>{" "}
                          {shortName(booking)} · {job.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Mobile: a dot per booking; tapping the day number opens the day view. */}
              {dayBookings.length > 0 && (
                <div className="mt-1 flex justify-center gap-1 md:hidden">
                  {dayBookings.map(({ booking, startMinutes, endMinutes }) => {
                    return (
                      <span
                        key={booking.id}
                        aria-hidden
                        className={`size-1.5 rounded-full ${
                          jobStyle(
                            booking.booking_links.quote_links.quotes?.film_type,
                          ).bgColor
                        }`}
                      />
                    );
                  })}
                  <span className="sr-only">
                    {dayBookings.length} booking
                    {dayBookings.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile agenda: this month's bookings as a list, since the cells only fit dots. */}
      <div className="mt-6 md:hidden">
        {agendaDays.length === 0 ? (
          <p className="text-sm text-zinc-400">No bookings this month.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
            {agendaDays.map((date) => (
              <li key={date} className="py-3">
                <Link
                  href={`/staff/bookings?view=day&date=${date}`}
                  className={`text-sm font-semibold hover:text-red-400 ${
                    date === today ? "text-red-400" : ""
                  }`}
                >
                  {agendaDayFormat.format(new Date(`${date}T00:00:00Z`))}
                </Link>
                <ul className="mt-1 space-y-1">
                  {(byDay.get(date) ?? []).map(({ booking, startMinutes }) => {
                    const quote = booking.booking_links.quote_links.quotes;
                    const job = jobStyle(quote?.film_type);
                    // A film job that also takes old tint off reads "Ceramic + removal".
                    // Removal-only jobs are already labelled "Removal".
                    const withRemoval =
                      quote?.film_type &&
                      quote.quote_items.some((item) => item.removal);
                    return (
                      <li
                        key={booking.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${job.bgColor}`}
                        />
                        <span className="w-16 shrink-0 text-zinc-400">
                          {minutesTo12HourTime(startMinutes)}
                        </span>
                        <span className="truncate">
                          {shortName(booking)} · {job.label}
                          {withRemoval && " + removal"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
