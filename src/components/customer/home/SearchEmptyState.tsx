// ─────────────────────────────────────────────────────────────────────────────
// Customer — Search empty state ("No appointment found") — Figma 4195-83270
// ─────────────────────────────────────────────────────────────────────────────
//
// Shown whenever no classes match the selected date + active filters. A faded
// #f9fafb illustration card: a centered white calendar-skeleton tile above a
// 3-tier skeleton (full line · two half lines · centered line), then the title +
// hint. Updates dynamically as the date / month / filters change.

import { Calendar } from "@untitledui/icons";
import type { ComponentType, SVGProps } from "react";

export interface SearchEmptyStateProps {
    title?: string;
    description?: string;
    /** Illustration tile icon (defaults to the calendar). */
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export function SearchEmptyState({
    title = "No appointment found",
    description = "Jump to the next available dates or try a different filter.",
    icon: Icon = Calendar,
}: SearchEmptyStateProps = {}) {
    return (
        <div className="flex flex-col items-center gap-6 px-6 text-center">
            {/* Illustration */}
            <div className="flex h-[120px] w-[156px] flex-col items-center gap-2.5 rounded-[13px] bg-[#f9fafb] p-2.5 drop-shadow-[0px_0.8px_0.8px_rgba(16,24,40,0.05)]">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.02),-2px_3.5px_8px_0px_rgba(0,0,0,0.02)]">
                    <Icon className="size-6 text-[#344054]" aria-hidden />
                </div>
                <div className="flex w-full flex-1 flex-col justify-between">
                    <div className="flex w-full flex-col gap-1.5">
                        <div className="h-2.5 w-full rounded-full bg-[#f2f4f7]" />
                        <div className="flex w-full gap-1.5">
                            <div className="h-2.5 flex-1 rounded-full bg-[#f2f4f7]" />
                            <div className="h-2.5 flex-1 rounded-full bg-[#f2f4f7]" />
                        </div>
                    </div>
                    <div className="flex w-full justify-center">
                        <div className="h-2.5 w-[76px] rounded-full bg-[#f2f4f7]" />
                    </div>
                </div>
            </div>

            {/* Text */}
            <div className="flex max-w-[352px] flex-col gap-1">
                <p className="text-sm font-semibold leading-5 text-[var(--brand-text)]">{title}</p>
                <p className="text-sm font-normal leading-5 text-[#475467]">{description}</p>
            </div>
        </div>
    );
}
