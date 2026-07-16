"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — TimezonePill (shared) — Figma 4011-78872
// ─────────────────────────────────────────────────────────────────────────────
//
// The display-timezone badge in the schedule date bar: white, 1px #d0d5dd border,
// rounded-md (6px), shadow-xs, a 12px globe-04 icon + the UTC offset (text-xs/medium
// #344054). Tapping opens the Time Zone Selector.

import { Globe04 } from "@untitledui/icons";
import { compactOffsetForCity } from "@/lib/customer/timezones";

/** `tz` is the selected timezone CITY (e.g. "Abu Dhabi"); the pill shows its live UTC offset. */
export function TimezonePill({ tz, onClick }: { tz: string; onClick: () => void }) {
    const offset = compactOffsetForCity(tz);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Display timezone: ${tz} (${offset}). Tap to change.`}
            className="flex shrink-0 items-center gap-1 rounded-md border border-[#d0d5dd] bg-white py-0.5 pl-2 pr-1.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
        >
            <Globe04 className="size-3 shrink-0 text-[#667085]" aria-hidden />
            <span className="text-xs font-medium leading-[18px] text-[#344054]">{offset}</span>
        </button>
    );
}
