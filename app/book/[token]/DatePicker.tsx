// app/book/[token]/DatePicker.tsx
"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  addDaysOffset,
  schedulingBufferInDays,
  appointmentSlotsByDay,
  minutesTo12HourTime,
} from "@/app/lib/schedule";

export default function DatePicker() {
  const [selected, setSelected] = useState<Date>();

  function isDisabled(date: Date): boolean {
    // TODO: return true if the day is closed or in the past
    // hint: appointmentSlotsByDay + the days lookup array from before

    const buffer = addDaysOffset(new Date(), schedulingBufferInDays);

    return date < buffer || appointmentSlotsByDay[date.getDay()].length === 0;
  }

  // getDay() returns 0 (Sun) – 6 (Sat), same order as appointmentSlotsByDay
  const slots = selected ? appointmentSlotsByDay[selected.getDay()] : [];

  return (
    <>
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={setSelected}
        disabled={isDisabled}
      />

      {selected &&
        (slots.length > 0 ? (
          <ul>
            {slots.map((minutes) => (
              <li key={minutes}>{minutesTo12HourTime(minutes)}</li>
            ))}
          </ul>
        ) : (
          <p>No appointments available on this day.</p>
        ))}
    </>
  );
}
