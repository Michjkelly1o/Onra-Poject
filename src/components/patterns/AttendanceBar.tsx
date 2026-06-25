"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared AttendanceBar
// ─────────────────────────────────────────────────────────────────────────────
//
// "Booked / capacity" progress pill rendered alongside class & service rows.
// 3 inline copies in admin/schedule, class-types/[id], and ServiceDetailPage
// were BYTE-IDENTICAL — centralised here so a designer-driven tweak (bar
// width, color) is a one-file change.
//
// Visual chrome (from audit):
//   • Container: `flex items-center gap-3`
//   • Track:     `h-[4px] w-[80px] bg-[#e4e7ec] rounded-full overflow-hidden shrink-0`
//   • Fill:      `h-full rounded-full bg-[#658774]` with `style.width = ${pct*100}%`
//   • Label:     `text-[14px] text-[#344054] whitespace-nowrap` "{booked}/{capacity}"

import { cn } from "@/lib/utils";

export interface AttendanceBarProps {
    booked: number;
    capacity: number;
    /** Extra Tailwind classes on the outer container. */
    className?: string;
}

export function AttendanceBar({ booked, capacity, className }: AttendanceBarProps) {
    const pct = capacity > 0 ? (booked / capacity) : 0;
    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div className="h-[4px] w-[80px] bg-[#e4e7ec] rounded-full overflow-hidden shrink-0">
                <div className="h-full rounded-full bg-[#658774]" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="text-[14px] text-[#344054] whitespace-nowrap">
                {booked}/{capacity}
            </span>
        </div>
    );
}
