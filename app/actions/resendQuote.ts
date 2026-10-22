"use server";
import { refresh } from "next/cache";
import { requireStaff } from "../lib/dal";
import { createQuoteToken, hashQuoteToken, quoteLinkUrl } from "../lib/quoteLinks";
import type { SendState } from "../lib/quote";

export async function resendQuote(requestId: string, _prevState: SendState): Promise<SendState> {
    const { supabase } = await requireStaff();

    const token = createQuoteToken();

    // resend_quote revokes the active link and stores the new hash in one transaction.
    const { error } = await supabase.rpc("resend_quote", {
        p_request_id: requestId,
        p_token_hash: hashQuoteToken(token),
    });

    if (error) {
        // The function's own messages are safe to show; anything else gets logged.
        if (error.message.includes("not found")) {
        return { status: "error", message: "This quote was not found or was never sent.", url: null };
        }
        if (error.message.includes("already responded")) {
        return { status: "error", message: "Customer already accepted or declined this quote.", url: null };
        }
        console.error("Failed to resend quote:", error);
        return { status: "error", message: "Something went wrong sending the quote. Please try again.", url: null };
    }


    refresh();
    // This is the only time the full link exists; the database keeps just its hash.
    return { status: "sent", message: "New link created; the old one no longer works. Copy it and text it to the customer.", url: quoteLinkUrl(token) };
}