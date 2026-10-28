import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "../lib/dal";
import RenderQuote from "./components/RenderQuotes";
import {
  filmLabels,
  formatPhone,
  sectionLabels,
  shopDateFormat,
  sortSections,
  formatProperNoun,
} from "../lib/quote";

// Static shell renders instantly; anything reading the session or database streams in behind <Suspense>.
export default function OpenQuotesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Open Quotes</h1>
      <Suspense
        fallback={<p className="mt-4 text-zinc-400">Loading quotes...</p>}
      >
        <OpenQuotesList />
      </Suspense>
    </>
  );
}

async function OpenQuotesList() {
  const { supabase } = await requireStaff();

  const { data: requests, error } = await supabase
    .from("quote_requests")
    .select(
      `
      id, created_at, first_name, last_name, phone,
      vehicle_year, vehicle_make, vehicle_model, removal_request,
      quotes ( film_type, quote_items ( section ) )
    `,
    )
    .is("replied_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load quote requests: ${error.message}`);

  if (requests.length === 0) {
    return (
      <p className="mt-4 text-zinc-400">
        No open requests. You&apos;re all caught up.
      </p>
    );
  }

  return <RenderQuote requests={requests} />;
}
