"use client";

import { useActionState } from "react";
import { initialState } from "../lib/quote";
import { submitQuote } from "../actions/submitQuote";

const filmOptions = [
  {
    value: "c2-carbon",
    label: "C2 Carbon",
    description: "Best value · great heat & UV rejection",
  },
  {
    value: "pronano-ceramic",
    label: "ProNano Ceramic",
    description: "Highest heat rejection",
  },
  {
    value: "both",
    label: "Quote for Both",
    description: "Compare prices side by side",
  },
];

// Car diagram segments, viewed from above with the front of the car on the right.
type Segment = "back" | "rearSides" | "frontSides" | "windshield" | "strip";

const windowOptions: {
  value: string;
  label: string;
  description: string;
  tinted: Segment[] | null;
}[] = [
  {
    value: "full",
    label: "Full Tint",
    description: "All sides + back glass",
    tinted: ["back", "rearSides", "frontSides"],
  },
  {
    value: "full-windshield",
    label: "Full Tint + Windshield",
    description: "Every window",
    tinted: ["back", "rearSides", "frontSides", "windshield"],
  },
  {
    value: "back-half",
    label: "Back Half",
    description: "Rear doors + back glass",
    tinted: ["back", "rearSides"],
  },
  {
    value: "front",
    label: "Front Windows",
    description: "Driver + passenger",
    tinted: ["frontSides"],
  },
  {
    value: "front-windshield",
    label: "Front Windows + Windshield",
    description: "Front doors + windshield",
    tinted: ["frontSides", "windshield"],
  },
  {
    value: "windshield-strip",
    label: "Windshield Strip",
    description: "Top strip only",
    tinted: ["strip"],
  },
  {
    value: "other",
    label: "Something Else",
    description: "Tell us in comments",
    tinted: null,
  },
];

const removalOptions = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "not-sure", label: "Not sure" },
];

function CarDiagram({ tinted }: { tinted: Segment[] | null }) {
  const fill = (segment: Segment) =>
    tinted?.includes(segment) ? "fill-red-500" : "fill-zinc-700";

  return (
    <svg
      viewBox="0 0 100 32"
      className="h-9 w-full max-w-28"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="30"
        rx="12"
        className="fill-none stroke-zinc-500"
        strokeWidth="1"
      />
      {tinted === null ? (
        <text
          x="50"
          y="20"
          textAnchor="middle"
          className="fill-zinc-300 text-[11px]"
        >
          ?
        </text>
      ) : (
        <>
          <rect
            x="14"
            y="8"
            width="6"
            height="16"
            rx="1.5"
            className={fill("back")}
          />
          <rect
            x="26"
            y="5"
            width="20"
            height="5"
            rx="1.5"
            className={fill("rearSides")}
          />
          <rect
            x="26"
            y="22"
            width="20"
            height="5"
            rx="1.5"
            className={fill("rearSides")}
          />
          <rect
            x="50"
            y="5"
            width="20"
            height="5"
            rx="1.5"
            className={fill("frontSides")}
          />
          <rect
            x="50"
            y="22"
            width="20"
            height="5"
            rx="1.5"
            className={fill("frontSides")}
          />
          <rect
            x="76"
            y="7"
            width="7"
            height="18"
            rx="1.5"
            className={fill("windshield")}
          />
          {tinted.includes("strip") && (
            <rect x="76" y="7" width="2" height="18" className="fill-red-500" />
          )}
        </>
      )}
    </svg>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-sm text-red-400">{message}</p>;
}

const labelClass = "mb-2 block text-sm font-semibold text-zinc-200";
const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black px-4 py-3.5 text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none";
const optionCardClass =
  "flex h-full cursor-pointer flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:border-zinc-600 has-[:checked]:border-red-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-red-500";

export default function QuoteForm() {
  const [state, formAction, isPending] = useActionState(
    submitQuote,
    initialState,
  );
  const { errors, values } = state;

  if (state.success) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-100">
        <p className="text-lg font-semibold">
          Thanks! Your quote request was sent.
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          We&apos;ll text you shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-6 text-zinc-100">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className={labelClass}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            defaultValue={values.fullName}
            className={inputClass}
          />
          <FieldError message={errors.fullName} />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={values.phone}
            className={inputClass}
          />
          <FieldError message={errors.phone} />
        </div>
      </div>

      <div>
        <label htmlFor="vehicle" className={labelClass}>
          Year, Make &amp; Model of Vehicle{" "}
          <span className="text-red-500">*</span>
        </label>
        <input
          id="vehicle"
          name="vehicle"
          type="text"
          placeholder="e.g. 2018 Mercedes-AMG C63"
          defaultValue={values.vehicle}
          className={inputClass}
        />
        <FieldError message={errors.vehicle} />
      </div>

      <fieldset>
        <legend className={`${labelClass} flex items-center gap-3`}>
          <span>
            What Type of Film <span className="text-red-500">*</span>
          </span>
          <a
            href="#compare-films"
            className="text-xs font-semibold text-red-500 hover:underline"
          >
            Compare films
          </a>
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {filmOptions.map((option) => (
            <label key={option.value} className={optionCardClass}>
              <input
                type="radio"
                name="film"
                value={option.value}
                defaultChecked={values.film === option.value}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="mt-1 text-xs text-zinc-400">
                {option.description}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errors.film} />
      </fieldset>

      <fieldset>
        <legend className={labelClass}>
          Which Windows Need Tint?{" "}
          <span className="text-xs font-normal text-zinc-400">
            Pick one. Red = tinted.
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {windowOptions.map((option) => (
            <label key={option.value} className={optionCardClass}>
              <input
                type="radio"
                name="windows"
                value={option.value}
                defaultChecked={values.windows === option.value}
                className="sr-only"
              />
              <CarDiagram tinted={option.tinted} />
              <span className="mt-3 text-sm font-semibold">{option.label}</span>
              <span className="mt-1 text-xs text-zinc-400">
                {option.description}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errors.windows} />
      </fieldset>

      <div>
        <label htmlFor="removal" className={labelClass}>
          Tint Removal? <span className="text-red-500">*</span>
        </label>
        <select
          id="removal"
          name="removal"
          defaultValue={values.removal ?? ""}
          className={inputClass}
        >
          <option value="" disabled>
            Select...
          </option>
          {removalOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.removal} />
      </div>

      <div>
        <label htmlFor="comments" className={labelClass}>
          Comments
        </label>
        <textarea
          id="comments"
          name="comments"
          rows={4}
          placeholder="Shade preference, timing, anything else we should know"
          defaultValue={values.comments}
          className={inputClass}
        />
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="terms"
            defaultChecked={values.terms === "on"}
            className="mt-1 size-4 shrink-0 accent-red-500"
          />
          <span>
            I agree to the terms &amp; conditions provided by the company. By
            providing my phone number, I agree to receive text messages from the
            business.
          </span>
        </label>
        <FieldError message={errors.terms} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-red-600 px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
      >
        {isPending ? "Sending..." : "Request My Free Quote →"}
      </button>
    </form>
  );
}
