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
  sortSections,
  fieldName,
  type PricingItem,
  type PricingQuote,
} from "../../../lib/quote";
import CustomerLink, { type Customer } from "./CustomerLink";
import RecreateLink from "./RecreateLink";

const inputClass =
  "w-full rounded-lg border bg-black px-3 py-2 text-right text-zinc-100 tabular-nums focus:border-red-500 focus:outline-none disabled:opacity-60";
const headerClass =
  "hidden text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 md:block";
const mobileLabelClass = "mb-1 block text-xs text-zinc-500 md:hidden";

// Removal price and minutes don't depend on the film, so they're typed once per window (section).
// Install price is per film, so it's typed per item.
type SectionInputs = Record<string, { removal_price: string; minutes: string }>;
type InstallInputs = Record<string, string>;

const centsToInput = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2);

export default function PricingForm({
  requestId,
  quotes,
  locked,
  customer,
  vehicleType,
}: {
  requestId: string;
  quotes: PricingQuote[];
  locked: boolean;
  customer: Customer;
  vehicleType: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    savePricing,
    initialPricingState,
  );

  // Every window on the request, front to back, and which quote's item covers it.
  const savedItems = quotes.flatMap((quote) => quote.items);
  const sections = sortSections([
    ...new Set(savedItems.map((item) => item.section)),
  ]);
  const itemFor = (quote: PricingQuote, section: string) =>
    quote.items.find((item) => item.section === section);
  const needsRemoval = (section: string) =>
    savedItems.some((item) => item.section === section && item.removal);

  // Columns: removal (if any window has it), one install column per film, then minutes.
  const filmQuotes = quotes.filter((quote) => quote.film_type !== null);
  const showRemoval = sections.some(needsRemoval);
  const columns = `minmax(0,1fr) ${showRemoval ? "7rem " : ""}${filmQuotes.map(() => "7rem").join(" ")} 5.5rem`;

  // Controlled so totals update as staff type. Shared values start from the first saved item.
  const [sectionInputs, setSectionInputs] = useState<SectionInputs>(() =>
    Object.fromEntries(
      sections.map((section) => {
        const first = savedItems.find((item) => item.section === section)!;
        return [
          section,
          {
            removal_price: centsToInput(first.removal_price_cents),
            minutes:
              first.duration_minutes === null
                ? ""
                : String(first.duration_minutes),
          },
        ];
      }),
    ),
  );
  const [installInputs, setInstallInputs] = useState<InstallInputs>(() =>
    Object.fromEntries(
      savedItems.map((item) => [item.id, centsToInput(item.install_price_cents)]),
    ),
  );

  const [sendState, sendAction, isSending] = useActionState(
    sendQuote,
    initialSendState,
  );

  // What a saved item would become if the typed values were saved now.
  function typed(item: PricingItem) {
    return {
      install: item.install ? dollarsToCents(installInputs[item.id]) : null,
      removal: item.removal
        ? dollarsToCents(sectionInputs[item.section].removal_price)
        : null,
      minutes: parseMinutes(sectionInputs[item.section].minutes),
    };
  }

  // `quotes` holds what's saved in the database (it refreshes after each save);
  // the inputs hold what's typed. Sending uses the saved prices, so both must agree first.
  const hasUnsavedChanges = savedItems.some((item) => {
    const now = typed(item);
    return (
      now.install !== item.install_price_cents ||
      now.removal !== item.removal_price_cents ||
      now.minutes !== item.duration_minutes
    );
  });
  const fullyPriced = savedItems.every(
    (item) =>
      (!item.install || item.install_price_cents !== null) &&
      (!item.removal || item.removal_price_cents !== null) &&
      item.duration_minutes !== null,
  );

  function setSectionInput(
    section: string,
    field: keyof SectionInputs[string],
    value: string,
  ) {
    setSectionInputs((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
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

  // Enter jumps to the next empty box (in on-screen order); with none left, it saves.
  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    const current = event.target;
    if (event.key !== "Enter" || !(current instanceof HTMLInputElement)) return;
    event.preventDefault();

    const fields = Array.from(event.currentTarget.elements).filter(
      (el): el is HTMLInputElement =>
        el instanceof HTMLInputElement && el.type !== "hidden" && !el.disabled,
    );
    const next = fields
      .slice(fields.indexOf(current) + 1)
      .find((field) => field.value.trim() === "");

    if (next) next.focus();
    else event.currentTarget.requestSubmit();
  }

  // Each quote's total: its own install prices plus the shared removal and minutes.
  // const totals = quotes.map((quote) => {
  //   let cents = 0;
  //   let minutes = 0;
  //   for (const item of quote.items) {
  //     const now = typed(item);
  //     if (now.install !== null && !Number.isNaN(now.install)) cents += now.install;
  //     if (now.removal !== null && !Number.isNaN(now.removal)) cents += now.removal;
  //     if (now.minutes !== null && !Number.isNaN(now.minutes)) minutes += now.minutes;
  //   }
  //   return { quote, cents, minutes };
  // });

  // Removal and minutes are shared across films, so they're summed once per window (not per quote).
  // Install prices differ per film, so each film quote gets its own total.
  const totals = {
    filmCents: {} as Record<string, number>, // full price per film: its installs + the shared removal
    removalCents: 0,
    minutes: 0,
  };

  // Shared values: once per window, so "Both" doesn't double them and Removal Only still counts.
  for (const section of sections) {
    const removal = needsRemoval(section) ? dollarsToCents(sectionInputs[section].removal_price) : null;
    const minutes = parseMinutes(sectionInputs[section].minutes);
    if (removal !== null && !Number.isNaN(removal)) totals.removalCents += removal;
    if (minutes !== null && !Number.isNaN(minutes)) totals.minutes += minutes;
  }

  for (const quote of filmQuotes) {
    let cents = totals.removalCents; // every film quote includes the same removal work
    for (const item of quote.items) {
      const now = typed(item);
      if (now.install !== null && !Number.isNaN(now.install)) cents += now.install;
    }
    totals.filmCents[quote.film_type!] = cents;
  }


  function priceInput(
    name: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
  ) {
    const error = state.errors[name];
    return (
      <>
        <input
          name={name}
          inputMode="decimal"
          enterKeyHint="next"
          placeholder="0.00"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} ${error ? "border-red-500" : "border-zinc-800"}`}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="mt-8 space-y-6"
    >
      <input type="hidden" name="requestId" value={requestId} />

      <fieldset
        disabled={locked || isPending}
        style={{ "--price-cols": columns } as React.CSSProperties}
        className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
      >
        {/* Mobile: each window is its own stacked block. Desktop: one table-like grid. */}
        <div className="grid grid-cols-1 items-start gap-y-5 md:grid-cols-(--price-cols) md:items-end md:gap-x-3 md:gap-y-3">
          <span className="hidden pl-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:block">
            Window
          </span>
          {showRemoval && <span className={headerClass}>Removal ($)</span>}
          {filmQuotes.map((quote) => (
            <span key={quote.id} className={headerClass}>
              {filmLabels[quote.film_type!]} ($)
            </span>
          ))}
          <span className={headerClass}>Minutes</span>

          {sections.map((section) => {
            const label = sectionLabels[section];
            const minutesName = fieldName("minutes", section);
            const minutesError = state.errors[minutesName];

            return (
              <div
                key={section}
                className="grid grid-cols-2 gap-x-3 gap-y-2 md:contents"
              >
                <p className="col-span-2 font-medium md:col-span-1 md:self-start md:pt-2">
                  {label}
                </p>

                {/* Empty cells keep the desktop columns lined up; on mobile they're dropped. */}
                {showRemoval &&
                  (needsRemoval(section) ? (
                    <div className="md:self-start">
                      <span aria-hidden className={mobileLabelClass}>
                        Removal ($)
                      </span>
                      {priceInput(
                        fieldName("removal_price", section),
                        `${label} removal price`,
                        sectionInputs[section].removal_price,
                        (value) => setSectionInput(section, "removal_price", value),
                      )}
                    </div>
                  ) : (
                    <div aria-hidden className="hidden md:block" />
                  ))}

                {filmQuotes.map((quote) => {
                  const item = itemFor(quote, section);
                  if (!item?.install) {
                    return (
                      <div key={quote.id} aria-hidden className="hidden md:block" />
                    );
                  }
                  const film = filmLabels[quote.film_type!];
                  return (
                    <div key={quote.id} className="md:self-start">
                      <span aria-hidden className={mobileLabelClass}>
                        {film} ($)
                      </span>
                      {priceInput(
                        fieldName("install_price", item.id),
                        `${label} ${film} price`,
                        installInputs[item.id],
                        (value) =>
                          setInstallInputs((current) => ({
                            ...current,
                            [item.id]: value,
                          })),
                      )}
                    </div>
                  );
                })}

                <div className="md:self-start">
                  <span aria-hidden className={mobileLabelClass}>
                    Minutes
                  </span>
                  <input
                    name={minutesName}
                    inputMode="numeric"
                    enterKeyHint="next"
                    placeholder="0"
                    aria-label={`${label} minutes`}
                    value={sectionInputs[section].minutes}
                    onChange={(e) =>
                      setSectionInput(section, "minutes", e.target.value)
                    }
                    className={`${inputClass} ${minutesError ? "border-red-500" : "border-zinc-800"}`}
                  />
                  {minutesError && (
                    <p className="mt-1 text-xs text-red-400">{minutesError}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals line up under their columns. A film's total already includes removal,
            so the removal cell only shows a number when removal is the whole job. */}
        <div className="mt-4 grid grid-cols-1 gap-y-1 border-t border-zinc-800 pt-3 md:grid-cols-(--price-cols) md:gap-x-3">
          <span className="font-semibold md:pl-2">Total</span>

          {showRemoval &&
            <TotalCell label="Removal Only" value={formatMoney(totals.removalCents)} />}

          {filmQuotes.map((quote) => (
            <TotalCell
              key={quote.id}
              label={filmLabels[quote.film_type!]}
              value={formatMoney(totals.filmCents[quote.film_type!])}
            />
          ))}

          <TotalCell
            label="Time"
            value={totals.minutes > 0 ? `${formatMinutes(totals.minutes)}` : "—"}
          />
        </div>
      </fieldset>

      {!locked && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending || isSending}
              className="w-full rounded-full bg-red-600 px-6 py-3 md:w-auto font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save prices"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={
                !fullyPriced || hasUnsavedChanges || isPending || isSending
              }
              className="w-full rounded-full border border-zinc-500 px-6 py-3 md:w-auto font-bold text-zinc-100 transition-colors hover:border-zinc-300 disabled:opacity-40"
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
      {sendState.url ? (
        <CustomerLink
          url={sendState.url}
          message={sendState.message}
          customer={customer}
        />
      ) : (
        locked && <RecreateLink requestId={requestId} customer={customer} />
      )}
    </form>
  );
}

function TotalCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between md:block md:text-right">
      <span className="text-sm text-zinc-400 md:hidden">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
