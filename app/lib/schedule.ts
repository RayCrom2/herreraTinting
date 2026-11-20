export const minutesInDay: number = 1440;
/*Sun-Sat*/ 
export const appointmentSlotsByDay: number[][] = [[], [540, 840], [540, 840], [540, 840], [540, 840], [540, 840], [540, 840]];
export function minutesTo12HourTime(timeInMinutes: number): string {
    let hour = Math.trunc(timeInMinutes / 60);
    const isPM = hour >= 12;
    if (isPM && hour != 12){
        hour %= 12;
    }
    const minutes = timeInMinutes % 60;
    return `${hour.toString().slice(0,2)}:${minutes.toString().padStart(2,'0')} ${isPM ? 'pm' : 'am'}`;
}
const schedulingBufferInDays: number = 2;
const daysCanScheduleInAdvance: number = 30;

// schedule.ts
const SHOP_TZ = "America/Los_Angeles";

// Today's date at the shop as "YYYY-MM-DD" ("en-CA" happens to format that way).
export function shopToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ }).format(new Date());
}

// For showing a stored booking to people: "Tuesday, November 24" and "9:00 AM", in shop time.
export const shopDayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  weekday: "long",
  month: "long",
  day: "numeric",
});
export const shopTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  hour: "numeric",
  minute: "2-digit",
});

// Reads an instant as the shop's wall clock. Built once: creating a formatter is slow, using one is fast.
// hourCycle "h23" gives hours 00–23 (no "AM/PM", and midnight is 00, not 24).
const shopClockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// A timestamptz from the database as shop-local date + minutes after midnight, the same
// shape as the slots: "2026-11-27T22:00:00+00:00" → { date: "2026-11-27", minutes: 840 }.
export function toShopTime(iso: string): { date: string; minutes: number } {
  // formatToParts splits the formatted text into labeled pieces, e.g.
  // [{ type: "month", value: "11" }, { type: "literal", value: "/" }, { type: "day", value: "27" }, ...]
  // so we can read each field by name instead of slicing a string whose layout depends on locale.
  const parts = shopClockFormat.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

// Calendar math on a "YYYY-MM-DD" string; UTC in and out, so no zone can shift it.
export function addDaysToDateString(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function earliestBookableDate(): string {
  return addDaysToDateString(shopToday(), schedulingBufferInDays);
}

export function latestBookableDate():string {
  return addDaysToDateString(shopToday(), daysCanScheduleInAdvance);
};

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // getMonth() is 0-based
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}