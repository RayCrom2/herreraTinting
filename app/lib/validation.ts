export const BOOKING_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

// "YYYY-MM-DD" that is a real calendar day. The regex lets "2026-02-31" through;
// JavaScript rolls it over to March 3, so the round trip won't match the input.
export function isValidDateString(input: string): boolean {
  if (!BOOKING_DATE.test(input)) return false;
  const day = new Date(`${input}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === input;
}

// "YYYY-MM" with a real month (01–12) in a sane year range for the shop's calendar.
export function isValidYearAndMonth(input: string): boolean {
  if (!YEAR_MONTH.test(input)) return false;
  const year = Number(input.slice(0, 4));
  if (year < 2025 || year > 2150) return false;
  return isValidDateString(`${input}-01`); // rejects month 00 and 13+
}
