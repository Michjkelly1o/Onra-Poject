"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — Class Categories section (PRD 13 §6)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-41166. Title + a 2-column grid of
// <CategoryCard> showing the admin Class Categories available at the studio. No
// carousel — admin can add/remove categories, so a static grid stays tidy at any
// count. Tapping a card opens Search (Classes) pre-filtered to that category.

import { CategoryCard } from "@/components/customer/classes/CategoryCard";
import type { HomeCategoryVM } from "@/lib/customer/home-data";

export function Categories({
    categories,
    onSelect,
}: {
    categories: HomeCategoryVM[];
    onSelect: (category: HomeCategoryVM) => void;
}) {
    if (categories.length === 0) return null;

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[#101828]">Categories</h2>

            <div className="grid grid-cols-2 gap-4">
                {categories.map((cat) => (
                    <CategoryCard key={cat.id} name={cat.name} imageUrl={cat.imageUrl} onClick={() => onSelect(cat)} />
                ))}
            </div>
        </section>
    );
}
