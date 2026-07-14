"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Time Zone Selector (`/customer/search/timezone`) — Figma 4011-80107
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-screen, own header (back + "Timezone"). A STICKY search field (stays under
// the header while the list scrolls) + a list of real IANA-backed zones (city +
// live UTC offset + a flat row + RadioDot). Picking a row sets the display
// timezone CITY (persisted on the member context) and returns to Search.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, SearchLg } from "@untitledui/icons";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { cityForZone, offsetLabel, TIMEZONES, tzPickerCtx } from "@/lib/customer/timezones";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";

export default function TimezonePage() {
    const router = useRouter();
    const { timezone, setTimezone } = useCurrentCustomerContext();
    const [query, setQuery] = useState("");

    // Compute each zone's live offset once (stable for the session).
    const zones = useMemo(() => TIMEZONES.map((t) => ({ ...t, offset: offsetLabel(t.zone) })), []);

    // "Your time" = the device-detected zone; "Branch time" = the branch zone
    // (only when opened from the appointment flow, via tzPickerCtx).
    const [deviceCity, setDeviceCity] = useState<string | null>(null);
    const [branchCity, setBranchCity] = useState<string | null>(null);
    useEffect(() => {
        try {
            const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setDeviceCity(zone ? cityForZone(zone) ?? null : null);
        } catch {
            /* Intl unavailable */
        }
        setBranchCity(tzPickerCtx.branchCity);
    }, []);
    const q = query.trim().toLowerCase();
    const rows = zones.filter((z) => z.city.toLowerCase().includes(q) || z.offset.toLowerCase().includes(q));

    function select(city: string) {
        setTimezone(city);
        router.back();
    }

    const searchBar = (
        <div className="flex items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <SearchLg className="size-5 shrink-0 text-[#667085]" aria-hidden />
            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search timezone…"
                className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[var(--brand-text)] outline-none placeholder:text-[#667085]"
            />
        </div>
    );

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader subBar={searchBar}>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">Timezone</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col px-4 pb-8 pt-1">
                {rows.length > 0 ? (
                    <div className="flex flex-col">
                        {rows.map((z) => (
                            <button
                                key={z.city}
                                type="button"
                                onClick={() => select(z.city)}
                                className="flex w-full items-center gap-3 py-4 text-left"
                            >
                                {/* City + its badge grouped on the LEFT (badge sticks to
                                    the city, not the UTC offset). */}
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="min-w-0 truncate text-sm font-medium leading-5 text-[#344054]">
                                        {z.city}
                                    </span>
                                    {z.city === branchCity && (
                                        <span className="shrink-0 rounded-md border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] px-1.5 py-0.5 text-xs font-medium leading-[18px] text-[#0c2d34]">
                                            Branch time
                                        </span>
                                    )}
                                    {z.city === deviceCity && (
                                        <span className="shrink-0 rounded-md border border-[#e4e7ec] bg-[#f9fafb] px-1.5 py-0.5 text-xs font-medium leading-[18px] text-[#475467]">
                                            Your time
                                        </span>
                                    )}
                                </div>
                                <span className="shrink-0 text-sm font-normal leading-5 text-[#475467]">{z.offset}</span>
                                <RadioDot checked={z.city === timezone} />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <SearchEmptyState
                            icon={Clock}
                            title="No timezone found"
                            description="Try a different city or UTC offset."
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
