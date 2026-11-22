import Link from "next/link";

export type CalendarViewName = "Day" | "Week" | "Month";
const VIEWS: CalendarViewName[] = ["Day", "Week", "Month"];

// The bookings URL for a view anchored on a "YYYY-MM-DD" date.
// Month only needs "YYYY-MM"; day and week keep the full date.
export function viewHref(view: CalendarViewName, date: string): string {
  if (view === "Month") return `/staff/bookings?month=${date.slice(0, 7)}`;
  return `/staff/bookings?view=${view.toLowerCase()}&date=${date}`;
}

// The same view with one booking's details open over it. viewUrl comes from viewHref,
// so it always has a "?" already.
export function bookingHref(viewUrl: string, bookingId: string): string {
  return `${viewUrl}&booking=${bookingId}`;
}

// Shared by MonthGrid and TimeGrid. Each grid works out its own prev/next/today links,
// since only it knows how far one step goes (a day, a week, a month).
// md+: arrows + Today, title, toggle on one row. The two side columns are equal (1fr each),
// so the title sits at the true centre even though the arrows and toggle differ in width.
// Phones: title alone on top (order-first + w-full), then arrows/Today and the toggle below.
export default function CalendarHeader({
  title,
  view,
  date,
  prevHref,
  nextHref,
  todayHref,
}: {
  title: string;
  view: CalendarViewName; // the view being shown, highlighted in the toggle
  date: string; // "YYYY-MM-DD" the toggle links keep, so switching views stays near here
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const unit = view.toLowerCase();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 md:grid md:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center rounded border border-zinc-700 text-sm md:justify-self-start">
        <Link
          href={prevHref}
          aria-label={`Previous ${unit}`}
          className="px-3 py-1 hover:bg-zinc-800"
        >
          ‹
        </Link>
        <Link
          href={todayHref}
          className="border-x border-zinc-700 px-3 py-1 hover:bg-zinc-800"
        >
          Today
        </Link>
        <Link
          href={nextHref}
          aria-label={`Next ${unit}`}
          className="px-3 py-1 hover:bg-zinc-800"
        >
          ›
        </Link>
      </div>

      <h2 className="order-first w-full text-center text-xl font-semibold md:order-none md:w-auto">
        {title}
      </h2>

      <nav className="ml-auto flex rounded border border-zinc-700 text-sm md:ml-0 md:justify-self-end">
        {VIEWS.map((x) => (
          <Link
            key={x}
            href={viewHref(x, date)}
            aria-current={x === view ? "page" : undefined}
            className={`px-3 py-1 ${x === view ? "bg-zinc-700 font-semibold" : "hover:bg-zinc-800"}`}
          >
            {x}
          </Link>
        ))}
      </nav>
    </div>
  );
}
