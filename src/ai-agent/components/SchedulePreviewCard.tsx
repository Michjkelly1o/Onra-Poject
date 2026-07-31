"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Class-creation live preview (Figma frames 4 / 14 / 15 / 16)
// ─────────────────────────────────────────────────────────────────────────────
//
// The persistent, in-thread card that shows "how your class schedule will look"
// while the wizard runs. It fills in as answers land; any field the user hasn't
// answered yet reads "Awaiting your answer" in amber.
//
// Purely props-driven — a plain `SchedulePreviewData` object. No store reads, no
// agent logic. The wizard state machine (Phase 3) owns mapping its answers into
// this shape; this component only renders.
//
// The recurring "Preview of scheduled classes · N classes ▾" row (frames 28 /
// 33 / 34) is deliberately NOT here yet — it belongs to the recurrence phase.

import Image from "next/image";
import { Image01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";

/** Every field is optional. A missing / empty field renders the amber
 *  "Awaiting your answer" placeholder — that IS the in-progress state. */
export interface SchedulePreviewData {
    /** Template header. */
    templateName?: string;
    templateDescription?: string;
    coverImageUrl?: string;
    // 2-col field grid (left column then right column, row by row).
    classType?: string; // "Group class"
    classCategory?: string; // "Pilates"
    duration?: string; // "60 minutes"
    capacity?: string; // "8 participants"
    genderAccess?: string; // "All gender"
    location?: string; // "Mat Studio"
    equipment?: string; // "Mat, resistance bands"
    spotSelection?: string; // "On · 4 x 2 layout"
    /** Instructor renders with an avatar; the rest are plain text. */
    instructorName?: string; // "Liam C."
    instructorAvatarUrl?: string;
    instructorInitials?: string;
    dateTime?: string; // "Fri, 26 Feb 2025 · 9:00 – 10:00 AM"
}

export interface SchedulePreviewCardProps {
    data: SchedulePreviewData;
    /** Header copy override (private / recovery flows swap the noun). */
    title?: string;
    subtitle?: string;
    className?: string;
}

function hasValue(v?: string): v is string {
    return !!v && v.trim().length > 0;
}

/** A muted label with either its value or the amber awaiting placeholder. */
function Field({
    label,
    value,
    children,
}: {
    label: string;
    value?: string;
    children?: React.ReactNode;
}) {
    const filled = hasValue(value) || !!children;
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[13px] leading-[18px] text-[#667085]">{label}</p>
            {filled ? (
                children ?? (
                    <p className="text-[14px] leading-5 font-medium text-[#101828] truncate">{value}</p>
                )
            ) : (
                <p className="text-[14px] leading-5 font-medium text-[#b54708]">Awaiting your answer</p>
            )}
        </div>
    );
}

export function SchedulePreviewCard({
    data,
    title = "Class preview",
    subtitle = "This is how your class schedule will look like.",
    className,
}: SchedulePreviewCardProps) {
    const {
        templateName,
        templateDescription,
        coverImageUrl,
        classType,
        classCategory,
        duration,
        capacity,
        genderAccess,
        location,
        equipment,
        spotSelection,
        instructorName,
        instructorAvatarUrl,
        instructorInitials,
        dateTime,
    } = data;

    const templateFilled = hasValue(templateName);

    return (
        <div
            className={cn(
                "w-full bg-white border border-[#e4e7ec] rounded-[12px] p-5",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.06)]",
                className,
            )}
        >
            {/* Header. */}
            <p className="text-[16px] font-semibold text-[#101828] leading-6">{title}</p>
            <p className="mt-0.5 text-[14px] text-[#667085] leading-5">{subtitle}</p>

            {/* Template row — cover + name + description. */}
            <div className="mt-4 flex items-start gap-3">
                <span className="shrink-0 size-12 rounded-[8px] overflow-hidden bg-[#f2f4f7] relative flex items-center justify-center">
                    {hasValue(coverImageUrl) ? (
                        <Image src={coverImageUrl} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                        <Image01 className="size-5 text-[#98a2b3]" />
                    )}
                </span>
                <div className="flex-1 min-w-0">
                    {templateFilled ? (
                        <>
                            <p className="text-[14px] font-semibold text-[#101828] leading-5 truncate">{templateName}</p>
                            {hasValue(templateDescription) && (
                                <p className="mt-0.5 text-[13px] text-[#667085] leading-[18px] line-clamp-2">
                                    {templateDescription}
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-[14px] font-medium text-[#b54708] leading-5 pt-1.5">Awaiting your answer</p>
                    )}
                </div>
            </div>

            {/* 2-col field grid. Left column then right column, row by row. */}
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Class type" value={classType} />
                <Field label="Class category" value={classCategory} />
                <Field label="Duration" value={duration} />
                <Field label="Class capacity" value={capacity} />
                <Field label="Gender access" value={genderAccess} />
                <Field label="Location" value={location} />
                <Field label="Equipment" value={equipment} />
                <Field label="Spot selection" value={spotSelection} />
                <Field label="Instructor" value={instructorName}>
                    {hasValue(instructorName) && (
                        <div className="flex items-center gap-2 min-w-0">
                            {hasValue(instructorAvatarUrl) ? (
                                <span className="shrink-0 size-6 rounded-full overflow-hidden bg-[#f2f4f7] relative">
                                    <Image src={instructorAvatarUrl} alt="" fill sizes="24px" className="object-cover" />
                                </span>
                            ) : (
                                <span className="shrink-0 size-6 rounded-full bg-[#f2f4f7] flex items-center justify-center text-[10px] font-semibold text-[#475467]">
                                    {instructorInitials ?? instructorName.slice(0, 1)}
                                </span>
                            )}
                            <span className="text-[14px] leading-5 font-medium text-[#101828] truncate">
                                {instructorName}
                            </span>
                        </div>
                    )}
                </Field>
                <Field label="Date & time" value={dateTime} />
            </div>
        </div>
    );
}
