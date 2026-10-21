"use client";

import { startTransition, useActionState, useState } from "react";
import { savePricing } from "../../../actions/pricing";
import { sendQuote } from "../../../actions/sendQuote";
import {
  dollarsToCents,
  filmLabels,
  formatMinutes,
  formatMoney,
  initialPricingState,
  initialSendState,
  parseMinutes,
  sectionLabels,
  type PricingQuote,
} from "../../../lib/quote";

type ItemInputs = Record<string, { price: string; minutes: string }>;

const inputClass =
  "w-full rounded-lg border bg-black px-3 py-2 text-right text-zinc-100 tabular-nums focus:border-red-500 focus:outline-none disabled:opacity-60";

const linkButtonClass =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500";

// Shown once after sending. The database keeps only the link's hash, so it can't be shown again.
function CustomerLink({
  url,
  message,
  customer,
}: {
  url: string;
  message: string;
  customer: Customer;
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const text = `Hi ${customer.firstName}, your Herrera Tinting quote is ready: ${url}`;

  async function copy(what: "link" | "message") {
    await navigator.clipboard.writeText(what === "link" ? url : text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="rounded-xl border border-emerald-700 bg-emerald-950/40 p-4">
      <p className="text-sm text-emerald-300">{message}</p>
      <input
        readOnly
        value={url}
        aria-label="Customer link"
        onFocus={(e) => e.target.select()}
        className="mt-3 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {customer.phone && (
          // Opens the device's texting app with the message filled in. Reliable on phones;
          // on computers it depends on what's installed, hence the copy buttons.
          <a
            href={`sms:+1${customer.phone}?&body=${encodeURIComponent(text)}`}
            className={linkButtonClass}
          >
            Text customer
          </a>
        )}
        <button
          type="button"
          onClick={() => copy("message")}
          className={linkButtonClass}
        >
          {copied === "message" ? "Copied" : "Copy message"}
        </button>
        <button
          type="button"
          onClick={() => copy("link")}
          className={linkButtonClass}
        >
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        On a computer, use Copy message and paste it wherever you text from. The
        full link isn&apos;t stored, so it can&apos;t be shown again after you
        leave this page.
      </p>
    </div>
  );
}

// Read-only box showing whether the customer asked for this work on a window.
function WorkCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex justify-center pt-2.5">
      <span
        role="img"
        aria-label={`${label}: ${checked ? "yes" : "no"}`}
        className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${
          checked ? "border-red-500 bg-red-600 text-white" : "border-zinc-700"
        }`}
      >
        {checked && "✓"}
      </span>
    </div>
  );
}

type Customer = { firstName: string; phone: string | null };

export default function PricingForm({
  requestId,
  quotes,
  locked,
  customer,
}: {
  requestId: string;
  quotes: PricingQuote[];
  locked: boolean;
  customer: Customer;
}) {
  const [state, formAction, isPending] = useActionState(
    savePricing,
    initialPricingState,
  );

  // Controlled so totals update as staff type.
  const [inputs, setInputs] = useState<ItemInputs>(() =>
    Object.fromEntries(
      quotes.flatMap((quote) =>
        quote.items.map((item) => [
          item.id,
          {
            price:
              item.price_cents === null
                ? ""
                : (item.price_cents / 100).toFixed(2),
            minutes:
              item.duration_minutes === null
                ? ""
                : String(item.duration_minutes),
          },
        ]),
      ),
    ),
  );

  const [sendState, sendAction, isSending] = useActionState(
    sendQuote,
    initialSendState,
  );

  // `quotes` holds what's saved in the database (it refreshes after each save);
  // `inputs` holds what's typed. Sending uses the saved prices, so both must agree first.
  const savedItems = quotes.flatMap((quote) => quote.items);
  const hasUnsavedChanges = savedItems.some(
    (item) =>
      dollarsToCents(inputs[item.id].price) !== item.price_cents ||
      parseMinutes(inputs[item.id].minutes) !== item.duration_minutes,
  );
  const fullyPriced = savedItems.every(
    (item) => item.price_cents !== null && item.duration_minutes !== null,
  );

  function setInput(itemId: string, field: "price" | "minutes", value: string) {
    setInputs((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }));
  }

  function handleSend() {
    if (!window.confirm("Send this quote? Prices lock once it's sent.")) return;
    const formData = new FormData();
    formData.set("requestId", requestId);
    startTransition(() => sendAction(formData));
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
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
            if (minutes !== null && !Number.isNaN(minutes))
              totalMinutes += minutes;
          }

          return (
            <section
              key={quote.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <h2 className="text-lg font-bold">
                {quote.film_type ? filmLabels[quote.film_type] : "Removal only"}
              </h2>

              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4rem_4rem_7rem_5.5rem] items-start gap-x-3 gap-y-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 pl-2">
                  Item
                </span>
                <span className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Install
                </span>
                <span className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Remove
                </span>
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
                        <p className="font-medium">
                          {sectionLabels[item.section]}
                        </p>
                      </div>
                      <WorkCheck
                        checked={item.install}
                        label={`${sectionLabels[item.section]} install`}
                      />
                      <WorkCheck
                        checked={item.removal}
                        label={`${sectionLabels[item.section]} removal`}
                      />
                      <div>
                        <input
                          name={priceName}
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={`${sectionLabels[item.section]} price`}
                          value={inputs[item.id].price}
                          onChange={(e) =>
                            setInput(item.id, "price", e.target.value)
                          }
                          className={`${inputClass} ${priceError ? "border-red-500" : "border-zinc-800"}`}
                        />
                        {priceError && (
                          <p className="mt-1 text-xs text-red-400">
                            {priceError}
                          </p>
                        )}
                      </div>
                      <div>
                        <input
                          name={minutesName}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label={`${sectionLabels[item.section]} minutes`}
                          value={inputs[item.id].minutes}
                          onChange={(e) =>
                            setInput(item.id, "minutes", e.target.value)
                          }
                          className={`${inputClass} ${minutesError ? "border-red-500" : "border-zinc-800"}`}
                        />
                        {minutesError && (
                          <p className="mt-1 text-xs text-red-400">
                            {minutesError}
                          </p>
                        )}
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
                    {totalMinutes > 0
                      ? formatMinutes(totalMinutes)
                      : "No time set"}
                  </span>
                </span>
              </div>
            </section>
          );
        })}
      </fieldset>

      {!locked && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending || isSending}
              className="rounded-full bg-red-600 px-6 py-3 font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save prices"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={
                !fullyPriced || hasUnsavedChanges || isPending || isSending
              }
              className="rounded-full border border-zinc-500 px-6 py-3 font-bold text-zinc-100 transition-colors hover:border-zinc-300 disabled:opacity-40"
            >
              {isSending ? "Sending..." : "Send quote"}
            </button>
          </div>
          {hasUnsavedChanges ? (
            <p className="text-sm text-zinc-400">
              Save your changes before sending.
            </p>
          ) : (
            !fullyPriced && (
              <p className="text-sm text-zinc-400">
                Every window needs a price and time to send.
              </p>
            )
          )}
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

      {sendState.status === "error" && (
        <p role="alert" className="text-sm text-red-400">
          {sendState.message}
        </p>
      )}
      {sendState.url && (
        <CustomerLink
          url={sendState.url}
          message={sendState.message}
          customer={customer}
        />
      )}
    </form>
  );
}
