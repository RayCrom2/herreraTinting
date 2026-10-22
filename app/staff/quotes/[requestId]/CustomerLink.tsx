"use client";
import { useState } from "react";

const linkButtonClass =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500";

export type Customer = { firstName: string; phone: string | null };
// Shown once after sending. The database keeps only the link's hash, so it can't be shown again.
export default function CustomerLink({
  url,
  message,
  customer,
}: {
  url: string;
  message: string;
  customer: Customer;
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const text = `Hi ${customer.firstName}, your Herrera Tinting quote is ready: ${url}`;

  async function copy(what: "link" | "message") {
    await navigator.clipboard.writeText(what === "link" ? url : text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="rounded-xl border border-emerald-700 bg-emerald-950/40 p-4">
      <p className="text-sm text-emerald-300">{message}</p>
      <input
        readOnly
        value={url}
        aria-label="Customer link"
        onFocus={(e) => e.target.select()}
        className="mt-3 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {customer.phone && (
          // Opens the device's texting app with the message filled in. Reliable on phones;
          // on computers it depends on what's installed, hence the copy buttons.
          <a
            href={`sms:+1${customer.phone}?&body=${encodeURIComponent(text)}`}
            className={linkButtonClass}
          >
            Text customer
          </a>
        )}
        <button
          type="button"
          onClick={() => copy("message")}
          className={linkButtonClass}
        >
          {copied === "message" ? "Copied" : "Copy message"}
        </button>
        <button
          type="button"
          onClick={() => copy("link")}
          className={linkButtonClass}
        >
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        On a computer, use Copy message and paste it wherever you text from. The
        full link isn&apos;t stored, so it can&apos;t be shown again after you
        leave this page.
      </p>
    </div>
  );
}
