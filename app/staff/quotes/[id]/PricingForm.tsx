"use client";

import { startTransition, useActionState, useState } from "react";
import { savePricing } from "../../../actions/pricing";
import {
  dollarsToCents,
  filmLabels,
  formatMinutes,
  formatMoney,
  initialPricingState,
  parseMinutes,
  sectionLabels,
  type PricingQuote,
} from "../../../lib/quote";

type ItemInputs = Record<string, { price: string; minutes: string }>;

const inputClass =
  "w-full rounded-lg border bg-black px-3 py-2 text-right text-zinc-100 tabular-nums focus:border-red-500 focus:outline-none disabled:opacity-60";

function workLabel(install: boolean, removal: boolean) {
  if (install && removal) return "Removal + install";
  return removal ? "Removal only" : "Install";
}

export default function PricingForm({
  requestId,
  quotes,
  locked,
}: {
  requestId: string;
  quotes: PricingQuote[];
  locked: boolean;
}) {
  const [state, formAction, isPending] = useActionState(savePricing, initialPricingState);

  // Controlled so totals update as staff type.
  const [inputs, setInputs] = useState<ItemInputs>(() =>
    Object.fromEntries(
      quotes.flatMap((quote) =>
        quote.items.map((item) => [
          item.id,
          {
            price: item.price_cents === null ? "" : (item.price_cents / 100).toFixed(2),
            minutes: item.duration_minutes === null ? "" : String(item.duration_minutes),
          },
        ]),
      ),
    ),
  );

  function setInput(itemId: string, field: "price" | "minutes", value: string) {
    setInputs((current) => ({ ...current, [itemId]: { ...current[itemId], [field]: value } }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Submitting manually skips React's automatic form reset, so typed values stay put.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <input type="hidden" name="requestId" value={requestId} />

      <fieldset disabled={locked || isPending} className="space-y-6">
        {quotes.map((quote) => {
          let totalCents = 0;
          let totalMinutes = 0;
          for (const item of quote.items) {
            const price = dollarsToCents(inputs[item.id].price);
            const minutes = parseMinutes(inputs[item.id].minutes);
            if (price !== null && !Number.isNaN(price)) totalCents += price;
            if (minutes !== null && !Number.isNaN(minutes)) totalMinutes += minutes;
          }

          return (
            <section key={quote.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <h2 className="text-lg font-bold">
                {quote.film_type ? filmLabels[quote.film_type] : "Removal only"}
              </h2>

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem_5.5rem] items-start gap-x-3 gap-y-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Window</span>
                <span className="text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Price ($)
                </span>
                <span className="text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Minutes
                </span>

                {quote.items.map((item) => {
                  const priceName = `price:${item.id}`;
                  const minutesName = `minutes:${item.id}`;
                  const priceError = state.errors[priceName];
                  const minutesError = state.errors[minutesName];

                  return (
                    <div key={item.id} className="contents">
                      <div className="min-w-0 pt-2">
                        <p className="font-medium">{sectionLabels[item.section]}</p>
                        <p className="text-xs text-zinc-400">{workLabel(item.install, item.removal)}</p>
                      </div>
                      <div>
                        <input
                          name={priceName}
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`${sectionLabels[item.section]} price`}
                          value={inputs[item.id].price}
                          onChange={(e) => setInput(item.id, "price", e.target.value)}
                          className={`${inputClass} ${priceError ? "border-red-500" : "border-zinc-800"}`}
                        />
                        {priceError && <p className="mt-1 text-xs text-red-400">{priceError}</p>}
                      </div>
                      <div>
                        <input
                          name={minutesName}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label={`${sectionLabels[item.section]} minutes`}
                          value={inputs[item.id].minutes}
                          onChange={(e) => setInput(item.id, "minutes", e.target.value)}
                          className={`${inputClass} ${minutesError ? "border-red-500" : "border-zinc-800"}`}
                        />
                        {minutesError && <p className="mt-1 text-xs text-red-400">{minutesError}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-baseline justify-between border-t border-zinc-800 pt-3">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold tabular-nums">
                  {formatMoney(totalCents)}
                  <span className="ml-3 text-sm font-normal text-zinc-400">
                    {totalMinutes > 0 ? formatMinutes(totalMinutes) : "No time set"}
                  </span>
                </span>
              </div>
            </section>
          );
        })}
      </fieldset>

      {!locked && (
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-red-600 px-6 py-3 font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save prices"}
          </button>
          {state.message && (
            <p
              role="status"
              className={`text-sm ${state.status === "error" ? "text-red-400" : "text-emerald-400"}`}
            >
              {state.message}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
