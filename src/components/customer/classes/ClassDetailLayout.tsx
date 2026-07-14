"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ClassDetailLayout (shared) — Figma 2386-36343
// ─────────────────────────────────────────────────────────────────────────────
//
// The shared class detail layout composed by THREE distinct screens: Class
// Details (Search), Appointment Details (future), and Booking Detail (Bookings).
// It renders the hero (back + share + cover + name + subtitle + badge) and the
// body sections (description, info grid, equipment, check-in, cancellation
// policy, location). Each consumer layers its own pieces via slots:
//   • statusBlock  — inserted under the hero (Booking Status card)
//   • afterLocation — appended after Location (Ratings section)
//   • actionZone   — the sticky bottom thumb zone (Book / Cancel / Rate / …)

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronLeft, Clock, ClockFastForward, Maximize01, MarkerPin01, Share02, Tag01, UserCheck01, Users01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { classTimeDisplay } from "@/lib/customer/class-time";
import type { ClassDetailVM } from "@/lib/customer/search-data";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { ShareSheet } from "@/components/customer/shell/ShareSheet";

const CHECK_IN_GUIDANCE = ["Arrive 10 minutes early", "Late entry not permitted after 5 min"];

function InfoCell({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-1 items-center gap-3">{children}</div>;
}

/** "Sara Al-Rashid" → "Sara A." — keeps the instructor cell to one line on narrow
 *  screens so it never shifts the adjacent Class-type cell. */
function abbreviateName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2 || !parts[parts.length - 1][0]) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export interface ClassDetailLayoutProps {
    detail: ClassDetailVM;
    /** Date/time line over the cover, e.g. "Sun, 20 Feb at 10:00 AM". */
    heroSubtitle?: string;
    /** Optional second line shown UNDER the subtitle — used for the branch
     *  timezone label ("(UTC+04:00) Abu Dhabi") so it stacks below the
     *  date/time instead of running inline with a "·" separator. */
    heroSubtitleLine2?: string;
    /** Fully-rendered pill over the cover (state badge). */
    heroBadge?: ReactNode;
    /** Desaturate the cover (cancelled / no-show bookings). */
    mutedCover?: boolean;
    /** Section heading over the description. Default "Class details". */
    detailsHeading?: string;
    /** Replaces the default 2×2 class info grid (Duration/Capacity/Instructor/Type)
     *  — appointments pass their own Duration / Session-type / Instructor grid. */
    infoGrid?: ReactNode;
    /** Rendered under the hero, above the description (Booking Status card). */
    statusBlock?: ReactNode;
    /** Rendered after the Location section (Ratings section). */
    afterLocation?: ReactNode;
    /** Sticky bottom thumb-zone content. */
    actionZone?: ReactNode;
    /** Back affordance — defaults to router.back(). */
    onBack?: () => void;
}

export function ClassDetailLayout({
    detail,
    heroSubtitle,
    heroSubtitleLine2,
    heroBadge,
    mutedCover,
    detailsHeading,
    infoGrid,
    statusBlock,
    afterLocation,
    actionZone,
    onBack,
}: ClassDetailLayoutProps) {
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();
    // Dual-timezone class time (Branch time + Your time) for the default grid.
    const branches = useAppStore((st) => st.branches);
    const { timezone } = useCurrentCustomerContext();
    const branch = branches.find((b) => b.id === detail.branchId);
    const classTime = classTimeDisplay(detail.dateISO, detail.startTime, branch, timezone);
    const [expanded, setExpanded] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={onBack ?? (() => router.back())}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                >
                    <ChevronLeft className="size-5 text-white" aria-hidden />
                </button>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    aria-label="Share"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                >
                    <Share02 className="size-5 text-white" aria-hidden />
                </button>
            </CustomerHeader>

            {/* Hero */}
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#f9fafb]">
                {detail.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={detail.coverImage}
                        alt=""
                        className={`absolute inset-0 size-full object-cover ${mutedCover ? "grayscale" : ""}`}
                    />
                ) : (
                    <div className="absolute inset-0" style={{ backgroundColor: detail.coverColor }} />
                )}
                <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-b from-transparent to-black/65" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="truncate text-xl font-semibold leading-[30px] text-white">{detail.name}</p>
                        {heroSubtitle && (
                            <p className="text-sm font-normal leading-5 text-[#d0d5dd]">{heroSubtitle}</p>
                        )}
                        {heroSubtitleLine2 && (
                            <p className="text-xs font-normal leading-4 text-[#d0d5dd]/80">{heroSubtitleLine2}</p>
                        )}
                    </div>
                    {heroBadge}
                </div>
            </div>

            {/* Body */}
            <div className="flex w-full flex-1 flex-col gap-6 px-4 pb-6 pt-6">
                {statusBlock}

                {/* Class details */}
                <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">{detailsHeading ?? "Class details"}</h2>
                    <p className={`text-sm font-normal leading-5 text-[#475467] ${expanded ? "" : "line-clamp-3"}`}>
                        {detail.description}
                    </p>
                    {detail.description.length > 120 && (
                        <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="self-start text-sm font-semibold text-[var(--brand-text)]"
                        >
                            {expanded ? "See less" : "See more"}
                        </button>
                    )}
                </section>

                {/* Info grid — default class 2×2, or a caller-supplied grid (appointments). */}
                {infoGrid ?? (
                <div className="flex flex-col gap-4">
                    {/* Time — Branch time (always) + Your time (only when the customer's
                        timezone differs from the branch's). Figma 4408. */}
                    <div className="flex flex-1 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white">
                            <Clock className="size-5 text-[#344054]" aria-hidden />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-xs leading-[18px] text-[#667085]">Date & time</span>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{classTime.branchTime}</span>
                                {classTime.yourTime && (
                                    <span className="shrink-0 rounded-md border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] px-1.5 py-0.5 text-xs font-medium leading-[18px] text-[#0c2d34]">
                                        Branch time
                                    </span>
                                )}
                            </span>
                            {classTime.yourTime && (
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{classTime.yourTime}</span>
                                    <span className="shrink-0 rounded-md border border-[#e4e7ec] bg-[#f9fafb] px-1.5 py-0.5 text-xs font-medium leading-[18px] text-[#475467]">
                                        Your time
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <InfoCell>
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white">
                                <ClockFastForward className="size-5 text-[#344054]" aria-hidden />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-xs leading-[18px] text-[#667085]">Duration</span>
                                <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{detail.durationMins} minutes</span>
                            </div>
                        </InfoCell>
                        <InfoCell>
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white">
                                <Users01 className="size-5 text-[#344054]" aria-hidden />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-xs leading-[18px] text-[#667085]">Capacity</span>
                                <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{detail.capacity} participants</span>
                            </div>
                        </InfoCell>
                    </div>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => router.push(`/customer/instructors/${detail.instructorId}`)}
                            className="flex flex-1 items-center gap-3 text-left"
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white">
                                <UserCheck01 className="size-5 text-[#344054]" aria-hidden />
                            </span>
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-xs leading-[18px] text-[#667085]">Instructor</span>
                                <span className="flex items-center gap-1.5">
                                    <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                        {detail.instructorImageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={detail.instructorImageUrl}
                                                alt=""
                                                className="size-full scale-[1.4] object-cover"
                                            />
                                        ) : (
                                            <span className="text-[8px] font-semibold leading-none text-[#667085]">
                                                {detail.instructorInitials}
                                            </span>
                                        )}
                                    </span>
                                    <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">
                                        {abbreviateName(detail.instructorName)}
                                    </span>
                                </span>
                            </div>
                        </button>
                        <InfoCell>
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white">
                                <Tag01 className="size-5 text-[#344054]" aria-hidden />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-xs leading-[18px] text-[#667085]">Class type</span>
                                <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{detail.classType}</span>
                            </div>
                        </InfoCell>
                    </div>
                </div>
                )}

                {detail.equipment.length > 0 && (
                    <>
                        <div className="h-px w-full bg-[#e4e7ec]" />
                        <section className="flex flex-col gap-3">
                            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Equipment</h2>
                            <div className="flex flex-col gap-2">
                                {detail.equipment.map((e) => (
                                    <div key={e} className="flex items-center gap-2 text-sm font-normal leading-5 text-[#475467]">
                                        <Tag01 className="size-4 shrink-0 text-[#667085]" aria-hidden />
                                        {e}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                <div className="h-px w-full bg-[#e4e7ec]" />
                <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Check-in or arrival guidance</h2>
                    <div className="flex flex-col gap-2">
                        {CHECK_IN_GUIDANCE.map((g) => (
                            <div key={g} className="flex items-center gap-2 text-sm font-normal leading-5 text-[#475467]">
                                <CheckCircle className="size-4 shrink-0 text-[#667085]" aria-hidden />
                                {g}
                            </div>
                        ))}
                    </div>
                </section>

                <div className="h-px w-full bg-[#e4e7ec]" />
                <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Cancellation policy</h2>
                    <p className="text-sm font-normal leading-5 text-[#475467]">Full refund if you cancel 24 hours before.</p>
                </section>

                <div className="h-px w-full bg-[#e4e7ec]" />
                <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Location</h2>
                    <div className="relative h-[160px] w-full overflow-hidden rounded-xl bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/customer/branch-map.png" alt="" className="absolute inset-0 size-full object-cover" />
                        <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-black/20 bg-[var(--brand-text)]">
                            <MarkerPin01 className="size-5 text-white" aria-hidden />
                        </span>
                        <button
                            type="button"
                            onClick={() => showToast("Map", "Full map view is coming soon.", "success")}
                            aria-label="Expand map"
                            className="absolute right-4 top-4 flex items-center justify-center rounded-full border border-[#f2f4f7] bg-white p-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        >
                            <Maximize01 className="size-5 text-[#344054]" aria-hidden />
                        </button>
                    </div>
                    <div className="flex w-full items-start gap-2">
                        <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">
                                {detail.room ? `${detail.room} - ` : ""}{detail.branchName}
                            </p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{detail.branchAddress}</p>
                        </div>
                    </div>
                </section>

                {afterLocation}
            </div>

            {actionZone && (
                <div
                    className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                        scrollable ? "bg-white" : ""
                    }`}
                >
                    {actionZone}
                </div>
            )}

            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                message={`Check out ${detail.name} at ${detail.branchName} on Onra!`}
                url={`https://onra.app/s/${detail.id}`}
            />
        </div>
    );
}
