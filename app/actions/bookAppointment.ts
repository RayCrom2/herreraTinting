"use server";
import { refresh } from "next/cache";
import { supabase as admin } from "../lib/supabase/admin";
import { hashToken, TOKEN } from "../lib/quoteLinks";
import { BOOKING_DATE } from "../lib/validation";
import { appointmentSlotsByDay, earliestBookableDate, toDateString} from "../lib/schedule";

export type BookState = { message: string | null };

// Public action: anyone can call it, so it trusts nothing from the page but the token.
export async function bookAppointment(_prevState: BookState, formData: FormData): Promise<BookState> {
  const token = String(formData.get("token") ?? "");
  const date = String(formData.get("date") ?? "");       // "YYYY-MM-DD"
  const minutes = Number(formData.get("minutes"));       // e.g. 540

  if (!TOKEN.test(token)) return { message: "This booking link isn't valid." };


  if (!BOOKING_DATE.test(date)) return { message: "Please pick a valid date." };
  // Parse as UTC midnight and read it back as UTC, so the server's own time zone can't shift the day.
  const day = new Date(`${date}T00:00:00Z`);
  // The regex lets "2026-02-31" through; JavaScript rolls it over to March 3, so it won't match the input.
  if (day.toISOString().slice(0, 10) !== date) return { message: "Please pick a valid date." };
  const weekday = day.getUTCDay(); // 0 = Sun … 6 = Sat, same order as appointmentSlotsByDay
  if (!appointmentSlotsByDay[weekday].includes(minutes)) return { message: "Please pick one of the available times." };
  
  if (date < earliestBookableDate()) return { message: "That day is too soon. Please pick a later date." };

  const { error } = await admin.rpc("book_appointment", {
    p_booking_link_token_hash: hashToken(token),
    p_date: date,
    p_start_minutes: minutes,
  });

  if (error) {
    console.error("Failed to book appointment:", error);
    // P0001 is book_appointment's own `raise exception`: the link is invalid, expired or already used.
    if (error.code === "P0001") {
      return { message: "This booking link can't be used anymore. Text us if you need help." };
    }
    // 23P01 is the bookings exclude constraint: someone else just took an overlapping slot.
    // The whole call rolled back, so the link is still active and they can pick again.
    if (error.code === "23P01") {
      return { message: "Sorry, that time was just booked. Please pick another time." };
    }
    return { message: "Something went wrong. Please try again." };
  }

  refresh(); // re-renders the page, which now sees status = 'used' and shows "You're already booked"
  return { message: null };
}
