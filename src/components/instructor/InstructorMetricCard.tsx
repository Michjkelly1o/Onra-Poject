"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor dashboard KPI tile (Figma 7280:42481)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single KPI surface used four times in the Instructor dashboard's "Overall
// performance" section. Matches the Figma metric item 1-for-1:
//   • white card, border #e4e7ec, radius 16, padding 20
//   • text column: label (gray, text-sm) + value (display-xs semibold) +
//     delta row (up/down arrow inside a transparent pill, then "vs last
//     week" supporting text)
//   • featured icon: 40×40 circle, bg #f1f2ed (page tint), centered icon
//
// The optional `onClick` makes the whole card behave as a button — used by
// the Cancellations tile to open the modal.

import { ArrowUp, ArrowDown } from "@untitledui/icons";
import { cn } from "@/lib/utils";

interface InstructorMetricCardProps {
    /** Untitled UI icon component. */
    icon: React.FC<{ className?: string }>;
    label: string;
    /** Pre-formatted value — pass `"95%"`, `"AED 1,200"`, or just `8`. */
    value: string | number;
    /** Percent change vs the previous period. Positive renders green-up,
     *  negative renders red-down. Pass `null` to hide the delta line. */
    deltaPercent: number | null;
    /** Supporting text after the delta pill — e.g. "vs last week". */
    deltaSuffix?: string;
    /** Whole-card click handler. When set, the card gets `cursor-pointer`
     *  + a focus ring so it's reachable from the keyboard. */
    onClick?: () => void;
}

export function InstructorMetricCard({
    icon: Icon,
    label,
    value,
    deltaPercent,
    deltaSuffix = "vs last week",
    onClick,
}: InstructorMetricCardProps) {
    const isClickable = !!onClick;
    const isPositive = (deltaPercent ?? 0) >= 0;
    const absDelta = Math.abs(deltaPercent ?? 0);

    const ArrowIcon = isPositive ? ArrowUp : ArrowDown;
    const deltaColor = isPositive ? "text-[#067647]" : "text-[#b42318]";

    return (
        <div
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={onClick}
            onKeyDown={(e) => {
                if (isClickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onClick?.();
                }
            }}
            className={cn(
                "bg-white border-1 border-[#e4e7ec] rounded-[16px] p-5 flex items-start justify-end gap-6 transition-shadow",
                isClickable && "cursor-pointer hover:shadow-[0_1px_3px_rgba(16,24,40,0.1),0_1px_2px_rgba(16,24,40,0.06)] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]",
            )}
        >
            {/* Text column */}
            <div className="flex-1 min-w-0 flex flex-col gap-2 items-start">
                <p className="text-sm font-normal text-[#667085] leading-5 whitespace-nowrap">{label}</p>
                <p className="text-[24px] font-semibold text-[#101828] leading-8">{value}</p>
                {deltaPercent !== null && (
                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 py-0.5 rounded-full shrink-0">
                            <ArrowIcon className={cn("w-3 h-3", deltaColor)} />
                            <p className={cn("text-sm font-medium leading-5", deltaColor)}>
                                {absDelta}%
                            </p>
                        </div>
                        <p className="text-sm font-normal text-[#667085] leading-5 whitespace-nowrap">
                            {deltaSuffix}
                        </p>
                    </div>
                )}
            </div>

            {/* Featured icon circle */}
            <div className="bg-[#f1f2ed] rounded-full size-10 shrink-0 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#101828]" />
            </div>
        </div>
    );
}
