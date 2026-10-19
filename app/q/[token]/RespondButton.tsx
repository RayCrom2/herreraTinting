"use client";

import { useActionState } from "react";
import { respondToQuote } from "../../actions/respondToQuote";
import { initialRespondState } from "../../lib/quote";

// A plain `action` form, so it still submits if the page's JavaScript hasn't loaded yet.
// With JavaScript, the customer confirms first.
export default function RespondButton({
  token,
  response,
  quoteId,
  label,
  confirmText,
  className,
}: {
  token: string;
  response: "accept" | "decline";
  quoteId?: string;
  label: string;
  confirmText: string;
  className: string;
}) {
  const [state, formAction, isPending] = useActionState(respondToQuote, initialRespondState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="response" value={response} />
      {quoteId && <input type="hidden" name="quoteId" value={quoteId} />}
      <button type="submit" disabled={isPending} className={className}>
        {isPending ? "Saving..." : label}
      </button>
      {state.message && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
