"use client";

import * as React from "react";
import { Clock, MarkerPin01, Users01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import type { SessionType } from "@/lib/store";
import { SESSION_TYPE_TAG_LABEL, SESSION_TYPE_TAG_COLORS } from "@/lib/session-type";

/** Coloured type-tag chip — Class / Private / Recovery. Rendered on the
 *  schedule + dashboard cards so the session type reads at a glance,
 *  independent of the category discipline stripe.
 *
 *  Sizes:
 *    • "sm" (default) — compact chip for the tight schedule/dashboard cards.
 *    • "md"           — matches the DS StatusBadge md size, so the schedule
 *                       list-view Type column lines up with the Status column. */
export function SessionTypeTag({ type, size = "sm", className }: {
    type: SessionType;
    size?: "sm" | "md";
    className?: string;
}) {
    const c = SESSION_TYPE_TAG_COLORS[type];
    const sizeCls = size === "md"
        ? "px-[10px] py-[2px] text-[13px] whitespace-nowrap"
        : "px-1.5 py-[1px] text-[11px] leading-[16px]";
    return (
        <span
            className={cn("inline-flex shrink-0 items-center rounded-full border-1 font-medium", sizeCls, className)}
            style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
        >
            {SESSION_TYPE_TAG_LABEL[type]}
        </span>
    );
}

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
    /** Session type — drives the coloured type tag chip (Class / Private /
     *  Recovery). Optional so callers that haven't wired it yet keep the
     *  pre-type-dimension look; when set the LG + MD cards render the chip. */
    type?: SessionType;
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
    /** Optional lifecycle status — LG uses it to render an "Ongoing"
     *  pill in the top-right + a green capacity progress bar at the
     *  bottom of the card (Figma 7798:80399, Jul 2026). Absent value
     *  falls back to the pre-existing card layout so non-dashboard
     *  callers keep their current look. */
    status?: "Upcoming" | "Ongoing" | "Completed" | "Cancelled";
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
        // Client dashboard polish Jul 2026 (Figma 7798:80399). Every
        // class card now shows the capacity progress bar pinned to
        // the bottom edge — Ongoing rows also get a "Ongoing" pill in
        // the top-right. Badge palette matches the shared
        // `/admin/schedule` blue variant (StatusBadge blue: bg #eff8ff
        // border #b2ddff text #175cd3) instead of the sage green the
        // earlier draft used — client asked for parity across every
        // schedule surface.
        const isOngoing = cls.status === "Ongoing";
        const fillPct = cls.capacity > 0
            ? Math.min(100, Math.round((cls.booked / cls.capacity) * 100))
            : 0;
        return (
            <button type="button" onClick={onClick}
                style={{ backgroundColor: cls.color.bg, borderLeft: `4px solid ${cls.color.border}`, ...baseStyle }}
                className={cn(
                    // Progress bar sits INSIDE the card body now (Figma
                    // 7798:80399 review Jul 2026) — the previous version
                    // pinned it to the bottom edge which looked like a
                    // hairline rule instead of a filled indicator. Card
                    // is a plain flex column with rounded corners honoured
                    // by all children.
                    "relative w-full rounded-[10px] px-4 py-3 flex flex-col gap-2 text-left cursor-pointer hover:brightness-95 transition-all min-h-[96px]",
                    className,
                )}>
                {/* Title row + type tag + Ongoing pill / participant glyph. */}
                <div className="flex items-start gap-2 w-full">
                    <span className="min-w-0 block text-[14px] font-medium text-[#101828] leading-[20px] truncate shrink" style={{ color: cls.color.text }}>{cls.name}</span>
                    {cls.type && <SessionTypeTag type={cls.type} className="mt-px" />}
                    <span className="flex-1" />
                    {isOngoing && (
                        <span className="inline-flex items-center px-2 py-[1px] rounded-full text-[12px] font-medium bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3] shrink-0">
                            Ongoing
                        </span>
                    )}
                    <Users01 className="w-4 h-4 text-[#667085] shrink-0 mt-0.5" />
                </div>
                {/* Meta row — time · instructor · room · count. Single
                    line separated by bullets so the card matches Figma
                    7798:80399's compact density. */}
                <div className="flex items-center gap-2 min-w-0 text-[14px] text-[#667085]">
                    <span className="shrink-0">{rangeLabel}</span>
                    <span className="w-px h-3 bg-[#d0d5dd] shrink-0" />
                    <div className="flex items-center gap-1.5 min-w-0">
                        <MiniAvatar initials={cls.instructorInitials} color={cls.instructorColor} imageUrl={cls.instructorImageUrl} size={16} />
                        <span className="truncate">{instructorShortName(cls.instructorName)}</span>
                    </div>
                    {cls.room && (
                        <>
                            <span className="w-px h-3 bg-[#d0d5dd] shrink-0" />
                            <div className="flex items-center gap-1 min-w-0">
                                <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                                <span className="truncate">{cls.room}</span>
                            </div>
                        </>
                    )}
                    <span className="w-px h-3 bg-[#d0d5dd] shrink-0" />
                    <span className="shrink-0">
                        {cls.booked}/{cls.capacity}
                        {isFull && <span className="text-[#98a2b3] ml-1">(FULL)</span>}
                    </span>
                </div>
                {/* Capacity progress bar — inline at the bottom of the
                    card body with the same horizontal padding as the
                    meta row above. Track is a neutral gray rounded
                    pill; fill uses the card's category border colour
                    so it reads as an extension of the left accent
                    stripe. mt-auto pushes it to the bottom so short
                    cards still align their bars. */}
                <div className="mt-auto w-full h-1.5 bg-white/70 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${fillPct}%`, backgroundColor: cls.color.border }}
                    />
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
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="block text-[14px] font-medium leading-[20px] truncate" style={{ color: cls.color.text }}>{cls.name}</span>
                    {cls.type && <SessionTypeTag type={cls.type} />}
                </div>
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
                <div className="flex items-center gap-1 min-w-0">
                    <span className="block text-[13px] font-medium leading-[18px] truncate" style={{ color: cls.color.text }}>{cls.name}</span>
                    {cls.type && <SessionTypeTag type={cls.type} />}
                </div>
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
export function ScheduleMorePill({ count, onClick }: {
    count: number;
    /** Called with the click event so the month-view can anchor its
     *  DayClassListPopup near the pill's position. Signature updated
     *  2026-07-22 (was `() => void`). */
    onClick?: (e: React.MouseEvent) => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className="text-[11px] font-medium text-[#475467] hover:text-[#101828] px-1.5 py-[3px] w-full text-left transition-colors">
            + {count} more
        </button>
    );
}
