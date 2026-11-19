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
  PricingQuote,
  Price,
  InstallTime,
  oldTintConditions,
} from "../../../lib/quote";
import CustomerLink, { type Customer } from "./CustomerLink";
import RecreateLink from "./RecreateLink";
import VehicleTypePreset from "./VehicleTypePreset";

const inputClass =
  "w-full rounded-lg border bg-black px-3 py-2 text-right text-zinc-100 tabular-nums focus:border-red-500 focus:outline-none disabled:opacity-60";
const headerClass =
  "hidden text-right text-xs font-semibold uppercase tracking-wide md:block";
const mobileLabelClass = "mb-1 block text-xs md:hidden";
// One color per column, shared by the desktop headers, mobile labels and totals.
const filmColors: Record<string, string> = {
  "c2-carbon": "text-blue-400",
  "pronano-ceramic": "text-orange-400",
};
const removalColor = "text-rose-300";
const minutesColor = "text-zinc-300";

// Removal price and minutes don't depend on the film, so they're typed once per window (section).
// Install price is per film, so it's typed per item.
type SectionInputs = Record<string, { removal_price: string; minutes: string }>;
type InstallInputs = Record<string, string>;

const centsToInput = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2);

// `color` tints the label (mobile) and the number, so each total matches its column header.
function TotalCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between md:block md:text-right">
      <span className={`text-sm md:hidden ${color}`}>{label}</span>
      <span className={`font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function PricingForm({
  requestId,
  quotes,
  locked,
  customer,
  vehicleType,
  prices,
  installTimes,
  currentCondition,
  staffNote,
}: {
  requestId: string;
  quotes: PricingQuote[];
  locked: boolean;
  customer: Customer;
  vehicleType: string | null;
  prices: Price[];
  installTimes: InstallTime[];
  currentCondition: string | null;
  staffNote: string;
}) {
  const [state, formAction, isPending] = useActionState(
    savePricing,
    initialPricingState,
  );
  const [sendState, sendAction, isSending] = useActionState(
    sendQuote,
    initialSendState,
  );

  // Every window on the request, front to back, and which quote's item covers it.
  const savedItems = quotes.flatMap((quote) => quote.items);
  const [preset, setPreset] = useState(vehicleType);
  const [noteInput, setNoteInput] = useState(staffNote);

  //one list of the window sections for the quote without duplicates
  const sections = sortSections([
    ...new Set(savedItems.map((item) => item.section)),
  ]);

  const itemFor = (quote: PricingQuote, section: string) =>
    quote.items.find((item) => item.section === section);
  const needsRemoval = (section: string) =>
    savedItems.some((item) => item.section === section && item.removal);

  // Columns: one install column per film (C2, then ProNano), removal (if any window has it), then minutes.
  const filmQuotes = quotes.filter((quote) => quote.film_type !== null);
  const showRemoval = sections.some(needsRemoval);
  const columns = `minmax(0,1fr) ${filmQuotes.map(() => "7rem ").join("")}${showRemoval ? "7rem " : ""}5.5rem`;

  // The price list stores front and rear sides as one row.
  const listSection = (section: string) =>
    section === "front-sides" || section === "rear-sides"
      ? "side-pair"
      : section;
  // Only c2-carbon film is available for sunstrip
  const listFilm = (film: string, section: string) =>
    section === "sunstrip" ? "c2-carbon" : film;

  // The price list row for a vehicle type, film and window.
  const priceFor = (type: string, film: string, section: string) =>
    prices.find(
      (price) =>
        price.vehicle_type === type &&
        price.film_type === listFilm(film, section) &&
        price.section === listSection(section),
    );

  // The install time for a vehicle type and window. It's the same for every film.
  const installTimeFor = (type: string, section: string) =>
    installTimes.find(
      (time) =>
        time.vehicle_type === type && time.section === listSection(section),
    );

  // What the price list suggests for a vehicle type, as input strings.
  // Install is per item; minutes are shared per section.
  function presetValues(type: string | null) {
    const install: Record<string, string> = {}; // item.id -> price input
    const minutes: Record<string, string> = {}; // section -> minutes input
    if (!type) return { install, minutes };

    for (const quote of filmQuotes) {
      for (const item of quote.items) {
        if (!item.install) continue;
        const match = priceFor(type, quote.film_type!, item.section);
        if (match) install[item.id] = centsToInput(match.install_price_cents);
      }
    }
    // Only windows getting new tint take an install time; removal-only windows are timed by hand.
    for (const section of sections) {
      if (!savedItems.some((item) => item.section === section && item.install))
        continue;
      const time = installTimeFor(type, section);
      if (time) minutes[section] = String(time.install_duration_minutes);
    }
    return { install, minutes };
  }

  // Controlled so totals update as staff type. Saved values win; empty ones start from the price list.
  const [sectionInputs, setSectionInputs] = useState<SectionInputs>(() => {
    const preset = presetValues(vehicleType);
    return Object.fromEntries(
      sections.map((section) => {
        const first = savedItems.find((item) => item.section === section)!;
        return [
          section,
          {
            removal_price: centsToInput(first.removal_price_cents),
            minutes:
              first.duration_minutes !== null
                ? String(first.duration_minutes)
                : (preset.minutes[section] ?? ""),
          },
        ];
      }),
    );
  });
  const [installInputs, setInstallInputs] = useState<InstallInputs>(() => {
    const preset = presetValues(vehicleType);
    return Object.fromEntries(
      savedItems.map((item) => [
        item.id,
        item.install_price_cents !== null
          ? centsToInput(item.install_price_cents)
          : (preset.install[item.id] ?? ""),
      ]),
    );
  });

  // Picking a type overwrites install prices and minutes with the price list.
  // Anything without a matching row keeps whatever is already typed.
  function applyPreset(type: string) {
    setPreset(type);
    const next = presetValues(type);

    setInstallInputs((current) => ({ ...current, ...next.install }));
    setSectionInputs((current) =>
      Object.fromEntries(
        Object.entries(current).map(([section, inputs]) => [
          section,
          { ...inputs, minutes: next.minutes[section] ?? inputs.minutes },
        ]),
      ),
    );
  }

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
  const hasUnsavedChanges =
    noteInput.trim() !== staffNote ||
    savedItems.some((item) => {
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

  // Removal and minutes are shared across films, so they're summed once per window (not per quote).
  // Install prices differ per film, so each film quote gets its own total.
  const totals = {
    filmCents: {} as Record<string, number>, // full price per film: its installs + the shared removal
    removalCents: 0,
    minutes: 0,
  };

  // Shared values: once per window, so "Both" doesn't double them and Removal Only still counts.
  for (const section of sections) {
    const removal = needsRemoval(section)
      ? dollarsToCents(sectionInputs[section].removal_price)
      : null;
    const minutes = parseMinutes(sectionInputs[section].minutes);
    if (removal !== null && !Number.isNaN(removal))
      totals.removalCents += removal;
    if (minutes !== null && !Number.isNaN(minutes)) totals.minutes += minutes;
  }

  for (const quote of filmQuotes) {
    let cents = totals.removalCents; // every film quote includes the same removal work
    for (const item of quote.items) {
      const now = typed(item);
      if (now.install !== null && !Number.isNaN(now.install))
        cents += now.install;
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
    <div>
      <div className="flex items-end gap-4">
        {currentCondition &&
          (() => {
            const condition = oldTintConditions.find(
              (c) => c.value === currentCondition,
            );
            return (
              <p className="text-base text-zinc-300">
                Old tint condition:{" "}
                <span className={condition?.color}>
                  {condition?.label ?? currentCondition}
                </span>
              </p>
            );
          })()}
        {/* In normal flow (not absolute) so it pushes the form down instead of overlapping it. */}
        <div className="ml-auto justify-end">
          <VehicleTypePreset
            value={preset}
            onChange={applyPreset}
            locked={locked}
          />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="mt-3 space-y-6"
      >
        <input type="hidden" name="requestId" value={requestId} />

        <fieldset
          disabled={locked || isPending}
          style={{ "--price-cols": columns } as React.CSSProperties}
          className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          {/* Mobile: each window is its own stacked block. Desktop: one table-like grid. */}
          <div className="grid grid-cols-1 items-start gap-y-5 md:grid-cols-(--price-cols) md:items-end md:gap-x-3 md:gap-y-0">
            <span className="hidden pl-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:block">
              Window
            </span>
            {filmQuotes.map((quote) => (
              <span
                key={quote.id}
                className={`${headerClass} ${filmColors[quote.film_type!]}`}
              >
                {filmLabels[quote.film_type!]} ($)
              </span>
            ))}
            {showRemoval && (
              <span className={`${headerClass} ${removalColor}`}>
                Removal ($)
              </span>
            )}
            <span className={`${headerClass} ${minutesColor}`}>Minutes</span>

            {sections.map((section, idx) => {
              const label = sectionLabels[section];
              const minutesName = fieldName("minutes", section);
              const minutesError = state.errors[minutesName];

              return (
                <div
                  key={section}
                  className={`grid grid-cols-2 gap-x-3 max-md:px-2 gap-y-2 rounded-lg py-2 md:col-span-full md:grid-cols-subgrid ${idx % 2 === 0 ? "max-md:bg-zinc-900" : ""}`}
                >
                  <p className="col-span-2 font-bold md:col-span-1 md:self-start md:pt-2">
                    {label}
                  </p>

                  {/* Empty cells keep the desktop columns lined up; on mobile they're dropped. */}
                  {filmQuotes.map((quote) => {
                    const item = itemFor(quote, section);
                    if (!item?.install) {
                      return (
                        <div
                          key={quote.id}
                          aria-hidden
                          className="hidden md:block"
                        />
                      );
                    }
                    const film = filmLabels[quote.film_type!];
                    return (
                      <div key={quote.id} className="md:self-start">
                        <span
                          aria-hidden
                          className={`${mobileLabelClass} ${filmColors[quote.film_type!]}`}
                        >
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

                  {showRemoval &&
                    (needsRemoval(section) ? (
                      <div className="md:self-start">
                        <span
                          aria-hidden
                          className={`${mobileLabelClass} ${removalColor}`}
                        >
                          Removal ($)
                        </span>
                        {priceInput(
                          fieldName("removal_price", section),
                          `${label} removal price`,
                          sectionInputs[section].removal_price,
                          (value) =>
                            setSectionInput(section, "removal_price", value),
                        )}
                      </div>
                    ) : (
                      <div aria-hidden className="invisible" />
                    ))}

                  <div className="md:self-start">
                    <span
                      aria-hidden
                      className={`${mobileLabelClass} ${minutesColor}`}
                    >
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
                      <p className="mt-1 text-xs text-red-400">
                        {minutesError}
                      </p>
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

            {filmQuotes.map((quote) => (
              <TotalCell
                key={quote.id}
                label={filmLabels[quote.film_type!]}
                value={formatMoney(totals.filmCents[quote.film_type!])}
                color={filmColors[quote.film_type!]}
              />
            ))}

            {showRemoval && (
              <TotalCell
                label="Removal Only"
                value={formatMoney(totals.removalCents)}
                color={removalColor}
              />
            )}

            <TotalCell
              label="Time"
              color={minutesColor}
              value={
                totals.minutes > 0 ? `${formatMinutes(totals.minutes)}` : "—"
              }
            />
          </div>

          {/* Saved with the prices. A textarea, so Enter adds a line instead of jumping fields. */}
          <div className="mt-4 border-t border-zinc-800 pt-3">
            <label
              htmlFor="staffNote"
              className="mb-1 block text-sm font-semibold md:pl-2"
            >
              Staff note
            </label>
            <textarea
              id="staffNote"
              name="staffNote"
              rows={3}
              maxLength={1000}
              placeholder="Anything to add to this quote"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-zinc-100 focus:border-red-500 focus:outline-none disabled:opacity-60"
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
    </div>
  );
}
