import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "../../lib/dal";
import {
  filmLabels,
  formatPhone,
  sectionLabels,
  shopDateFormat,
  sortSections,
  formatProperNoun,
} from "../../lib/quote";

// Static shell renders instantly; anything reading the session or database streams in behind <Suspense>.
export default function SentQuotesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Sent Quotes</h1>
      <Suspense
        fallback={<p className="mt-4 text-zinc-400">Loading quotes...</p>}
      >
        <QuotedQuotesList />
      </Suspense>
    </>
  );
}

async function QuotedQuotesList() {
  const { supabase } = await requireStaff();

  const { data: requests, error } = await supabase
    .from("quote_requests")
    .select(
      `
      id, first_name, last_name, phone,
      vehicle_year, vehicle_make, vehicle_model, removal_request, replied_at,
      quotes ( film_type, quote_items ( section ) )
    `,
    )
    .not("replied_at", "is", null)
    .order("replied_at", { ascending: false });

  if (error) throw new Error(`Failed to load quote requests: ${error.message}`);

  if (requests.length === 0) {
    return (
      <p className="mt-4 text-zinc-400">
        No Sent requests. You&apos;re all caught up.
      </p>
    );
  }

  return (
    <>
      <p className="mt-1 flex gap-4 px-2 text-sm text-zinc-400 pb-2">
        {requests.length} quotes already sent, most recent first
        <span className="ml-auto w-36 ...">Date Quoted:</span>
        <span className="w-32" /> {/* the button-width spacer */}
      </p>

      <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
        {requests.map((r) => {
          const films = r.quotes.map((q) =>
            q.film_type ? filmLabels[q.film_type] : "Removal only",
          );
          // Every quote on a request has the same windows, so read them from the first.
          const sections = sortSections(
            r.quotes[0]?.quote_items.map((i) => i.section) ?? [],
          );

          return (
            <li key={r.id} className="flex items-center gap-4 px-2 py-4">
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-semibold">
                    {r.first_name} {r.last_name}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {" "}
                    · {formatPhone(r.phone)}
                  </span>
                </p>
                <p className="text-sm text-zinc-300">
                  {r.vehicle_year} {formatProperNoun(r.vehicle_make)}{" "}
                  {formatProperNoun(r.vehicle_model)} · {films.join(" & ")}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {sections.map((s) => sectionLabels[s]).join(", ")}
                  {/* {r.removal_request === "yes" && " · Removal"}
                  {r.removal_request === "not-sure" && " · Removal?"} */}
                </p>
              </div>
              <span className="w-36 shrink-0 text-sm text-zinc-400">
                {shopDateFormat.format(new Date(r.replied_at))}
              </span>
              <Link
                href={`/staff/quotes/${r.id}`}
                className="w-32 shrink-0 text-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                View quote
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
