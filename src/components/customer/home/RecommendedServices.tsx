"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — "Recommended services" rail (appointments)
// ─────────────────────────────────────────────────────────────────────────────
//
// A horizontally scrollable rail of the branch's bookable services (the SAME
// appointment/service data as Search → Appointments, unfiltered). Tapping a card
// opens the Search module on its Appointments tab (via the one-shot
// `searchUi.forceTab`), where the guest can browse + book. Hidden when the branch
// offers no services.

import { useRouter } from "next/navigation";
import { EMPTY_FILTERS, searchUi } from "@/lib/customer/search-data";
import { useAppointments } from "@/lib/customer/appointments-data";
import { DiscoverCard } from "@/components/customer/home/DiscoverCard";

export function RecommendedServices() {
    const router = useRouter();
    const services = useAppointments(EMPTY_FILTERS).slice(0, 8);
    if (services.length === 0) return null;

    function openSearchAppointments() {
        // One-shot hint honoured by the Search page's mount effect.
        searchUi.forceTab = "appointments";
        router.push("/customer/search");
    }

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[#101828]">Recommended services</h2>

            {/* Full-bleed rail: cancels the page's px-4 so cards scroll edge-to-edge. */}
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {services.map((s) => (
                    <DiscoverCard
                        key={s.id}
                        coverImage={s.coverImage}
                        coverColor={s.coverColor}
                        title={s.name}
                        subtitle={`${s.durationMins} min • ${s.type === "private" ? "Private session" : "Open session"}`}
                        onClick={openSearchAppointments}
                    />
                ))}
            </div>
        </section>
    );
}
