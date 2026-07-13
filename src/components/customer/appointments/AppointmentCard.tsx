"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — AppointmentCard (shared) — Search → Appointments tab — Figma 4279-58757
// ─────────────────────────────────────────────────────────────────────────────
//
// One bookable appointment service. Top row: 48px thumb + name + price, and a
// session badge (Private → user-01 "1 on 1"; Open → users "Up to [capacity]").
// Then a location row (branch) + a duration row (clock + "[N] mins"), and a
// full-width primary "Book now" button.

import { Clock, MarkerPin01, User01, Users01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";

export interface AppointmentCardProps {
    name: string;
    type: "private" | "open";
    price: number;
    durationMins: number;
    branch: string;
    coverImage?: string;
    coverColor: string;
    /** Open sessions only. */
    capacity?: number;
    onBook: () => void;
    /** CTA label — defaults to "Book now"; guests get "Log in to book". */
    ctaLabel?: string;
}

export function AppointmentCard({
    name,
    type,
    price,
    durationMins,
    branch,
    coverImage,
    coverColor,
    capacity,
    onBook,
    ctaLabel = "Book now",
}: AppointmentCardProps) {
    const isPrivate = type === "private";
    const BadgeIcon = isPrivate ? User01 : Users01;
    const badgeLabel = isPrivate ? "1 on 1" : `Up to ${capacity ?? 0}`;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onBook}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onBook();
                }
            }}
            className="flex w-full cursor-pointer flex-col gap-3 rounded-2xl border border-[#e4e7ec] bg-white p-4 text-left transition-shadow active:shadow-sm"
        >
            {/* Top row: thumb + name/price + session badge */}
            <div className="flex w-full items-center gap-3">
                <div
                    className="size-12 shrink-0 overflow-hidden rounded-md bg-white"
                    style={!coverImage ? { backgroundColor: coverColor } : undefined}
                >
                    {coverImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImage} alt="" className="size-full object-cover" />
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)]">{name}</p>
                    <p className="truncate text-xs font-normal leading-[18px] text-[#667085]">AED {price}</p>
                </div>

                <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 text-xs font-medium leading-[18px] text-[#344054]">
                    <BadgeIcon className="size-3 shrink-0" aria-hidden />
                    {badgeLabel}
                </span>
            </div>

            {/* Location + duration */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <MarkerPin01 className="size-4 shrink-0 text-[#475467]" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-xs font-medium leading-[18px] text-[#344054]">{branch}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="size-4 shrink-0 text-[#475467]" aria-hidden />
                    <p className="text-xs font-medium leading-[18px] text-[#344054]">{durationMins} mins</p>
                </div>
            </div>

            {/* Book now */}
            <Button
                variant="primary"
                size="sm"
                className="w-full rounded-full"
                onClick={(e) => {
                    e.stopPropagation();
                    onBook();
                }}
            >
                {ctaLabel}
            </Button>
        </div>
    );
}
