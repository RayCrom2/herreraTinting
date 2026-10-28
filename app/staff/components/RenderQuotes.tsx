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
import { useState } from "react";

export default function RenderQuote({ requests }: { requests: Request[] }) {
  const filterOptions: string[] = [
    "all",
    "open",
    "sent",
    // "accepted",
    // "expired",
    // "declined",
  ];
  const [selectedOption, setSelectedOption] = useState("open");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isNonDescendingOrder, setIsNonDescendingOrder] =
    useState<boolean>(true);
  const [search, setSearch] = useState("");

  const byStatus =
    selectedOption === "all"
      ? requests
      : requests.filter((r) => {
          if (selectedOption.toLowerCase() === "open") {
            return r.replied_at === null;
          } else if (selectedOption.toLowerCase() === "sent") {
            return r.replied_at !== null;
          }
          return false;
        });

  // Match the search against name, phone, and vehicle, ignoring case.
  const query = search.trim().toLowerCase();
  const filtered = byStatus.filter((r) =>
    [
      r.first_name,
      r.last_name,
      r.phone,
      r.vehicle_year,
      r.vehicle_make,
      r.vehicle_model,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );

  const displayedQuotes = isNonDescendingOrder
    ? filtered
    : filtered.toReversed();

  return (
    <div className="grid">
      <h1 className="text-2xl font-bold">
        {formatProperNoun(selectedOption)} Quotes
      </h1>
      <div className="flex flex-wrap gap-2 pb-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, vehicle…"
          className="w-full md:mr-auto md:w-72 rounded border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setIsNonDescendingOrder((prev) => !prev)}
          className={`w-26 rounded border px-3 py-2 text-sm ${isNonDescendingOrder ? "border-red-600 bg-red-600 text-white font-bold hover:border-red-500 hover:bg-red-500" : "border-zinc-500 text-zinc-200 hover:border-zinc-300 hover:bg-zinc-800"}`}
        >
          {isNonDescendingOrder ? "Ascending" : "Descending"}
        </button>

        {/* Filter dropdown: shows the current filter, click to pick another */}
        <div className="relative w-32">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex w-full items-center justify-between rounded border border-zinc-700 px-3 py-2 text-sm capitalize hover:bg-zinc-800"
          >
            {selectedOption}
            <span className="text-zinc-400">{isOpen ? "▲" : "▼"}</span>
          </button>

          {isOpen && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-zinc-700 bg-zinc-900 text-sm">
              {filterOptions.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOption(option);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left capitalize hover:bg-zinc-800 ${
                      selectedOption === option ? "text-red-500" : ""
                    }`}
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-1 flex gap-4 px-2 text-sm text-zinc-400 pb-2">
        {displayedQuotes.length} quotes,{" "}
        {isNonDescendingOrder ? "oldest" : "newest"} first
        {/* Column labels only make sense when the dates are columns (desktop) */}
        <span className="ml-auto hidden w-36 md:block">Date Quoted:</span>
        <span className="hidden w-36 md:block">Date Requested:</span>
        <span className="hidden w-32 md:block" /> {/* the button-width spacer */}
      </p>

      <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
        {displayedQuotes.map((r) => {
          const films = r.quotes.map((q) =>
            q.film_type ? filmLabels[q.film_type] : "Removal only",
          );
          // Every quote on a request has the same windows, so read them from the first.
          const sections = sortSections(
            r.quotes[0]?.quote_items.map((i) => i.section) ?? [],
          );

          return (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 px-2 py-4 md:flex-nowrap"
            >
              <div className="min-w-0 basis-full md:basis-auto md:flex-1">
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
                {/* On mobile the date columns are hidden, so show them inline */}
                <p className="mt-1 text-xs text-zinc-500 md:hidden">
                  Requested {shopDateFormat.format(new Date(r.created_at))}
                  {r.replied_at &&
                    ` · Quoted ${shopDateFormat.format(new Date(r.created_at))}`}
                </p>
              </div>
              <span className="hidden w-36 shrink-0 text-sm text-zinc-400 text-center pr-10 md:block">
                {r.replied_at
                  ? shopDateFormat.format(new Date(r.created_at))
                  : "-"}
              </span>
              <span className="hidden w-36 shrink-0 text-sm text-zinc-400 pl-1 md:block">
                {shopDateFormat.format(new Date(r.created_at))}
              </span>
              <Link
                href={`/staff/quotes/${r.id}`}
                className={`w-full md:w-32 shrink-0 text-center rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  r.replied_at
                    ? "border-zinc-500 text-zinc-200 hover:border-zinc-300 hover:bg-zinc-800"
                    : "border-red-600 bg-red-600 text-white hover:border-red-500 hover:bg-red-500"
                }`}
              >
                {r.replied_at ? "View quote" : "Price Quote"}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
