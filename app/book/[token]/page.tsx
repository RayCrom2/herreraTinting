import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { isLinkExpired, TOKEN, hashToken } from "../../lib/quoteLinks";
import DatePicker from "./DatePicker";
import { supabase as admin } from "@/app/lib/supabase/admin";
import { filmLabels, formatMinutes, formatProperNoun } from "@/app/lib/quote";

export const metadata: Metadata = {
  title: "Book Your Herrera Tinting Appointment",
  // The URL is a secret: keep it out of search engines and out of Referer headers sent to other sites.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function StatusMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-zinc-400">{children}</p>
    </>
  );
}

// Each embed follows a many-to-one foreign key, so each is a single object, not an array.
type BookingLink = {
  status: "active" | "used" | "revoked";
  expires_at: string;
  quote_links: {
    quote_requests: {
      vehicle_year: number | null;
      vehicle_make: string | null;
      vehicle_model: string | null;
    };
    accepted_quote: {
      film_type: string | null; // null for removal-only jobs
      duration_minutes: number | null;
    } | null;
  };
};

async function BookAppointment({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!TOKEN.test(token)) notFound();

  const { data: link, error } = await admin
    .from("booking_links")
    .select(
      `
      status, expires_at,
      quote_links (
        quote_requests (vehicle_year, vehicle_make, vehicle_model),
        accepted_quote:quotes!quote_links_accepted_quote_fkey (film_type, duration_minutes)
      )
      `,
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle<BookingLink>();

  if (error) throw new Error(`Failed to load quote link: ${error.message}`);
  // Unknown and revoked links look the same, so the page doesn't reveal which links once existed.
  if (!link || link.status === "revoked") notFound();

  await connection(); // the expiry check reads the current time, so it must run per request

  if (link.status === "used") {
    return (
      <StatusMessage title="You're already booked">
        This link has already been used to schedule your appointment. Text us if
        you need to change it.
      </StatusMessage>
    );
  }

  if (isLinkExpired(link.expires_at)) {
    return (
      <StatusMessage title="This booking link has expired">
        Booking links are good for 14 days. Text us and we&apos;ll send you a
        new one.
      </StatusMessage>
    );
  }

  const { data: bookings, error: bookingsError } = await admin
    .from("bookings")
    .select(`starts_at, ends_at`)
    .eq("status", "scheduled")
    .gt("ends_at", new Date().toISOString())
    .overrideTypes<
      { starts_at: string; ends_at: string }[],
      { merge: false }
    >();
  if (bookingsError)
    throw new Error(`Failed to load bookings: ${bookingsError.message}`);

  const vehicle = link.quote_links.quote_requests;
  const quote = link.quote_links.accepted_quote;
  const vehicleName = [
    vehicle.vehicle_year,
    formatProperNoun(vehicle.vehicle_make ?? ""),
    formatProperNoun(vehicle.vehicle_model ?? ""),
  ]
    .filter(Boolean)
    .join(" ");
  const duration = quote?.duration_minutes ?? null;

  return (
    <div>
      <h1 className="mt-3 text-3xl">Pick a day for your appointment</h1>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm">
        {vehicleName && (
          <>
            <dt className="text-zinc-400">Vehicle</dt>
            <dd className="font-medium">{vehicleName}</dd>
          </>
        )}
        <dt className="text-zinc-400">Service</dt>
        <dd className="font-medium">
          {quote?.film_type
            ? `${filmLabels[quote.film_type]} tint`
            : "Tint removal"}
        </dd>
        {duration !== null && (
          <>
            <dt className="text-zinc-400">Takes about</dt>
            <dd className="font-medium">{formatMinutes(duration)}</dd>
          </>
        )}
      </dl>

      <div className="mt-8">
        <DatePicker token={token} durationMinutes={duration} />
      </div>
    </div>
  );
}

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
        fallback={<p className="mt-4 text-zinc-400">Loading your booking...</p>}
      >
        <BookAppointment params={params} />
      </Suspense>
    </main>
  );
}
