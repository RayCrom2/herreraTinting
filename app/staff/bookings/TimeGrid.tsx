import Link from "next/link";
import CalendarHeader, {
  bookingHref,
  viewHref,
  type CalendarViewName,
} from "./CalendarHeader";
import { addDaysToDateString, shopToday } from "@/app/lib/schedule";
import {
  jobStyle,
  shortName,
  shortTime,
  type PlacedBooking,
  type StaffBooking,
} from "./calendar";
import {
  filmLabels,
  oldTintConditions,
  sectionLabels,
  sortBySection,
} from "@/app/lib/quote";

const calendarRange: { open: number; close: number } = {
  open: 480,
  close: 1140,
};

// Vertical scale: every px position in the grid is (minutes since open) * pxPerMinute.
// Day view is taller so its wider cards can use bigger text (1 hour = 150px vs 90px).
const DAY_PX_PER_MINUTE = 2.5;
const WEEK_PX_PER_MINUTE = 1.5;
const hourMarks: number[] = [];
for (let m = calendarRange.open; m <= calendarRange.close; m += 60)
  hourMarks.push(m);

// Dates are "YYYY-MM-DD" with no time, so format them as UTC midnight or they can shift a day.
const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
});
const narrowWeekdayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "narrow",
});
const monthYearFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

// Same red as today's circle in MonthGrid.
const TODAY = "rounded-full bg-red-600 font-bold text-white";

// Below md: "S" with "22" under it. md and up: "Sunday 11/22". Today gets the red circle/pill.
function DayHeader({
  date,
  detailed,
  isToday,
}: {
  date: string;
  detailed: boolean;
  isToday: boolean;
}) {
  const [, month, day] = date.split("-");
  const d = utcDate(date);
  return (
    <>
      <span className="flex flex-col items-center gap-0.5 leading-tight md:hidden">
        <span>
          {detailed ? weekdayFormat.format(d) : narrowWeekdayFormat.format(d)}
        </span>
        <span
          className={`inline-flex size-6 items-center justify-center ${isToday ? TODAY : ""}`}
        >
          {Number(day)}
        </span>
      </span>
      <span
        className={`hidden px-2.5 py-0.5 md:inline-block ${isToday ? TODAY : ""}`}
      >
        {weekdayFormat.format(d)} {Number(month)}/{Number(day)}
      </span>
    </>
  );
}
// One booking block. Day view (detailed) gets one wide card at every screen size. Week view
// renders two versions in the same spot: a full card from md up, and a compact block below md
// where a week column is only ~40px wide.
function DisplayBooking({
  placed,
  detailed,
  pxPerMinute,
  viewUrl,
}: {
  placed: PlacedBooking<StaffBooking>;
  detailed: boolean;
  pxPerMinute: number;
  viewUrl: string; // the view being shown, so the details panel opens over it
}) {
  const { booking, startMinutes, endMinutes } = placed;
  const quote = booking.booking_links.quote_links.quotes;
  const request = quote?.quote_requests;

  const removal = quote?.quote_items.some((q) => q.removal) ?? false;
  // "Front Sides, Rear Sides", front of the car to back, for the windows getting each kind of work.
  const items = sortBySection(quote?.quote_items ?? []);
  const windows = (kind: "install" | "removal") =>
    items
      .filter((i) => i[kind])
      .map((i) => sectionLabels[i.section] ?? i.section)
      .join(", ");
  const tintWindows = windows("install");
  const removalWindows = windows("removal");
  const label = quote?.film_type
    ? `${filmLabels[quote.film_type] ?? quote.film_type}${removal ? " + removal" : ""}`
    : "Tint removal";
  const condition = oldTintConditions.find(
    (c) => c.value === request?.old_tint_condition,
  )?.label;
  const fullName = [request?.first_name, request?.last_name]
    .filter(Boolean)
    .join(" ");
  const detailsHref = bookingHref(viewUrl, booking.id);
  const time = `${shortTime(startMinutes)}–${shortTime(endMinutes)}`;

  // Shared by both versions: colour, position from the time math, and clipping.
  const block = `absolute inset-x-1 min-h-11 overflow-hidden rounded text-left text-zinc-950 ${jobStyle(quote?.film_type).bgColor}`;
  const position = {
    top: `${(startMinutes - calendarRange.open) * pxPerMinute}px`,
    height: `${(endMinutes - startMinutes) * pxPerMinute}px`,
  };

  // Makes the whole box open the booking's details. A link can't wrap the tel: link (no links
  // inside links), so this empty one covers the box instead, and the phone link sits above it (z-10).
  const coverLink = (
    <Link
      href={detailsHref}
      scroll={false}
      aria-label={`Open details for ${fullName || "this booking"}`}
      className="absolute inset-0"
    />
  );
  const phoneLink = request?.phone && (
    <a
      href={`tel:${request.phone}`}
      className="relative z-10 block w-fit hover:underline"
    >
      {request.phone}
    </a>
  );

  // Day view: the column is the full width, so spread details sideways in labelled columns.
  // Full-strength text (no opacity) on the coloured background for readability.
  if (detailed) {
    const heading =
      "text-[11px] font-semibold uppercase tracking-wide text-zinc-800";
    return (
      <div
        className={`${block} border-l-4 border-zinc-950/30 p-3 text-sm hover:brightness-110 md:px-4 md:text-base`}
        style={position}
      >
        {coverLink}
        <div className="flex items-baseline gap-3">
          <p className="truncate text-lg font-bold md:text-2xl">
            {fullName || "Booking"}
          </p>
          <p className="ml-auto shrink-0 font-semibold">{time}</p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-6 md:grid-cols-3">
          <div className="min-w-0">
            <p className={heading}>Job</p>
            <p className="truncate font-semibold">{label}</p>
            {phoneLink}
          </div>
          <div className="min-w-0">
            <p className={heading}>Windows</p>
            {tintWindows && <p className="truncate">Tint: {tintWindows}</p>}
            {removalWindows && (
              <p className="truncate">Remove: {removalWindows}</p>
            )}
            {removal && condition && (
              <p className="truncate">Old tint: {condition}</p>
            )}
          </div>
          {/* Third column only from md; on a phone two columns is already tight. */}
          {request?.comment && (
            <div className="hidden min-w-0 md:block">
              <p className={heading}>Note</p>
              <p className="line-clamp-3 italic">{request.comment}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: everything useful at a glance; coverLink makes the whole box clickable. */}
      <div
        className={`${block} hidden space-y-0.5 p-1.5 text-xs hover:brightness-110 md:block`}
        style={position}
      >
        {coverLink}
          <p className="ml-auto shrink-0 font-semibold opacity-75">{time}</p>
          <p className="truncate font-semibold">{fullName || "Booking"}</p>

        <p className="truncate">{label}</p>
        {phoneLink}
        {removal && condition && (
          <p className="truncate">Old tint: {condition}</p>
        )}
        {tintWindows && (
          <p className="" title={tintWindows}>
            Tint: {tintWindows}
          </p>
        )}
        {removalWindows && (
          <p className="truncate" title={removalWindows}>
            Remove: {removalWindows}
          </p>
        )}
      </div>

      {/* Mobile: colour + first name only; the whole block opens the booking's details. */}
      <Link
        href={detailsHref}
        scroll={false}
        className={`${block} px-0.5 pt-0.5 text-[10px] leading-tight font-medium md:hidden`}
        style={position}
      >
        <span className="block break-words">{shortName(booking)}</span>
      </Link>
    </>
  );
}

// 540 -> "9 AM", 720 -> "12 PM", 780 -> "1 PM"
function hourLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

// Width of the hour-label column on the left.
const GUTTER = "3rem";

// "November 2026", or "November 2026 – December 2026" when a week crosses months.
function rangeTitle(days: string[]): string {
  const first = monthYearFormat.format(utcDate(days[0]));
  const last = monthYearFormat.format(utcDate(days[days.length - 1]));
  return first === last ? first : `${first} – ${last}`;
}

export default function TimeGrid({
  days,
  byDay,
  date,
}: {
  days: string[];
  byDay: Map<string, PlacedBooking<StaffBooking>[]>;
  date: string;
}) {
  // One column has room for the wide card; seven don't.
  const detailed = days.length === 1;
  const pxPerMinute = detailed ? DAY_PX_PER_MINUTE : WEEK_PX_PER_MINUTE;
  const gridHeight = (calendarRange.close - calendarRange.open) * pxPerMinute;

  // Arrows move by one day in day view, one week in week view, staying in the same view.
  const view: CalendarViewName = detailed ? "Day" : "Week";
  const step = detailed ? 1 : 7;
  const prevHref = viewHref(view, addDaysToDateString(date, -step));
  const nextHref = viewHref(view, addDaysToDateString(date, step));
  const today = shopToday(); // "YYYY-MM-DD" in shop time, same format as days[]
  const todayHref = viewHref(view, today);
  const viewUrl = viewHref(view, date);

  // Header row and body share this so their columns line up: label gutter + one column per day.
  const columns = {
    gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0, 1fr))`,
  };

  return (
    <div className={`mx-auto ${detailed ? "max-w-5xl" : "max-w-7xl"} md:px-4`}>
      <CalendarHeader
        title={rangeTitle(days)}
        view={view}
        date={date}
        prevHref={prevHref}
        nextHref={nextHref}
        todayHref={todayHref}
      />

      <div className="grid text-center text-sm font-medium" style={columns}>
        {/* Empty cell above the hour labels */}
        <div />
        {days.map((d) => (
          <div key={d} className="px-2 py-2">
            <DayHeader date={d} detailed={detailed} isToday={d === today} />
          </div>
        ))}
      </div>

      <div className="grid text-center relative" style={columns}>
        {/* Hour lines span the day columns only, starting after the gutter. */}
        {hourMarks.map((m) => (
          <div
            key={m}
            className="absolute right-0 border-t border-zinc-800"
            style={{
              left: GUTTER,
              top: `${(m - calendarRange.open) * pxPerMinute}px`,
            }}
          />
        ))}

        {/* Gutter: each label is centred vertically on its line. */}
        <div className="relative" style={{ height: `${gridHeight}px` }}>
          {hourMarks.map((m) => (
            <span
              key={m}
              className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-xs text-gray-500"
              style={{ top: `${(m - calendarRange.open) * pxPerMinute}px` }}
            >
              {hourLabel(m)}
            </span>
          ))}
        </div>

        {days.map((d) => {
          return (
            <div
              key={d}
              className={`px-4 border border-zinc-800 relative`}
              style={{
                height: `${gridHeight}px`,
              }}
            >
              {(byDay.get(d) ?? []).map((p) => (
                <DisplayBooking
                  key={p.booking.id}
                  placed={p}
                  detailed={detailed}
                  pxPerMinute={pxPerMinute}
                  viewUrl={viewUrl}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
