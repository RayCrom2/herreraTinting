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
export const schedulingBufferInDays: number = 2;
export const daysCanScheduleInAdvance: number = 30;
export function addDaysOffset(date: Date, days: number): Date {
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + days * msPerDay);
}

// schedule.ts
const SHOP_TZ = "America/Los_Angeles";

// Today's date at the shop as "YYYY-MM-DD" ("en-CA" happens to format that way).
export function shopToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TZ }).format(new Date());
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

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // getMonth() is 0-based
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}