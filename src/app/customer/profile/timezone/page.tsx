"use client";

// Customer — Profile › Timezone (`/customer/profile/timezone`). Reuses the Search
// Time Zone selector (same list + persistence); back returns to the profile hub.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, SearchLg } from "@untitledui/icons";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { offsetLabel, TIMEZONES } from "@/lib/customer/timezones";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";

export default function ProfileTimezonePage() {
    const router = useRouter();
    const { timezone, setTimezone } = useCurrentCustomerContext();
    const [query, setQuery] = useState("");

    const zones = useMemo(() => TIMEZONES.map((t) => ({ ...t, offset: offsetLabel(t.zone) })), []);
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
                className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[#101828] outline-none placeholder:text-[#667085]"
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
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">Timezone</h1>
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
                                <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-[#344054]">
                                    {z.city}
                                </span>
                                <span className="shrink-0 text-sm font-normal leading-5 text-[#475467]">{z.offset}</span>
                                <RadioDot checked={z.city === timezone} />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <SearchEmptyState icon={Clock} title="No timezone found" description="Try a different city or UTC offset." />
                    </div>
                )}
            </div>
        </div>
    );
}
