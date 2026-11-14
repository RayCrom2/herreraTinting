import {
  minutesInDay,
  appointmentSlotsByDay,
  minutesTo12HourTime,
} from "../../lib/schedule";
import { Suspense } from "react";
import DatePicker from "./DatePicker";

export default function BookAppointmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12 text-zinc-100">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
        Herrera Tinting
      </p>
      <Suspense
        fallback={<p className="mt-4 text-zinc-400">Loading your quote...</p>}
      >
        <DatePicker />
        {/* <CustomerQuote params={params} /> */}
      </Suspense>
    </main>
  );
}
