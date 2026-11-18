export type Booking = {
    date: string;
    start: number;
    end: number;
};

export type BookingsByDate = Record<string, { start: number; end: number }[]>;

const timeBetweenAppointments = 15; //in minutes

export function conflictsWithBooking(
  b1: { start: number; end: number },
  b2: { start: number; end: number },
):boolean {
  return b1.start < b2.end + timeBetweenAppointments && b2.start < b1.end + timeBetweenAppointments;
}