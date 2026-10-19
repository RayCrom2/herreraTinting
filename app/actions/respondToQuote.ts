"use server";
import { refresh } from "next/cache";
import { supabase as admin } from "../lib/supabase/admin";
import { hashQuoteToken } from "../lib/quoteLinks";
import type { RespondState } from "../lib/quote";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public action: anyone can call it, so it trusts nothing from the page but the token.
export async function respondToQuote(_prevState: RespondState, formData: FormData): Promise<RespondState> {
  const token = String(formData.get("token") ?? "");
  const response = String(formData.get("response") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");

  if (!TOKEN.test(token)) return { message: "This quote link isn't valid." };

  let changes;
  if (response === "accept" && UUID.test(quoteId)) {
    // The quote_links_accepted_quote_fkey constraint rejects a quote from any other request.
    changes = { status: "accepted", accepted_quote_id: quoteId };
  } else if (response === "decline") {
    changes = { status: "declined" };
  } else {
    return { message: "Something went wrong. Please try again." };
  }

  // One guarded update: only this token's link, only while it's active and unexpired.
  // If it was already answered, revoked or expired, no row matches and nothing changes.
  const { data, error } = await admin
    .from("quote_links")
    .update(changes)
    .eq("token_hash", hashQuoteToken(token))
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("Failed to record quote response:", error);
    return { message: "Something went wrong. Please try again." };
  }
  if (data.length === 0) {
    return { message: "This quote can't be changed anymore. Text us if you need help." };
  }

  refresh();
  return { message: null };
}
