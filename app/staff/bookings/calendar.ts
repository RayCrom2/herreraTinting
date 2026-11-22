import { toShopTime } from "@/app/lib/schedule";

// One row of the staff bookings query in page.tsx. Keep it in step with that select:
// a field added there needs adding here (and vice versa), since nothing checks the two match.
// Each embed is a to-one link (the FK lives on the outer table), so PostgREST returns an
// object, not an array. Nullable fields follow schema.sql.
export type StaffBooking = {
  id: string;
  starts_at: string; // timestamptz as ISO text
  ends_at: string;
  booking_links: {
    quote_links: {
      // accepted_quote_id is nullable in the schema; a booked link was always accepted
      // (accept_quote sets it), but the type can't know that, so null is kept honest.
      quotes: {
        film_type: string | null; // null = removal-only job; label with filmLabels
        // One row per window on the quote: install = gets new film, removal = old tint comes off.
        quote_items: { section: string; install: boolean; removal: boolean }[];
        quote_requests: {
          id: string; // for the /staff/quotes/[requestId] link
          first_name: string;
          last_name: string | null; // null for Instagram/phone leads
          phone: string | null;
          old_tint_condition: string | null;
          comment: string | null;
        };
      } | null;
    };
  };
};

// One booking opened in the details panel: the accepted quote with its prices, for staff.
// Same rules as StaffBooking: keep it in step with loadBookingDetails' select in page.tsx.
export type BookingDetail = {
  id: string;
  starts_at: string;
  ends_at: string;
  booking_links: {
    quote_links: {
      quotes: {
        film_type: string | null;
        total_cost_cents: number | null;
        duration_minutes: number | null;
        staff_note: string | null;
        quote_items: {
          section: string;
          install: boolean;
          removal: boolean;
          install_price_cents: number | null;
          removal_price_cents: number | null;
        }[];
        quote_requests: {
          first_name: string;
          last_name: string | null;
          phone: string | null;
          vehicle_year: string;
          vehicle_make: string;
          vehicle_model: string;
          old_tint_condition: string | null;
          comment: string | null;
        };
      } | null;
    };
  };
};

// One booking placed on the shop's clock: the date it belongs to and its start/end as
// minutes after midnight, the same shape as appointmentSlotsByDay (540 = 9:00 AM).
// The day view positions blocks with startMinutes/endMinutes; booking keeps the nested data.
export type PlacedBooking<T> = {
  booking: T;
  startMinutes: number;
  endMinutes: number;
};

// Generic over T so it works with whatever the select returns; it only needs the two timestamps.
// Returns shop date "YYYY-MM-DD" -> that day's bookings, earliest first.
export function groupByShopDay<T extends { starts_at: string; ends_at: string }>(
  bookings: T[],
  range: { start: string; end: string },
): Map<string, PlacedBooking<T>[]> {
  const byDay = new Map<string, PlacedBooking<T>[]>();

  for (const booking of bookings) {
    const { date, minutes: startMinutes } = toShopTime(booking.starts_at);
    if (date < range.start || date > range.end) continue;
    const endMinutes = toShopTime(booking.ends_at).minutes;
    let day = byDay.get(date);
    if (!day) {
      day = [];
      byDay.set(date, day);
    }
    day.push({ booking, startMinutes, endMinutes });
  }

  // The query is ordered by starts_at, so each day's array is already earliest first.
  return byDay;
}

// Short labels and colours for the month view, where a cell is ~140px wide on desktop.
// Keyed by film_type; null (removal-only) uses "removal". The day view can use the full filmLabels.
export const JOB_STYLES: Record<string, { label: string; bgColor: string }> = {
  "pronano-ceramic": { label: "Ceramic", bgColor: "bg-orange-400" },
  "c2-carbon": { label: "Carbon", bgColor: "bg-blue-400" },
  removal: { label: "Removal", bgColor: "bg-rose-300" },
};

// Falls back to the removal style for null and for any film_type missing from JOB_STYLES.
export const jobStyle = (filmType: string | null | undefined) =>
  JOB_STYLES[filmType ?? "removal"] ?? JOB_STYLES.removal;

// 540 -> "9a", 870 -> "2:30p". Compact so a line fits in a cell.
export function shortTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "p" : "a"}`;
}

// "Ray C" from first_name + last initial; last_name is null for Instagram/phone leads.
export function shortName(booking: StaffBooking): string {
  const request = booking.booking_links.quote_links.quotes?.quote_requests;
  if (!request) return "Booking";
  return [request.first_name, request.last_name?.slice(0, 1)]
    .filter(Boolean)
    .join(" ");
}