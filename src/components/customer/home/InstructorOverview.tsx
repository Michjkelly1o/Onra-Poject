// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — Instructor Overview section (PRD 13 §6)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-41158. Section title + a horizontally
// scrollable row of <InstructorCard> for the instructors at the active branch
// (max 5, sliced by the caller). Hidden when the branch has no instructors.
// Tapping a card → the Instructor Detail screen (`/customer/instructors/[id]`).

"use client";

import { useRouter } from "next/navigation";
import { InstructorCard } from "@/components/customer/instructors/InstructorCard";
import type { HomeInstructorVM } from "@/lib/customer/home-data";

export function InstructorOverview({ instructors }: { instructors: HomeInstructorVM[] }) {
    const router = useRouter();
    if (instructors.length === 0) return null;

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[#101828]">Instructor</h2>

            {/* Full-bleed rail: cancels the page's px-4 so cards scroll edge-to-edge
                (not clipped at the content box), with px-4 keeping the first card aligned. */}
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {instructors.map((ins) => (
                    <InstructorCard
                        key={ins.id}
                        name={ins.name}
                        activeClasses={ins.activeClasses}
                        imageUrl={ins.imageUrl}
                        initials={ins.initials}
                        color={ins.color}
                        onClick={() => router.push(`/customer/instructors/${ins.id}`)}
                    />
                ))}
            </div>
        </section>
    );
}
