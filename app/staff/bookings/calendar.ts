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
        quote_requests: {
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