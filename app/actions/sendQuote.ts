"use server";
import { refresh } from "next/cache";
import { requireStaff } from "../lib/dal";
import { createQuoteToken, hashQuoteToken, quoteLinkUrl, UUID } from "../lib/quoteLinks";
import type { SendState } from "../lib/quote";

export async function sendQuote(_prevState: SendState, formData: FormData): Promise<SendState> {
  const { supabase } = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  
  if (!UUID.test(requestId)) {
    return { status: "error", message: "...", url: null };
  }

  const token = createQuoteToken();

  // send_quote locks the request (sets replied_at) and stores the hash in one transaction.
  const { error } = await supabase.rpc("send_quote", {
    p_request_id: requestId,
    p_token_hash: hashQuoteToken(token),
  });

  if (error) {
    // The function's own messages are safe to show; anything else gets logged.
    if (error.message.includes("already sent")) {
      return { status: "error", message: "This quote was already sent.", url: null };
    }
    if (error.message.includes("price and time")) {
      return { status: "error", message: "Every window needs a saved price and time first.", url: null };
    }
    console.error("Failed to send quote:", error);
    return { status: "error", message: "Something went wrong sending the quote. Please try again.", url: null };
  }

  refresh();
  // This is the only time the full link exists; the database keeps just its hash.
  return { status: "sent", message: "Quote recorded. Copy the link and text it to the customer.", url: quoteLinkUrl(token) };
}
