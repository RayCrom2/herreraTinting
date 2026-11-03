import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "../../../lib/dal";
import {
  formatPhone,
  shopDateFormat,
  sortByFilm,
  sortBySection,
  type PricingQuote,
  formatProperNoun,
} from "../../../lib/quote";
import PricingForm from "./PricingForm";
import VehicleTypePreset from "./VehicleTypePreset";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function QuoteRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  return (
    <>
      <Suspense
        fallback={<p className="mt-4 text-zinc-400">Loading quote...</p>}
      >
        <QuoteRequestDetail params={params} />
      </Suspense>
    </>
  );
}

async function QuoteRequestDetail({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  // Postgres rejects malformed UUIDs with an error, so treat them as "not found" up front.
  if (!UUID.test(requestId)) notFound();

  const { supabase } = await requireStaff();
  const { data: request, error } = await supabase
    .from("quote_requests")
    .select(
      `
      id, created_at, first_name, last_name, phone,
      vehicle_type, vehicle_year, vehicle_make, vehicle_model, removal_request, old_tint_condition, comment, replied_at,
      quotes ( id, film_type, quote_items ( id, section, install, removal, install_price_cents, removal_price_cents, duration_minutes ) )
    `,
    )
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
  const vehicleType = request.vehicle_type ?? null;

  return (
    <>
      <header className="mt-4">
        <div className="flex items-center relative">
          <h1 className="text-3xl font-bold">
            {request.vehicle_year} {formatProperNoun(request.vehicle_make)}{" "}
            {formatProperNoun(request.vehicle_model)}
          </h1>
        </div>

        <p className="mt-2 text-zinc-300">
          {request.first_name} {request.last_name} ·{" "}
          <a
            href={`tel:+1${request.phone}`}
            className="text-red-400 hover:underline"
          >
            {formatPhone(request.phone)}
          </a>
        </p>
        <div>
          <div className="flex mt-1 relative h-12">
            <p className="text-sm text-zinc-400">
              Received {shopDateFormat.format(new Date(request.created_at))}
            </p>
            <div className="absolute right-0 top-0">
              <VehicleTypePreset currentType={vehicleType} locked={locked} />
            </div>
          </div>

          {request.comment && (
            <blockquote className="whitespace-pre-line wrap-break-word mt-4 border-l-2 border-zinc-700 pl-3 text-zinc-300 pr-30">
              {request.comment}
            </blockquote>
          )}
          {locked && (
            <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
              Sent {shopDateFormat.format(new Date(request.replied_at))}. Prices
              are locked.
            </p>
          )}
        </div>
      </header>

      <PricingForm
        requestId={request.id}
        quotes={quotes}
        locked={locked}
        customer={{ firstName: request.first_name, phone: request.phone }}
        vehicleType={vehicleType}
      />
    </>
  );
}
