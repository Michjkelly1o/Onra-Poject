// ─────────────────────────────────────────────────────────────────────────────
// Customer — BookingCard (shared) — PRD 13 §6.5 / §8.8
// ─────────────────────────────────────────────────────────────────────────────
//
// Reusable booking card used on Home → Upcoming Class, Bookings → Upcoming, and
// Bookings → Past. Built from scratch for the member surface (not the
// admin/instructor DS). Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-40391
// ("New Booking Card"). Content hierarchy and tokens match the design exactly;
// the status icon/colour is driven by `tone` so the same card serves booked /
// waitlisted / attended / no-show / cancelled across screens.

import type { ComponentType, SVGProps } from "react";
import { CheckCircle, Clock, SlashCircle01, XCircle, Star01 } from "@untitledui/icons";

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
    success: { Icon: CheckCircle, color: "#164e52" },
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
    /** Optional branch timezone label — rendered on its own line under the
     *  location so members with cross-city bookings never have to guess
     *  which zone a time is in. */
    tzLabel?: string;
    status: BookingStatus;
    /** Cover image URL; falls back to `imageColor` when absent. */
    image?: string;
    /** Fallback background colour for the image tile (class category colour). */
    imageColor?: string;
    /** Desaturate the cover (cancelled / no-show bookings). */
    mutedCover?: boolean;
    onClick?: () => void;
    /** Optional action rendered INSIDE the card, below the content (e.g. a
     *  "Rate class" button on a past booking). Clicks here don't trigger the
     *  card's own onClick. */
    footer?: React.ReactNode;
    /** When defined, a 5-star row is shown in the status slot INSTEAD of the
     *  status label — filled up to this value (0 / undefined-as-null = the
     *  empty rating state). Used by Past bookings on the home screen so rated
     *  and unrated attended cards read consistently. */
    rating?: number | null;
}

export function BookingCard({ name, date, time, location, tzLabel, status, image, imageColor, mutedCover, onClick, footer, rating }: BookingCardProps) {
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
                <p className="whitespace-nowrap text-xs font-medium leading-[18px] text-[var(--colors-text-secondary)]">
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
                            <p className="whitespace-nowrap text-base font-semibold leading-6 text-[var(--brand-text)]">{name}</p>
                            <p className="w-full truncate text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">{location}</p>
                            {tzLabel && (
                                <p className="w-full truncate text-[11px] font-normal leading-4 text-[var(--colors-fg-quaternary)]">{tzLabel}</p>
                            )}
                        </div>

                        {/* Status — or, when `rating` is provided, a 5-star row
                            sized to sit in the same slot as the status line. */}
                        {rating !== undefined ? (
                            <div className="flex items-center gap-0.5" aria-label={rating ? `Rated ${rating} out of 5` : "Not rated yet"}>
                                {[1, 2, 3, 4, 5].map((n) => (
                                    <Star01
                                        key={n}
                                        className="size-3.5 shrink-0"
                                        style={n <= (rating ?? 0) ? { fill: "#fdb022", color: "#fdb022" } : { fill: "#d5d9df", color: "#d5d9df" }}
                                        aria-hidden
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1">
                                <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
                                <span className="truncate text-xs font-medium leading-[18px] text-[var(--colors-text-secondary)]">{status.label}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {footer != null && (
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    {footer}
                </div>
            )}
        </div>
    );
}
