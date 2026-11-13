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
export function addDaysOffset(date: Date, days: number): Date {
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + days * msPerDay);
}