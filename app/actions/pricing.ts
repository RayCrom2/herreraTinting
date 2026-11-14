"use server";
import { refresh } from "next/cache";
import { requireStaff } from "../lib/dal";
import { dollarsToCents, parseMinutes, fieldName, type PricingState } from "../lib/quote";

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

  for (const quote of request.quotes) {
    for (const item of quote.quote_items) {
      // Install price is per film (item id). Removal and minutes don't depend on the film,
      // so the form has one box per window (section) and every quote's item gets that value.
      const installName = fieldName("install_price", item.id);
      const removalName = fieldName("removal_price", item.section);
      const minutesName = fieldName("minutes", item.section);
      // Only read a price for the work this row does; the schema requires the other to stay null.
      const installPrice = item.install ? dollarsToCents(String(formData.get(installName) ?? "")) : null;
      const removalPrice = item.removal ? dollarsToCents(String(formData.get(removalName) ?? "")) : null;
      const minutes = parseMinutes(String(formData.get(minutesName) ?? ""));

      if (Number.isNaN(installPrice)) errors[installName] = "Enter a dollar amount, like 120 or 120.50.";
      if (Number.isNaN(removalPrice)) errors[removalName] = "Enter a dollar amount, like 120 or 120.50.";
      if (Number.isNaN(minutes)) errors[minutesName] = "Enter whole minutes above 0.";

      itemRows.push({ ...item, install_price_cents: installPrice, removal_price_cents: removalPrice, duration_minutes: minutes });
    }
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Fix the highlighted boxes, then save again.", errors };
  }

  // Rows carry their existing quote_id/section/install/removal because upsert needs full rows.
  const { error: itemsError } = await supabase.from("quote_items").upsert(itemRows, { onConflict: "id" });
  if (itemsError) {
    console.error("Failed to save quote item prices:", itemsError);
    return { status: "error", message: "Something went wrong saving prices. Please try again.", errors: {} };
  }

  // One note per request, written onto each of its quotes. Blank clears it.
  const staffNote = String(formData.get("staffNote") ?? "").trim().slice(0, 1000) || null;
  const { error: noteError } = await supabase
    .from("quotes")
    .update({ staff_note: staffNote })
    .in("id", request.quotes.map((quote) => quote.id));
  if (noteError) {
    console.error("Failed to save staff note:", noteError);
    return { status: "error", message: "Prices saved, but the note didn't. Save again.", errors: {} };
  }

  refresh();
  return { status: "saved", message: "Saved.", errors: {} };
}
