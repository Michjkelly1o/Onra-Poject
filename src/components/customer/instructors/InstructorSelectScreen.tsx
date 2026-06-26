"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — InstructorSelectScreen (shared) — Figma 4206-87177
// ─────────────────────────────────────────────────────────────────────────────
//
// The "See all" instructor selection screen, reached from either filter (Search
// or Bookings). Sticky search subBar + flat checkbox rows over the shared
// `useFilterInstructors` list. Selection is written live via `onChange` (so it
// persists to the caller's filter draft); Apply just returns. Identical UI for
// every caller — only the draft it writes to differs.

import { useState } from "react";
import { ChevronLeft, SearchLg } from "@untitledui/icons";
import { useFilterInstructors } from "@/lib/customer/instructors";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { InstructorAvatar } from "@/components/customer/instructors/InstructorAvatar";
import { CheckBox } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

export function InstructorSelectScreen({
    initialSelected,
    onChange,
    onBack,
}: {
    initialSelected: string[];
    onChange: (next: string[]) => void;
    onBack: () => void;
}) {
    const instructors = useFilterInstructors();
    const scrollable = useMainScrollable();
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<string[]>(initialSelected);

    const q = query.trim().toLowerCase();
    const rows = instructors.filter((i) => i.name.toLowerCase().includes(q));

    function toggle(id: string) {
        setSelected((prev) => {
            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            onChange(next); // persist live to the caller's draft
            return next;
        });
    }

    const searchBar = (
        <div className="flex items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <SearchLg className="size-5 shrink-0 text-[#667085]" aria-hidden />
            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search instructor…"
                className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[#101828] outline-none placeholder:text-[#667085]"
            />
        </div>
    );

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader subBar={searchBar}>
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">Instructor</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col px-4 pb-4 pt-1">
                {rows.length > 0 ? (
                    rows.map((i) => (
                        <button
                            key={i.id}
                            type="button"
                            onClick={() => toggle(i.id)}
                            className="flex w-full items-center gap-3 py-4 text-left"
                        >
                            <InstructorAvatar imageUrl={i.imageUrl} initials={i.initials} size={32} />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-[#344054]">
                                {i.name}
                            </span>
                            <CheckBox checked={selected.includes(i.id)} />
                        </button>
                    ))
                ) : (
                    <p className="py-12 text-center text-sm text-[#667085]">No instructor found.</p>
                )}
            </div>

            {selected.length > 0 && (
                <div
                    className={`sticky bottom-0 px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                        scrollable ? "bg-white" : ""
                    }`}
                >
                    <Button variant="primary" size="xl" className="w-full rounded-full" onClick={onBack}>
                        Apply
                    </Button>
                </div>
            )}
        </div>
    );
}
