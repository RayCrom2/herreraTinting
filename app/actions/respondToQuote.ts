"use server";
import { refresh } from "next/cache";
import { supabase as admin } from "../lib/supabase/admin";
import { createToken, hashToken, bookingLinkUrl, TOKEN, UUID } from "../lib/quoteLinks";
import { type RespondState } from "../lib/quote";
import { redirect } from "next/navigation";

// Public action: anyone can call it, so it trusts nothing from the page but the token.
export async function respondToQuote(_prevState: RespondState, formData: FormData): Promise<RespondState> {
  const token = String(formData.get("token") ?? "");
  const response = String(formData.get("response") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");

  if (!TOKEN.test(token)) return { message: "This quote link isn't valid." };

  let changes;
  if (response === "accept" && UUID.test(quoteId)) {
    const bookingToken = createToken();
    const { error } = await admin.rpc("accept_quote", {
      p_quote_link_token_hash: hashToken(token),
      p_quote_id: quoteId,
      p_booking_link_token_hash: hashToken(bookingToken),
    });
    if (error) {
      console.error("Failed to accept this quote: ", error);
      // P0001 is accept_quote's own `raise exception`: the link was already answered, revoked or expired.
      if (error.code === "P0001") {
        return { message: "This quote can't be changed anymore. Text us if you need help." };
      }
      return { message: "Something went wrong. Please try again." };
    }
    const bookingUrl = bookingLinkUrl(bookingToken);
    redirect(bookingUrl);
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
    .eq("token_hash", hashToken(token))
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
