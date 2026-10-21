import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { supabase as admin } from "../../lib/supabase/admin";
import {
  filmDescriptions,
  filmLabels,
  formatMinutes,
  formatMoney,
  sortByFilm,
  TOKEN,
} from "../../lib/quote";
import { hashQuoteToken, isLinkExpired } from "../../lib/quoteLinks";
import RespondButton from "./RespondButton";

export const metadata: Metadata = {
  title: "Your Herrera Tinting Quote",
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

async function CustomerQuote({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!TOKEN.test(token)) notFound();

  // Customers aren't logged in, so this reads with the secret key. Select only what the customer
  // may see: totals per film, never per-window prices or staff notes.
  // quote_links!inner + the token_hash filter returns only the request this link belongs to.
  const { data: request, error } = await admin
    .from("quote_requests")
    .select(
      `
      first_name, vehicle_year, vehicle_make, vehicle_model,
      quotes ( id, film_type, total_cost_cents, duration_minutes ),
      quote_links!inner ( status, expires_at, accepted_quote_id )
    `,
    )
    .eq("quote_links.token_hash", hashQuoteToken(token))
    .maybeSingle();

  if (error) throw new Error(`Failed to load quote link: ${error.message}`);
  const link = request?.quote_links[0];
  // Unknown and revoked links look the same, so the page doesn't reveal which links once existed.
  if (!request || !link || link.status === "revoked") notFound();

  await connection(); // the expiry check reads the current time, so it must run per request
  const quotes = sortByFilm(request.quotes);

  if (link.status === "active" && isLinkExpired(link.expires_at)) {
    return (
      <StatusMessage title="This quote link has expired">
        Quotes are good for 14 days. Text us and we&apos;ll send you an updated
        one.
      </StatusMessage>
    );
  }

  return (
    <>
      <h1 className="mt-3 text-3xl font-bold">
        Hi {request.first_name}, here&apos;s your quote
      </h1>
      <p className="mt-2 text-zinc-400">
        {request.vehicle_year} {request.vehicle_make} {request.vehicle_model}
      </p>

      {link.status === "accepted" && (
        <p className="mt-6 rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-3 text-emerald-300">
          Thanks! We&apos;ll text you shortly to schedule your appointment.
        </p>
      )}

      <ul className="mt-8 space-y-4">
        {quotes.map((quote) => {
          const chosen = link.accepted_quote_id === quote.id;
          const name = quote.film_type
            ? filmLabels[quote.film_type]
            : "Tint removal";
          return (
            <li
              key={quote.id}
              className={`rounded-xl border bg-zinc-950 p-5 ${chosen ? "border-emerald-600" : "border-zinc-800"}`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-bold">{name}</h2>
                <span className="text-2xl font-bold tabular-nums">
                  {formatMoney(quote.total_cost_cents)}
                </span>
              </div>
              {quote.film_type && (
                <p className="mt-1 text-sm text-zinc-400">
                  {filmDescriptions[quote.film_type]}
                </p>
              )}
              <p className="mt-3 text-sm text-zinc-300">
                About {formatMinutes(quote.duration_minutes)} in the shop
              </p>
              {chosen && (
                <p className="mt-3 text-sm font-semibold text-emerald-400">
                  ✓ You chose this option
                </p>
              )}
              {link.status === "active" && (
                <div className="mt-4">
                  <RespondButton
                    token={token}
                    response="accept"
                    quoteId={quote.id}
                    label="Choose this option"
                    confirmText={`Choose ${name} for ${formatMoney(quote.total_cost_cents)}?`}
                    className="w-full rounded-full bg-red-600 px-6 py-3 font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {link.status === "active" && (
        <div className="mt-6 text-center">
          <RespondButton
            token={token}
            response="decline"
            label="No thanks, decline this quote"
            confirmText="Decline this quote? You can always text us later."
            className="text-sm text-zinc-400 underline hover:text-zinc-200 disabled:opacity-60"
          />
        </div>
      )}

      {link.status === "declined" && (
        <p className="mt-6 text-zinc-400">
          You declined this quote. Text us anytime if you change your mind.
        </p>
      )}
    </>
  );
}

export default function CustomerQuotePage({
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
        <CustomerQuote params={params} />
      </Suspense>
    </main>
  );
}
