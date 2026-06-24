"use client";

import * as React from "react";
import { Clock, MarkerPin01, Users01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";

// ─── Onra DS — Schedule Class Card ────────────────────────────────────────────
//
// Figma source: ONRA DS — node 18166:6159
//
// Single component with four size variants used across every schedule surface:
//
//   • lg → Dashboard "Today's classes" widget          (wide, full info row)
//   • md → /admin/schedule day-view time-grid tiles    (compact 3-row)
//   • sm → /admin/schedule week-view time-grid tiles   (tight 3-row)
//   • xs → /admin/schedule month-view cells            (single-line pill)
//
// The card paints its background + left accent stripe from the class category
// palette (Pilates / Barre / Yoga / …) — pass in the resolved
// bg/border/text hexes so the card stays decoupled from a specific palette
// source (the schedule page keeps its own CATEGORY_COLORS map; the dashboard
// resolves the same way through `CATEGORY_PALETTE`).

export interface ScheduleCardClass {
    /** Class template name — "Mat Pilates", "Reformer Pilates", … */
    name: string;
    /** Category palette — resolved hex triple. */
    color: { bg: string; border: string; text: string };
    /** "10:00" — 24h. */
    startTime: string;
    /** "11:00" — 24h. Only LG shows the full range; smaller variants show start. */
    endTime?: string;
    /** Pre-formatted "10:00 - 11:00 AM" (LG range row). */
    displayTime?: string;
    instructorName: string;
    instructorInitials: string;
    /** Avatar fallback colour when no portrait. */
    instructorColor: string;
    /** Optional portrait. */
    instructorImageUrl?: string;
    room?: string;
    booked: number;
    capacity: number;
}

export type ScheduleCardSize = "xs" | "sm" | "md" | "lg";

interface Props {
    cls: ScheduleCardClass;
    size: ScheduleCardSize;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
    /** Pin to a parent's absolute layout (used by the day/week time-grid
     *  columns). When set the card uses absolute positioning. With only
     *  top/height the card spans the full column (inset 2px L/R). With
     *  leftPct/widthPct it's narrowed to a lane so overlapping classes
     *  render side by side. */
    absolute?: { top: number; height: number; leftPct?: number; widthPct?: number };
    /** When > 0, the card surfaces a "+N more" badge in place of its
     *  bookings count — used on the rightmost-visible card of an overlap
     *  group to flag classes that fell into overflow lanes. */
    moreCount?: number;
}

// ─── Avatar (image + initials fallback) ──────────────────────────────────────

function MiniAvatar({ initials, color, imageUrl, size }: {
    initials: string; color: string; imageUrl?: string; size: number;
}) {
    if (imageUrl) {
        return (
            <img src={imageUrl} alt={initials} loading="lazy"
                style={{ width: size, height: size }}
                className="rounded-full object-cover shrink-0 border border-black/[0.04]"
            />
        );
    }
    return (
        <div
            style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
            className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold"
        >
            {initials}
        </div>
    );
}

// ─── Format helpers ──────────────────────────────────────────────────────────

function fmt12(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function instructorShortName(full: string): string {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function ScheduleClassCard({ cls, size, onClick, className, absolute, moreCount }: Props) {
    const isFull = cls.booked >= cls.capacity;
    const startLabel = fmt12(cls.startTime);
    const rangeLabel = cls.displayTime
        ?? (cls.endTime ? `${fmt12(cls.startTime)} - ${fmt12(cls.endTime)}` : startLabel);
    const hasMore = !!moreCount && moreCount > 0;

    // `minHeight: 72` guarantees a 45-min class still has room for title +
    // instructor + meta row at the current 88px-per-hour week-view scale
    // (45 min ≈ 66px). Without it, short classes truncate their meta row
    // and look "broken".
    //
    // When the card lives in an overlap lane (widthPct + leftPct set), we
    // bump the gap between adjacent cards from 2px to 4px AND add a soft
    // drop shadow so each card reads as its own surface — without this,
    // side-by-side cards in the same time slot looked visually identical
    // and ran together.
    const baseStyle: React.CSSProperties = absolute
        ? (absolute.widthPct !== undefined && absolute.leftPct !== undefined
            ? {
                position: "absolute",
                top: absolute.top, height: absolute.height, minHeight: 72,
                left: `calc(${absolute.leftPct}% + 2px)`,
                width: `calc(${absolute.widthPct}% - 4px)`,
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.08), 0 1px 3px rgba(16, 24, 40, 0.04)",
            }
            : { position: "absolute", top: absolute.top, height: absolute.height, minHeight: 72, left: 2, right: 2 })
        : {};

    // ── LG ───────────────────────────────────────────────────────────────────
    if (size === "lg") {
        return (
            <button type="button" onClick={onClick}
                style={{ backgroundColor: cls.color.bg, borderLeft: `4px solid ${cls.color.border}`, ...baseStyle }}
                className={cn(
                    "w-full rounded-[10px] pl-4 pr-4 py-3 flex flex-col gap-1 text-left cursor-pointer hover:brightness-95 transition-all",
                    className,
                )}>
                <span className="block text-[14px] font-medium text-[#101828] leading-[20px] truncate shrink-0" style={{ color: cls.color.text }}>{cls.name}</span>
                <p className="text-[14px] text-[#667085]">{rangeLabel}</p>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <MiniAvatar initials={cls.instructorInitials} color={cls.instructorColor} imageUrl={cls.instructorImageUrl} size={16} />
                        <span className="text-[14px] text-[#667085] truncate">{instructorShortName(cls.instructorName)}</span>
                    </div>
                    {cls.room && (
                        <>
                            <span className="w-px h-3 bg-[#d0d5dd] shrink-0" />
                            <div className="flex items-center gap-1 min-w-0">
                                <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                                <span className="text-[14px] text-[#667085] truncate">{cls.room}</span>
                            </div>
                        </>
                    )}
                    <span className="w-px h-3 bg-[#d0d5dd] shrink-0" />
                    <div className="flex items-center gap-1 shrink-0">
                        <Users01 className="w-4 h-4 text-[#667085]" />
                        <span className="text-[14px] text-[#667085]">{cls.booked}/{cls.capacity}</span>
                    </div>
                </div>
            </button>
        );
    }

    // ── MD ───────────────────────────────────────────────────────────────────
    if (size === "md") {
        return (
            <button type="button" onClick={onClick}
                style={{ backgroundColor: cls.color.bg, borderLeft: `3px solid ${cls.color.border}`, ...baseStyle }}
                className={cn(
                    "rounded-[8px] px-2.5 py-2 flex flex-col gap-1 text-left cursor-pointer hover:brightness-95 transition-all overflow-hidden",
                    !absolute && "w-full",
                    className,
                )}>
                <span className="block text-[14px] font-medium leading-[20px] truncate shrink-0" style={{ color: cls.color.text }}>{cls.name}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                    <MiniAvatar initials={cls.instructorInitials} color={cls.instructorColor} imageUrl={cls.instructorImageUrl} size={14} />
                    <span className="text-[12px] text-[#667085] truncate">{instructorShortName(cls.instructorName)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                        <Clock className="w-[12px] h-[12px] text-[#667085] shrink-0" />
                        <span className="text-[12px] text-[#667085]">{startLabel}</span>
                    </div>
                    <span className="text-[#98a2b3] text-[12px]">•</span>
                    <div className="flex items-center gap-1">
                        <Users01 className="w-[12px] h-[12px] text-[#667085] shrink-0" />
                        <span className="text-[12px] text-[#667085]">{cls.booked}/{cls.capacity}</span>
                    </div>
                    {isFull && <span className="text-[11px] font-semibold text-[#b42318]">(FULL)</span>}
                </div>
            </button>
        );
    }

    // ── SM ───────────────────────────────────────────────────────────────────
    if (size === "sm") {
        return (
            <button type="button" onClick={onClick}
                style={{ backgroundColor: cls.color.bg, borderLeft: `3px solid ${cls.color.border}`, ...baseStyle }}
                className={cn(
                    "rounded-[6px] px-1.5 py-1.5 flex flex-col gap-0.5 text-left cursor-pointer hover:brightness-95 transition-all overflow-hidden",
                    !absolute && "w-full",
                    className,
                )}>
                <span className="block text-[13px] font-medium leading-[18px] truncate shrink-0" style={{ color: cls.color.text }}>{cls.name}</span>
                <div className="flex items-center gap-1 min-w-0">
                    <MiniAvatar initials={cls.instructorInitials} color={cls.instructorColor} imageUrl={cls.instructorImageUrl} size={12} />
                    <span className="text-[11px] text-[#667085] truncate">{instructorShortName(cls.instructorName)}</span>
                </div>
                {hasMore && (
                    <span className="inline-flex items-center self-start whitespace-nowrap text-[11px] font-medium text-[#475467] bg-white border border-[#e4e7ec] rounded-full px-2 py-[1px]">
                        +{moreCount} more
                    </span>
                )}
            </button>
        );
    }

    // ── XS ───────────────────────────────────────────────────────────────────
    return (
        <button type="button" onClick={onClick}
            style={{ backgroundColor: cls.color.bg, borderLeft: `2px solid ${cls.color.border}` }}
            className={cn(
                "w-full rounded-[4px] px-1.5 py-[3px] flex items-center gap-1 text-left cursor-pointer hover:brightness-95 transition-all overflow-hidden",
                className,
            )}>
            <span className="text-[11px] font-medium whitespace-nowrap shrink-0" style={{ color: cls.color.border }}>{startLabel}</span>
            <span className="text-[11px] text-[#98a2b3] shrink-0">•</span>
            <span className="text-[11px] font-medium truncate" style={{ color: cls.color.text }}>{cls.name}</span>
        </button>
    );
}

// ─── "+N more" overflow pill (month view) ────────────────────────────────────
export function ScheduleMorePill({ count, onClick }: { count: number; onClick?: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className="text-[11px] font-medium text-[#475467] hover:text-[#101828] px-1.5 py-[3px] w-full text-left transition-colors">
            + {count} more
        </button>
    );
}
