// app/book/[token]/DatePicker.tsx
"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  appointmentSlotsByDay,
  minutesTo12HourTime,
  toDateString,
  earliestBookableDate,
  latestBookableDate,
} from "@/app/lib/schedule";
import { bookAppointment } from "@/app/actions/bookAppointment";
import { type BookingsByDate, conflictsWithBooking } from "@/app/lib/booking";

// react-day-picker is themed through CSS variables on its root element.
const calendarTheme = {
  "--rdp-accent-color": "#f87171", // red-400, matches the page accent
  "--rdp-accent-background-color": "#3f1d1d",
  "--rdp-today-color": "#f87171",
  "--rdp-disabled-opacity": "0.3",
} as CSSProperties;

export default function DatePicker({
  token,
  durationMinutes,
  bookings,
}: {
  token: string;
  durationMinutes: number; // the page only renders the picker once the quote has a duration
  bookings: BookingsByDate;
}) {
  const [selected, setSelected] = useState<Date>();
  const [time, setTime] = useState<number | null>(null);
  const [state, formAction, isPending] = useActionState(bookAppointment, {
    message: null,
  });

  // The month containing the last bookable day, so customers can't page past the window.
  const [lastYear, lastMonth] = latestBookableDate().split("-").map(Number);
  const endMonth = new Date(lastYear, lastMonth - 1, 1); // month is 0-based here, "12" → 11

  function slotIsTaken(day: string, slot: number): boolean {
    return (bookings[day] ?? []).some((b) =>
      conflictsWithBooking({ start: slot, end: slot + durationMinutes }, b),
    );
  }
  // Days before the buffer, or with no slots (closed), can't be picked.
  function isDisabled(date: Date): boolean {
    const day = toDateString(date);
    const slots = appointmentSlotsByDay[date.getDay()];
    return (
      day < earliestBookableDate() ||
      day > latestBookableDate() ||
      slots.length === 0 ||
      slots.every((slot) => slotIsTaken(day, slot))
    );
  }
  // No timeZone on purpose: `selected` is local midnight, so format it in the same local zone.
  const appointmentDate = selected?.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // getDay() returns 0 (Sun) – 6 (Sat), same order as appointmentSlotsByDay
  const slots = selected ? appointmentSlotsByDay[selected.getDay()] : [];

  // Slots are minutes after midnight in shop time, so the end is plain addition.
  function endTime(start: number): string {
    return minutesTo12HourTime(start + durationMinutes);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={(day) => {
            setSelected(day);
            setTime(null);
          }}
          startMonth={new Date()}
          endMonth={endMonth}
          disabled={isDisabled}
          style={calendarTheme}
        />
      </div>

      {selected && (
        <section>
          <h2 className="text-sm font-semibold text-center uppercase tracking-wider text-zinc-400">
            Available appointments
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {slots.map((minutes) => (
              <li key={minutes}>
                <button
                  type="button"
                  disabled={slotIsTaken(toDateString(selected), minutes)}
                  onClick={() => setTime(time === minutes ? null : minutes)} // clicking the picked time again clears it
                  aria-pressed={time === minutes}
                  className={`w-full rounded-lg border px-4 py-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-20 focus-visible:outline-red-400 ${
                    time === minutes
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-zinc-700 bg-zinc-800 text-zinc-100 hover:border-zinc-500"
                  }`}
                >
                  <span className="block">{minutesTo12HourTime(minutes)}</span>
                  {endTime(minutes) && (
                    <span
                      className={`block text-xs ${time === minutes ? "text-red-100" : "text-zinc-400"}`}
                    >
                      done around {endTime(minutes)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* time !== null (not just `time &&`) so TypeScript knows it's a number inside */}
      {selected && time !== null && (
        <form action={formAction} className="space-y-3">
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            Please drop off by{" "}
            <span className="font-semibold text-zinc-100">
              {minutesTo12HourTime(time)}
            </span>{" "}
            on{" "}
            <span className="font-semibold text-zinc-100">
              {appointmentDate}
            </span>
            {endTime(time) && (
              <>
                . <br />
                Your car should be ready around{" "}
                <span className="font-semibold text-zinc-100">
                  {endTime(time)}
                </span>
              </>
            )}
            .
          </p>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="date" value={toDateString(selected)} />
          <input type="hidden" name="minutes" value={time} />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-red-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Booking..."
              : `Book ${minutesTo12HourTime(time)} on ${appointmentDate}`}
          </button>
          {state.message && (
            <p role="alert" className="text-sm text-red-400">
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
