"use client";
import { useState } from "react";

// This URL is the only copy of the booking token (the database keeps just its hash),
// so give the customer an easy way to keep it if they're not ready to book yet.
export default function SaveLink({ expiresOn }: { expiresOn: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleSave() {
    const url = window.location.href;

    // Phones: open the share sheet so they can text or email the link to themselves.
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Book your Herrera Tinting appointment",
          url,
        });
        return;
      } catch (err) {
        // They closed the share sheet; that's not an error.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Any other failure falls through to copying.
      }
    }

    // Desktop (or share failed): copy to the clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  const copied = status === "copied";

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-xl border border-green-500/40 border-l-4 border-l-green-500 bg-green-500/10 p-4 shadow-lg shadow-green-500/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        {/* Bookmark icon */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-5 w-5 shrink-0 text-green-400"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <div>
          <p className="font-semibold text-zinc-100">Not ready to pick a day?</p>
          <p className="mt-0.5 text-sm text-zinc-300">
            Save this link to book later. It works until{" "}
            <span className="font-semibold text-green-400">{expiresOn}</span>.
          </p>
          {status === "failed" && (
            <p className="mt-1 text-sm text-zinc-400">
              Couldn&apos;t copy it. Bookmark this page instead.
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleSave}
        className={`shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400 ${
          copied
            ? "border border-green-500/50 bg-transparent text-green-400"
            : "bg-green-600 text-white hover:bg-green-500"
        }`}
      >
        {copied ? "✓ Copied!" : "Save link"}
      </button>
    </div>
  );
}
