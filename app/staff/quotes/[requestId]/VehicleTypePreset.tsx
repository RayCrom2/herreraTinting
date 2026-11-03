"use client";

import { useState } from "react";
import { vehicleTypes } from "@/app/lib/quote";

interface VehicleTypePresetProps {
  currentType: string | null;
  locked: boolean;
}

export default function VehicleTypePreset({
  currentType,
  locked,
}: VehicleTypePresetProps) {
  const [preset, setPreset] = useState(currentType);

  return (
    <div className="ml-auto">
      <label
        className="block text-sm text-zinc-400 text-center"
        htmlFor="selectVehicleType"
      >
        Vehicle Type
      </label>
      <div className="relative">
        <select
          className="appearance-none rounded-xl border border-zinc-800 bg-black p-2 pr-10 text-zinc-100 focus:border-red-500 focus:outline-none"
          id="selectVehicleType"
          disabled={locked}
          value={preset ?? ""}
          onChange={(e) => setPreset(e.target.value)}
        >
          <option value="" disabled>
            Select
          </option>
          {vehicleTypes.map((type) => {
            return (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            );
          })}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}
