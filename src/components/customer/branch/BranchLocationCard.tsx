"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — BranchLocationCard (shared) — Figma 4515-147xxx
// ─────────────────────────────────────────────────────────────────────────────
//
// The branch "Location" block reused by Class detail, Appointment detail and
// Instructor detail. Same info as the Branch selector sheet: name, street
// address, "Open • hours today", and a branch time-zone pill. The map's expand
// control opens the exact branch address in Google Maps (mirrors the selector's
// "Details" link).

import { Globe04, Maximize01, MarkerPin01 } from "@untitledui/icons";
import type { Branch } from "@/data/mock/_types";
import { branchTimezone } from "@/lib/branch-time";
import { cityForZone, compactOffsetForCity } from "@/lib/customer/timezones";
import { branchHoursToday, openBranchInMaps } from "@/lib/customer/branch-location";

export function BranchLocationCard({
    branch,
    room,
    heading = "Location",
}: {
    branch?: Branch | null;
    /** Prefixes the name line, e.g. "Studio A - Forma Studio (South)". */
    room?: string;
    heading?: string;
}) {
    const name = branch?.name ?? "—";
    const nameLine = room ? `${room} - ${name}` : name;
    const displayAddress = branch?.address ?? "";
    // Full query for Maps (street + city + country) so the pin lands precisely.
    const mapsQuery = branch ? [branch.address, branch.city, branch.country].filter(Boolean).join(", ") : "";
    const branchCity = branch ? cityForZone(branchTimezone(branch)) ?? "Branch" : "";
    const hours = branch ? branchHoursToday(branch.id) : null;

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">{heading}</h2>
            <div className="relative h-[160px] w-full overflow-hidden rounded-xl bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/customer/branch-map.png" alt="" className="absolute inset-0 size-full object-cover" />
                <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-black/20 bg-[var(--brand-text)]">
                    <MarkerPin01 className="size-5 text-white" aria-hidden />
                </span>
                <button
                    type="button"
                    onClick={() => openBranchInMaps(mapsQuery)}
                    aria-label="Open in Google Maps"
                    className="absolute right-4 top-4 flex items-center justify-center rounded-full border border-[#f2f4f7] bg-white p-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                >
                    <Maximize01 className="size-5 text-[#344054]" aria-hidden />
                </button>
            </div>
            <div className="flex w-full items-start gap-2">
                <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">{nameLine}</p>
                    {displayAddress && <p className="text-sm font-normal leading-5 text-[#475467]">{displayAddress}</p>}
                    {hours && (
                        <p className="flex items-center gap-1 text-sm leading-5">
                            <span className="font-medium text-[var(--brand-primary)]">{hours.isOpen ? "Open" : "Closed"}</span>
                            <span className="text-[#667085]">•</span>
                            <span className="text-[#667085]">{hours.hoursLabel}</span>
                        </p>
                    )}
                    {branch && (
                        <span className="mt-1 flex w-fit items-center gap-1 rounded-md border border-[#e4e7ec] bg-white px-2 py-0.5">
                            <Globe04 className="size-3 shrink-0 text-[#667085]" aria-hidden />
                            <span className="text-xs font-medium leading-[18px] text-[#344054]">
                                {branchCity} ({compactOffsetForCity(branchCity)})
                            </span>
                        </span>
                    )}
                </div>
            </div>
        </section>
    );
}
