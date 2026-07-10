"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — "Trending today" rail (classes)
// ─────────────────────────────────────────────────────────────────────────────
//
// A horizontally scrollable rail of the branch's top upcoming classes (existing
// class-schedule data — no placeholders). Tapping a card opens the class in the
// Search module's public class-detail screen. Hidden when the branch has no
// upcoming classes.

import { useRouter } from "next/navigation";
import { useTrendingClasses } from "@/lib/customer/discover-data";
import { DiscoverCard } from "@/components/customer/home/DiscoverCard";

export function TrendingClasses() {
    const router = useRouter();
    const classes = useTrendingClasses();
    if (classes.length === 0) return null;

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[#101828]">Trending today</h2>

            {/* Full-bleed rail: cancels the page's px-4 so cards scroll edge-to-edge. */}
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {classes.map((c) => (
                    <DiscoverCard
                        key={c.id}
                        coverImage={c.coverImage}
                        coverColor={c.coverColor}
                        title={c.name}
                        subtitle={`with ${c.instructorName}`}
                        onClick={() => router.push(`/customer/classes/${c.id}`)}
                    />
                ))}
            </div>
        </section>
    );
}
