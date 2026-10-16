export type FormState = {
  success: boolean;
  errors: Record<string, string>;
  values: Record<string, string | string[]>;
};

export const initialState: FormState = { success: false, errors: {}, values: {} };

export const filmLabels: Record<string, string> = {
  "c2-carbon": "C2 Carbon",
  "pronano-ceramic": "ProNano Ceramic",
};

// Keys are in display order, front of the car to back.
export const sectionLabels: Record<string, string> = {
  windshield: "Windshield",
  sunstrip: "Sunstrip",
  "front-sides": "Front sides",
  "rear-sides": "Rear sides",
  "rear-windshield": "Rear windshield",
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
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
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
  price_cents: number | null;
  duration_minutes: number | null;
};

export type PricingQuote = {
  id: string;
  film_type: string | null;
  items: PricingItem[];
};

export type PricingState = {
  status: "idle" | "saved" | "error";
  message: string;
  errors: Record<string, string>; // keyed by input name, e.g. "price:<item id>"
};

export const initialPricingState: PricingState = { status: "idle", message: "", errors: {} };

export function formatPhone(digits: string | null) {
  if (!digits || digits.length !== 10) return digits ?? "";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Fixed time zone so times match the shop's clock, whatever time zone the server is in.
export const shopDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
