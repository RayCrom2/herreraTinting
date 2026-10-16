"use server";
import { refresh } from "next/cache";
import { requireStaff } from "../lib/dal";
import { dollarsToCents, parseMinutes, type PricingState } from "../lib/quote";

export async function savePricing(_prevState: PricingState, formData: FormData): Promise<PricingState> {
  const { supabase } = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");

  // Load this request's items from the database. Only these get updated, whatever the form sends.
  const { data: request, error: loadError } = await supabase
    .from("quote_requests")
    .select("replied_at, quotes ( id, quote_items ( id, quote_id, section, install, removal ) )")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError || !request) {
    return { status: "error", message: "Couldn't find this quote request.", errors: {} };
  }
  if (request.replied_at) {
    return { status: "error", message: "This quote was already sent, so its prices are locked.", errors: {} };
  }

  const errors: Record<string, string> = {};
  const itemRows = [];
  const quoteTotals = [];

  for (const quote of request.quotes) {
    let totalCents: number | null = null;
    let totalMinutes: number | null = null;

    for (const item of quote.quote_items) {
      const priceName = `price:${item.id}`;
      const minutesName = `minutes:${item.id}`;
      const price = dollarsToCents(String(formData.get(priceName) ?? ""));
      const minutes = parseMinutes(String(formData.get(minutesName) ?? ""));

      if (Number.isNaN(price)) errors[priceName] = "Enter a dollar amount, like 120 or 120.50.";
      if (Number.isNaN(minutes)) errors[minutesName] = "Enter whole minutes above 0.";

      itemRows.push({ ...item, price_cents: price, duration_minutes: minutes });
      if (price !== null) totalCents = (totalCents ?? 0) + price;
      if (minutes !== null) totalMinutes = (totalMinutes ?? 0) + minutes;
    }

    quoteTotals.push({ id: quote.id, total_cost_cents: totalCents, duration_minutes: totalMinutes });
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Fix the highlighted boxes, then save again.", errors };
  }

  // One statement for all items, so they save together or not at all.
  // Rows carry their existing quote_id/section/install/removal because upsert needs full rows.
  const { error: itemsError } = await supabase.from("quote_items").upsert(itemRows, { onConflict: "id" });
  if (itemsError) {
    console.error("Failed to save quote item prices:", itemsError);
    return { status: "error", message: "Something went wrong saving prices. Please try again.", errors: {} };
  }

  // Totals are recomputed from the items on every save, so a failure here fixes itself next save.
  const totalResults = await Promise.all(
    quoteTotals.map(({ id, ...totals }) => supabase.from("quotes").update(totals).eq("id", id)),
  );
  const totalsError = totalResults.find((result) => result.error)?.error;
  if (totalsError) {
    console.error("Failed to save quote totals:", totalsError);
    return { status: "error", message: "Prices saved, but totals didn't update. Save again.", errors: {} };
  }

  refresh();
  return { status: "saved", message: "Saved.", errors: {} };
}
