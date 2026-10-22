"use client";

import { startTransition, useActionState, useState } from "react";
import { initialSendState } from "@/app/lib/quote";
import { resendQuote } from "@/app/actions/resendQuote";
import CustomerLink, { type Customer } from "./CustomerLink";
import { shopDateFormat } from "@/app/lib/quote";

export default function RecreateLink({
  requestId,
  customer,
}: {
  requestId: string;
  customer: Customer;
}) {
  const [sendState, resendAction, isSending] = useActionState(
    resendQuote.bind(null, requestId),
    initialSendState,
  );

  function handleSend() {
    if (
      !window.confirm(
        "Resend this quote? Previously sent link will be revoked.",
      )
    )
      return;
    const formData = new FormData();
    formData.set("requestId", requestId);
    startTransition(() => resendAction());
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleSend}
        disabled={isSending}
        className="rounded-full border border-red-500 px-6 py-3 font-bold text-red-500 transition-colors hover:border-emerald-700 hover:text-emerald-700 hover:bg-emerald-950/40 disabled:opacity-40"
      >
        {isSending ? "Resending..." : "Resend link"}
      </button>

      {sendState.status === "error" && (
        <p role="alert" className="text-sm text-red-400">
          {sendState.message}
        </p>
      )}
      {sendState.url && (
        <CustomerLink
          url={sendState.url}
          message={sendState.message}
          customer={customer}
        />
      )}
    </div>
  );
}
