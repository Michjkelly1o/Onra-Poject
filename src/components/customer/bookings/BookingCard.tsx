// ─────────────────────────────────────────────────────────────────────────────
// Customer — BookingCard (shared) — PRD 13 §6.5 / §8.8
// ─────────────────────────────────────────────────────────────────────────────
//
// Reusable booking card used on Home → Upcoming Class, Bookings → Upcoming, and
// Bookings → History. Built from scratch for the member surface (not the
// admin/instructor DS). Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-40391
// ("New Booking Card"). Content hierarchy and tokens match the design exactly;
// the status icon/colour is driven by `tone` so the same card serves booked /
// waitlisted / attended / no-show / cancelled across screens.

import type { ComponentType, SVGProps } from "react";
import { CheckCircle, Clock, SlashCircle01, XCircle } from "@untitledui/icons";

export type BookingTone = "success" | "warning" | "error" | "neutral";

export interface BookingStatus {
    /** e.g. "Booked", "Waitlisted #2", "Attended", "No-show", "Cancelled". */
    label: string;
    tone: BookingTone;
    /** Optional icon override (e.g. hourglass for waitlist, reverse for refund). Falls back to the tone icon. */
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
    /** Optional colour override. Falls back to the tone colour. */
    color?: string;
}

const TONE: Record<BookingTone, { Icon: ComponentType<SVGProps<SVGSVGElement>>; color: string }> = {
    success: { Icon: CheckCircle, color: "#17b26a" },
    warning: { Icon: Clock, color: "#f79009" },
    error: { Icon: XCircle, color: "#f04438" },
    neutral: { Icon: SlashCircle01, color: "#667085" },
};

export interface BookingCardProps {
    /** Fitness class name, e.g. "Mat Pilates". */
    name: string;
    /** Pre-formatted short date, e.g. "Sun, 20 Feb". */
    date: string;
    /** Pre-formatted time, e.g. "10:00 AM". */
    time: string;
    /** Optional class duration — not surfaced in this Figma variant; reserved for reuse. */
    duration?: string;
    /** "Mat Studio - Forma Studio (South)". */
    location: string;
    status: BookingStatus;
    /** Cover image URL; falls back to `imageColor` when absent. */
    image?: string;
    /** Fallback background colour for the image tile (class category colour). */
    imageColor?: string;
    /** Desaturate the cover (cancelled / no-show bookings). */
    mutedCover?: boolean;
    onClick?: () => void;
}

export function BookingCard({ name, date, time, location, status, image, imageColor, mutedCover, onClick }: BookingCardProps) {
    const tone = TONE[status.tone];
    const Icon = status.icon ?? tone.Icon;
    const color = status.color ?? tone.color;
    const interactive = typeof onClick === "function";

    return (
        <div
            {...(interactive
                ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onClick?.() }
                : {})}
            className={`flex w-full flex-col rounded-2xl border border-[var(--colors-border-secondary,#e4e7ec)] bg-white px-4 pb-4 pt-3 ${interactive ? "cursor-pointer outline-none transition-colors active:bg-gray-50" : ""}`}
        >
            <div className="flex w-full flex-col gap-2">
                {/* Date • time */}
                <p className="whitespace-nowrap text-xs font-medium leading-[18px] text-[#344054]">
                    {date} • {time}
                </p>

                <div className="flex w-full items-center gap-3">
                    {/* Image */}
                    <div
                        className="relative size-16 shrink-0 overflow-hidden rounded-[8px]"
                        style={{ backgroundColor: imageColor ?? "#f1f2ed" }}
                    >
                        {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={image}
                                alt=""
                                className={`pointer-events-none size-full object-cover ${mutedCover ? "grayscale" : ""}`}
                            />
                        ) : null}
                    </div>

                    {/* Class info */}
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                        <div className="flex w-full flex-col">
                            <p className="whitespace-nowrap text-base font-semibold leading-6 text-[#101828]">{name}</p>
                            <p className="w-full truncate text-xs font-normal leading-[18px] text-[#475467]">{location}</p>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-1">
                            <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
                            <span className="truncate text-xs font-medium leading-[18px] text-[#344054]">{status.label}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
