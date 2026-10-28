"use client";

import Link from "next/link";
import type { Request } from "@/app/lib/quote";
import {
  filmLabels,
  sortSections,
  formatPhone,
  formatProperNoun,
  shopDateFormat,
  sectionLabels,
} from "@/app/lib/quote";

export default function RenderQuote({ requests }: { requests: Request[] }) {
  return (
    <>
      <p className="mt-1 flex gap-4 px-2 text-sm text-zinc-400 pb-2">
        {requests.length} waiting, oldest first
        <span className="ml-auto w-36 ...">Date Requested:</span>
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
                {shopDateFormat.format(new Date(r.created_at))}
              </span>
              <Link
                href={`/staff/quotes/${r.id}`}
                className="w-32 shrink-0 text-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
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
