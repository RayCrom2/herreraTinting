import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "../lib/dal";
import { filmLabels, formatPhone, sectionLabels, shopDateFormat, sortSections } from "../lib/quote";

// Static shell renders instantly; anything reading the session or database streams in behind <Suspense>.
export default function OpenQuotesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Open Quotes</h1>
      <Suspense fallback={<p className="mt-4 text-zinc-400">Loading quotes...</p>}>
        <OpenQuotesList />
      </Suspense>
    </>
  );
}

async function OpenQuotesList() {
  const { supabase } = await requireStaff();

  const { data: requests, error } = await supabase
    .from("quote_requests")
    .select(`
      id, created_at, first_name, last_name, phone,
      vehicle_year, vehicle_make, vehicle_model, removal_request,
      quotes ( film_type, quote_items ( section ) )
    `)
    .is("replied_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load quote requests: ${error.message}`);

  if (requests.length === 0) {
    return <p className="mt-4 text-zinc-400">No open requests. You&apos;re all caught up.</p>;
  }

  return (
    <>
      <p className="mt-1 text-sm text-zinc-400">{requests.length} waiting, oldest first</p>
      <ul className="mt-6 divide-y divide-zinc-800 border-y border-zinc-800">
        {requests.map((r) => {
          const films = r.quotes.map((q) => (q.film_type ? filmLabels[q.film_type] : "Removal only"));
          // Every quote on a request has the same windows, so read them from the first.
          const sections = sortSections(r.quotes[0]?.quote_items.map((i) => i.section) ?? []);

          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-2 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="font-semibold">
                    {r.first_name} {r.last_name}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {shopDateFormat.format(new Date(r.created_at))}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">
                  {r.vehicle_year} {r.vehicle_make} {r.vehicle_model} · {formatPhone(r.phone)}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {films.join(" + ")} · {sections.map((s) => sectionLabels[s]).join(", ")}
                  {r.removal_request === "yes" && " · Removal"}
                  {r.removal_request === "not-sure" && " · Removal?"}
                </p>
              </div>
              <Link
                href={`/staff/quotes/${r.id}`}
                className="shrink-0 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Price quote
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
