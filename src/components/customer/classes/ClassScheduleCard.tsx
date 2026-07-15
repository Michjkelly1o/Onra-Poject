"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ClassScheduleCard (shared) — class row used by Search + Instructor Detail
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j nodes 3921-59519 / 3924-39100 / 2126-5547. A
// bordered white card for one class instance: cover thumb, name + "with
// [instructor]", a state badge (spots-left / waitlist / FULL / Booked), room +
// branch, start time + duration, and a state-driven CTA. The whole card and the
// CTA both open Class Details (the booking happens there). Built from scratch.

import { Clock, Hourglass03, MarkerPin01, Users01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";

export type BadgeTone = "success" | "neutral" | "error";

export interface ClassScheduleCardProps {
    name: string;
    instructorName: string;
    coverImage?: string;
    coverColor: string;
    /** Room label, e.g. "Mat Studio". */
    room: string;
    /** Branch label, e.g. "Forma Studio (South)". */
    branch: string;
    /** Start time + duration, e.g. "10:00 AM • 60 mins". */
    timeLabel: string;
    badgeLabel: string;
    badgeTone: BadgeTone;
    /** Leading badge icon — Users (open spots) / Hourglass (waitlist) / none. */
    badgeIcon?: "users" | "hourglass" | null;
    ctaLabel: string;
    ctaVariant?: "primary" | "secondary";
    ctaDisabled?: boolean;
    onAction?: () => void;
}

const TONE: Record<BadgeTone, string> = {
    success: "border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-primary)]",
    neutral: "border-[#e4e7ec] bg-[#f9fafb] text-[#344054]",
    error: "border-[#fecdca] bg-[#fef3f2] text-[#b42318]",
};

export function ClassScheduleCard({
    name,
    instructorName,
    coverImage,
    coverColor,
    room,
    branch,
    timeLabel,
    badgeLabel,
    badgeTone,
    badgeIcon = null,
    ctaLabel,
    ctaVariant = "primary",
    ctaDisabled = false,
    onAction,
}: ClassScheduleCardProps) {
    // Split "10:00 AM • 60 mins" so the start time reads medium and the duration
    // regular — matching the location line (room medium / branch regular).
    const [timeStart, ...timeRestParts] = timeLabel.split(" • ");
    const timeRest = timeRestParts.join(" • ");
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onAction}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAction?.();
                }
            }}
            className="flex w-full cursor-pointer flex-col gap-3 rounded-2xl border border-[#e4e7ec] bg-white p-4 text-left transition-shadow active:shadow-sm"
        >
            <div className="flex w-full items-center gap-3">
                <div
                    className="size-12 shrink-0 overflow-hidden rounded-md"
                    style={!coverImage ? { backgroundColor: coverColor } : undefined}
                >
                    {coverImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverImage} alt="" className="size-full object-cover" />
                    )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)]">{name}</p>
                    <p className="truncate text-xs font-normal leading-[18px] text-[#667085]">with {instructorName}</p>
                </div>

                <span
                    className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${TONE[badgeTone]}`}
                >
                    {badgeIcon === "users" && <Users01 className="size-3 shrink-0" aria-hidden />}
                    {badgeIcon === "hourglass" && <Hourglass03 className="size-3 shrink-0" aria-hidden />}
                    {badgeLabel}
                </span>
            </div>

            <div className="flex w-full flex-col gap-1">
                <div className="flex items-center gap-2">
                    <MarkerPin01 className="size-4 shrink-0 text-[#667085]" aria-hidden />
                    <p className="truncate text-xs leading-[18px]">
                        <span className="font-medium text-[#344054]">{room}</span>
                        <span className="font-normal text-[#667085]"> - {branch}</span>
                    </p>
                </div>
                {timeLabel && (
                    <div className="flex items-center gap-2">
                        <Clock className="size-4 shrink-0 text-[#667085]" aria-hidden />
                        <p className="truncate text-xs leading-[18px]">
                            <span className="font-medium text-[#344054]">{timeStart}</span>
                            {timeRest && <span className="font-normal text-[#667085]"> • {timeRest}</span>}
                        </p>
                    </div>
                )}
            </div>

            <Button
                variant={ctaVariant}
                size="sm"
                disabled={ctaDisabled}
                className="w-full rounded-full"
                onClick={(e) => {
                    e.stopPropagation();
                    onAction?.();
                }}
            >
                {ctaLabel}
            </Button>
        </div>
    );
}
