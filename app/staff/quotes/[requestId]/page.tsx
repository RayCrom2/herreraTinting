import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "../../../lib/dal";
import { formatPhone, shopDateFormat, sortByFilm, sortBySection, type PricingQuote } from "../../../lib/quote";
import PricingForm from "./PricingForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const removalLabels: Record<string, string> = {
  no: "No removal needed",
  yes: "Needs old tint removed",
  "not-sure": "Not sure about removal",
};

export default function QuoteRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  return (
    <>
      <Link href="/staff" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Open quotes
      </Link>
      <Suspense fallback={<p className="mt-4 text-zinc-400">Loading quote...</p>}>
        <QuoteRequestDetail params={params} />
      </Suspense>
    </>
  );
}

async function QuoteRequestDetail({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  // Postgres rejects malformed UUIDs with an error, so treat them as "not found" up front.
  if (!UUID.test(requestId)) notFound();

  const { supabase } = await requireStaff();
  const { data: request, error } = await supabase
    .from("quote_requests")
    .select(`
      id, created_at, first_name, last_name, phone,
      vehicle_year, vehicle_make, vehicle_model, removal_request, comment, replied_at,
      quotes ( id, film_type, quote_items ( id, section, install, removal, price_cents, duration_minutes ) )
    `)
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load quote request: ${error.message}`);
  if (!request) notFound();

  const quotes: PricingQuote[] = sortByFilm(request.quotes).map((quote) => ({
    id: quote.id,
    film_type: quote.film_type,
    items: sortBySection(quote.quote_items),
  }));
  const locked = request.replied_at !== null;

  return (
    <>
      <header className="mt-4">
        <h1 className="text-3xl font-bold">
          {request.vehicle_year} {request.vehicle_make} {request.vehicle_model}
        </h1>
        <p className="mt-2 text-zinc-300">
          {request.first_name} {request.last_name} ·{" "}
          <a href={`tel:+1${request.phone}`} className="text-red-400 hover:underline">
            {formatPhone(request.phone)}
          </a>
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Received {shopDateFormat.format(new Date(request.created_at))}
          {request.removal_request && ` · ${removalLabels[request.removal_request]}`}
        </p>
        {request.comment && (
          <blockquote className="mt-4 border-l-2 border-zinc-700 pl-3 text-zinc-300">
            {request.comment}
          </blockquote>
        )}
        {locked && (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            Sent {shopDateFormat.format(new Date(request.replied_at))}. Prices are locked.
          </p>
        )}
      </header>

      <PricingForm
        requestId={request.id}
        quotes={quotes}
        locked={locked}
        customer={{ firstName: request.first_name, phone: request.phone }}
      />
    </>
  );
}
