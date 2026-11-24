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
      // Install price is per film, so the form has one box per item (named by item id).
      const installName = fieldName("install_price", item.id);
      // Only a window being tinted gets an install price; the schema requires it to stay null otherwise.
      const installPrice = item.install ? dollarsToCents(String(formData.get(installName) ?? "")) : null;

      if (Number.isNaN(installPrice)) errors[installName] = "Enter a dollar amount, like 120 or 120.50.";

      itemRows.push({ ...item, install_price_cents: installPrice });
    }
  }

  // Removal price and time are one box each for the whole request. Blank saves null (not set yet),
  // which send_quote refuses; a request with no removal always saves a null removal price.
  const hasRemoval = request.quotes.some((quote) => quote.quote_items.some((item) => item.removal));
  const removalPrice = hasRemoval ? dollarsToCents(String(formData.get("removalPrice") ?? "")) : null;
  const minutes = parseMinutes(String(formData.get("durationMinutes") ?? ""));

  // Keys match the form's input names, so each message shows under its box.
  if (Number.isNaN(removalPrice)) errors["removalPrice"] = "Enter a dollar amount, like 120 or 120.50.";
  if (Number.isNaN(minutes)) errors["durationMinutes"] = "Enter whole minutes above 0.";

  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Fix the highlighted boxes, then save again.", errors };
  }

  // Rows carry their existing quote_id/section/install/removal because upsert needs full rows.
  const { error: itemsError } = await supabase.from("quote_items").upsert(itemRows, { onConflict: "id" });
  if (itemsError) {
    console.error("Failed to save quote item prices:", itemsError);
    return { status: "error", message: "Something went wrong saving prices. Please try again.", errors: {} };
  }

  // Removal price, time and note are per request, so every one of its quotes gets the same values.
  // Blank note clears it.
  const staffNote = String(formData.get("staffNote") ?? "").trim().slice(0, 1000) || null;
  const { error: quoteError } = await supabase
    .from("quotes")
    .update({ removal_price_cents: removalPrice, duration_minutes: minutes, staff_note: staffNote })
    .in("id", request.quotes.map((quote) => quote.id));
  if (quoteError) {
    console.error("Failed to save quote removal price, time and note:", quoteError);
    return {
      status: "error",
      message: "Install prices saved, but removal, time and note didn't. Save again.",
      errors: {},
    };
  }

  refresh();
  return { status: "saved", message: "Saved.", errors: {} };
}
