import { Timestamp } from "next/dist/server/lib/cache-handlers/types";
import { UUID } from "./quoteLinks";

export type FormState = {
  success: boolean;
  errors: Record<string, string>;
  values: Record<string, string | string[]>;
};

export const initialState: FormState = { success: false, errors: {}, values: {} };

export type PricingState = {
  status: "idle" | "saved" | "error";
  message: string;
  errors: Record<string, string>; // keyed by input name, e.g. "price:<item id>"
};

export const initialPricingState: PricingState = { status: "idle", message: "", errors: {} };

export type SendState = {
  status: "idle" | "sent" | "error";
  message: string;
  url: string | null; // the customer link, returned once right after sending
};

export const initialSendState: SendState = { status: "idle", message: "", url: null };

// Success re-renders the customer page with their answer, so only errors need a message.
export type RespondState = { message: string | null };

export const initialRespondState: RespondState = { message: null };

export const filmLabels: Record<string, string> = {
  "c2-carbon": "C2 Carbon",
  "pronano-ceramic": "ProNano Ceramic",
};

export const filmDescriptions: Record<string, string> = {
  "c2-carbon": "Best value · Great heat & UV rejection",
  "pronano-ceramic": "Highest heat rejection",
};

// Keys are in display order, front of the car to back.
export const sectionLabels: Record<string, string> = {
  windshield: "Windshield",
  sunstrip: "Sunstrip",
  "front-sides": "Front Sides",
  "rear-sides": "Rear Sides",
  "rear-windshield": "Rear Windshield",
  sunroof: "Sunroof",
};



const sectionOrder = Object.keys(sectionLabels);

export function sortSections(sections: string[]) {
  return [...sections].sort((a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b));
}

export function sortBySection<T extends { section: string }>(items: T[]) {
  return [...items].sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section));
}

// Films in display order; removal-only quotes (no film) go last.
export function sortByFilm<T extends { film_type: string | null }>(quotes: T[]) {
  const order = Object.keys(filmLabels);
  const rank = (film: string | null) => (film === null ? order.length : order.indexOf(film));
  return [...quotes].sort((a, b) => rank(a.film_type) - rank(b.film_type));
}

export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} minutes`;
  if (hours === 1){
    if (minutes === 0) return '1 hour';
    if (minutes === 1) return '1 hour 1 minute';
    return `1 hour ${minutes} minutes`
  }
  if (minutes === 0) return `${hours} hours`;
  if (minutes === 1) return `${hours} hours 1 minute`
  
  return `${hours} hours ${minutes} minutes`;
}

export function formatPhone(digits: string | null) {
  if (!digits || digits.length !== 10) return digits ?? "";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatProperNoun(s: string) {
  if (!s) return;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// "120", "120.5", "$1,200.00" -> cents. Blank -> null (not priced yet). Anything else -> NaN.
export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

// Blank -> null (not set yet). Anything but a whole number above 0 -> NaN.
export function parseMinutes(input: string): number | null {
  const cleaned = input.trim();
  if (cleaned === "") return null;
  const minutes = Number(cleaned);
  return Number.isInteger(minutes) && minutes > 0 ? minutes : NaN;
}

export type PricingItem = {
  id: string;
  section: string;
  install: boolean;
  removal: boolean;
  install_price_cents: number | null;
};

export type PricingQuote = {
  id: string;
  film_type: string | null;
  removal_price_cents: number | null; // one removal price for the whole quote
  duration_minutes: number | null;    // total time for the whole quote
  items: PricingItem[];
};

// Fixed time zone so times match the shop's clock, whatever time zone the server is in.
export const shopDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export type Request = {
 id: string,
 created_at: string,
 first_name: string,
 last_name: string,
 phone: string,
 vehicle_type: string | null,
 vehicle_year: string,
 vehicle_make: string,
 vehicle_model: string,
 removal_request: string,
 replied_at?: string,
 quotes: {
 film_type: string | null,
 quote_items: {
 section: string,
 }[],
 }[],
};

export type Price = {
  vehicle_type: string;
  film_type: string;
  section: string;
  install_price_cents: number;
};

// export type InstallTime = {
//   vehicle_type: string;
//   section: string;
//   install_duration_minutes: number;
// };


export const vehicleTypes = [
  {
    value: "coupe",
    label: "Coupe",
  },
  {
    value: "sedan",
    label: "Sedan",
  },
  {
    value: "suv",
    label: "SUV",
  },
  {
    value: "truck",
    label: "Truck",
  },
];

type tintConditions = {
  value: string;
  label: string;
}
export const oldTintConditions: tintConditions[] = [
{
    value: "peeling",
    label: "Peeling",
  },
  {
    value: "bubbly",
    label: "Bubbly",
  },
  {
    value: "faded",
    label: "Faded",
  },
  {
    value: "blurry_hazy",
    label: "Blurry/Hazy",
  },
  {
    value: "discolored",
    label: "Discolored",
  },
  {
    value: "fine",
    label: "Looks fine",
  },
  {
    value: "other",
    label: "Other",

  },
]

export const fieldName = (kind: "install_price" | "removal_price" | "minutes", id: string):string => {
  return `${kind}:${id}`;
}

// Shown as their own line to customers; every other window is added into one "Side & rear windows" line.
const separateSections = new Set(["windshield", "sunstrip", "sunroof"]);

export type CustomerLineItem = {
  label: string;
  detail?: string; // the windows inside a combined line, shown small under the label
  install_price_cents: number;
};

// Install lines for the customer's quote, front to back. Removal-only windows are skipped
// (removal has its own subtotal); the combined line sits where its first window would be.
export function customerLineItems(
  items: { section: string; install_price_cents: number | null }[],
): CustomerLineItem[] {
  const result: CustomerLineItem[] = [];
  const combinedNames: string[] = [];
  let combinedCents = 0;
  let combinedIndex = -1;

  sortBySection(items).forEach((item) => {
    if (item.install_price_cents === null) return; // removal-only window

    const label = sectionLabels[item.section] ?? item.section;
    if (separateSections.has(item.section)) {
      result.push({ label, install_price_cents: item.install_price_cents });
    } else {
      if (combinedIndex === -1) combinedIndex = result.length;
      combinedNames.push(label);
      combinedCents += item.install_price_cents;
    }
  });

  if (combinedIndex !== -1) {
    // One window keeps its own name; several get a short label with the list underneath.
    const line: CustomerLineItem =
      combinedNames.length === 1
        ? { label: combinedNames[0], install_price_cents: combinedCents }
        : {
            label: "Side & rear windows",
            detail: combinedNames.join(", "),
            install_price_cents: combinedCents,
          };
    result.splice(combinedIndex, 0, line);
  }
  return result;
}


export function quoteTotalCents(quote: {removal_price_cents: number | null; quote_items: {install_price_cents: number | null;}[]}){
  const installPrice = quote.quote_items.reduce((total, item) => total + (item.install_price_cents ?? 0), 0);
  const removalPrice = quote.removal_price_cents ?? 0;
  return installPrice + removalPrice;
}