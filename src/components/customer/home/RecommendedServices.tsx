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
import { searchUi } from "@/lib/customer/search-data";
import { useRecommendedServices } from "@/lib/customer/appointments-data";
import { DiscoverCard } from "@/components/customer/home/DiscoverCard";

export function RecommendedServices() {
    const router = useRouter();
    // Branch-scoped with an all-branches fallback so the rail never renders empty
    // (services are seeded under one branch in the demo).
    const services = useRecommendedServices(8);
    if (services.length === 0) return null;

    function openSearchAppointments(isRecovery: boolean) {
        // One-shot hint honoured by the Search page's mount effect — land on the
        // Private or Recovery tab that matches the tapped service.
        searchUi.forceTab = isRecovery ? "recovery" : "private";
        router.push("/customer/search");
    }

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Recommended services</h2>

            {/* Full-bleed rail: cancels the page's px-4 so cards scroll edge-to-edge. */}
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {services.map((s) => (
                    <DiscoverCard
                        key={s.id}
                        coverImage={s.coverImage}
                        coverColor={s.coverColor}
                        title={s.name}
                        subtitle={`${s.durationMins} min • ${s.type === "private" ? "Private session" : "Open session"}`}
                        onClick={() => openSearchAppointments(s.isRecovery)}
                    />
                ))}
            </div>
        </section>
    );
}
