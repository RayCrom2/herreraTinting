import Link from "next/link";
import {
  filmLabels,
  formatMinutes,
  formatMoney,
  formatPhone,
  formatProperNoun,
  sectionLabels,
  sortBySection,
  quoteTotalCents,
} from "@/app/lib/quote";
import { shopDayFormat, shopTimeFormat } from "@/app/lib/schedule";
import type { BookingDetail } from "./calendar";
import DisplayTintCondition from "../components/DisplayTintCondition";

const heading = "text-xs font-semibold uppercase tracking-wide text-zinc-500";

// Server component: the panel is open while ?booking= is in the URL, so closing it is just a
// link back to the same view without it. scroll={false} keeps the calendar where it was.
export default function BookingDetails({
  booking,
  closeHref,
}: {
  booking: BookingDetail;
  closeHref: string;
}) {
  const quote = booking.booking_links.quote_links.quotes;
  const request = quote?.quote_requests;

  const fullName = [request?.first_name, request?.last_name]
    .filter(Boolean)
    .join(" ");
  const items = sortBySection(quote?.quote_items ?? []);
  const installItems = items.filter((item) => item.install);
  const removal = items.some((item) => item.removal);
  const removalSections = items.filter((i) => i.removal).map((i) => i.section);
  const total_price_cents = quote ? quoteTotalCents(quote) : null;
  const label = quote?.film_type
    ? `${filmLabels[quote.film_type] ?? quote.film_type}${removal ? " + removal" : ""}`
    : "Tint removal";

  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-details-title"
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
    >
      {/* The dimmed backdrop is itself the close link, so clicking outside the panel closes it. */}
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close booking details"
        className="absolute inset-0 bg-black/70"
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 md:rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h2 id="booking-details-title" className="text-2xl font-bold">
              {fullName || "Booking"}
            </h2>
            <p className="mt-1 text-sm text-zinc-300">
              {shopDayFormat.format(start)} · {shopTimeFormat.format(start)}–
              {shopTimeFormat.format(end)}
            </p>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Close booking details"
            className="ml-auto rounded-full px-2 text-2xl leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ×
          </Link>
        </div>

        {!quote || !request ? (
          <p className="mt-4 text-zinc-400">
            This booking has no accepted quote.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className={heading}>Vehicle</p>
                <p>
                  {request.vehicle_year}{" "}
                  {formatProperNoun(request.vehicle_make)}{" "}
                  {formatProperNoun(request.vehicle_model)}
                </p>
              </div>
              <div>
                <p className={heading}>Phone</p>
                {request.phone ? (
                  <a
                    href={`tel:+1${request.phone}`}
                    className="text-red-400 hover:underline"
                  >
                    {formatPhone(request.phone)}
                  </a>
                ) : (
                  <p className="text-zinc-500">—</p>
                )}
              </div>
              <div>
                <p className={heading}>Job</p>
                <p className="font-semibold">{label}</p>
              </div>
              {removal && request.old_tint_condition && (
                <div>
                  <p className={heading}>Old tint</p>
                  <DisplayTintCondition
                    currentCondition={request.old_tint_condition}
                  />
                </div>
              )}
            </div>

            <ul className="mt-5 space-y-1 border-t border-zinc-800 pt-3 text-sm">
              {installItems.map((item) => (
                <li key={item.section} className="flex justify-between gap-4">
                  <span>{sectionLabels[item.section] ?? item.section}</span>
                  <span className="tabular-nums">
                    {formatMoney(item.install_price_cents ?? 0)}
                  </span>
                </li>
              ))}
              {removal && (
                <li className="min-w-0 flex-1 flex justify-between relative text-sm">
                  <div>
                    <p className={`text-rose-300`}>Removal</p>
                    <p className="text-zinc-400">
                      {removalSections
                        .map((section) => sectionLabels[section] ?? section)
                        .join(", ")}
                    </p>
                  </div>

                  <span className="tabular-nums my-auto">
                    {quote.removal_price_cents !== null
                      ? formatMoney(quote.removal_price_cents)
                      : "—"}
                  </span>
                </li>
              )}
            </ul>

            <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
              <p className="flex justify-between gap-4 font-bold">
                <span>Total</span>
                <span className="tabular-nums">
                  {total_price_cents !== null
                    ? formatMoney(total_price_cents)
                    : "—"}
                </span>
              </p>

              {quote.duration_minutes !== null && (
                <p className="flex justify-between gap-4 text-sm text-zinc-400">
                  <span>Time</span>
                  <span>{formatMinutes(quote.duration_minutes)}</span>
                </p>
              )}
            </div>

            {request.comment && (
              <div className="mt-5">
                <p className={heading}>Customer note</p>
                <p className="mt-1 whitespace-pre-line wrap-break-word italic text-zinc-300">
                  {request.comment}
                </p>
              </div>
            )}
            {quote.staff_note && (
              <div className="mt-4">
                <p className={heading}>Staff note</p>
                <p className="mt-1 whitespace-pre-line wrap-break-word text-zinc-300">
                  {quote.staff_note}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
