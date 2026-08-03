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

import { useMemo, useState } from "react";
import Image from "next/image";
import { Image01, ChevronDown } from "@untitledui/icons";
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
    /** Appointment variant only — who the session is booked for. */
    customerName?: string;
}

/** One expanded occurrence for the recurring session list. */
export interface PreviewSession {
    dateISO: string;
    startTime: string;
    endTime: string;
}

export interface SchedulePreviewCardProps {
    data: SchedulePreviewData;
    /** Header copy override (private / recovery flows swap the noun). */
    title?: string;
    subtitle?: string;
    /** "class" (default) shows the full class grid. "appointment" hides the
     *  class-only fields (gender / equipment / spot selection) and shows a
     *  Customer field — private & recovery sessions don't have those. */
    variant?: "class" | "appointment";
    /** Recurring only — the generated occurrences. When present, an expandable
     *  "Preview of scheduled classes · N classes" row renders, grouped by month. */
    sessions?: PreviewSession[];
    className?: string;
}

const MONTHS_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
function parseISODate(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
function fmtTime12(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** The expandable, month-grouped list of every generated occurrence. */
function SessionList({ sessions }: { sessions: PreviewSession[] }) {
    const [open, setOpen] = useState(false);
    const groups = useMemo(() => {
        const order: string[] = [];
        const map = new Map<string, { dateISO: string; slots: PreviewSession[] }[]>();
        for (const s of sessions) {
            const dt = parseISODate(s.dateISO);
            const key = `${MONTHS_FULL[dt.getMonth()]} ${dt.getFullYear()}`;
            if (!map.has(key)) {
                map.set(key, []);
                order.push(key);
            }
            const days = map.get(key)!;
            const existing = days.find((d) => d.dateISO === s.dateISO);
            if (existing) existing.slots.push(s);
            else days.push({ dateISO: s.dateISO, slots: [s] });
        }
        return order.map((k) => ({ month: k, days: map.get(k)! }));
    }, [sessions]);

    return (
        <div className="mt-4 border border-[#e4e7ec] rounded-[10px] overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-[#f9fafb] transition-colors"
            >
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">Preview of scheduled classes</p>
                    <p className="text-[12px] text-[#667085] leading-[18px]">Review all upcoming scheduled dates and time slots.</p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-[#f2f4f7] px-2.5 py-0.5 text-[12px] font-medium text-[#344054]">
                    {sessions.length} {sessions.length === 1 ? "class" : "classes"}
                </span>
                <ChevronDown className={cn("size-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="px-3.5 pb-3 pt-1 flex flex-col gap-3 max-h-[300px] overflow-y-auto border-t border-[#e4e7ec]">
                    {groups.map((g) => (
                        <div key={g.month} className="flex flex-col gap-2">
                            <p className="text-[12px] font-semibold text-[#667085] pt-1">{g.month}</p>
                            {g.days.map((d) => {
                                const dt = parseISODate(d.dateISO);
                                return (
                                    <div key={d.dateISO} className="flex items-start gap-3">
                                        <span className="shrink-0 size-8 rounded-full bg-[#f2f4f7] flex items-center justify-center text-[13px] font-semibold text-[#344054]">
                                            {dt.getDate()}
                                        </span>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {d.slots.map((s, i) => (
                                                <span key={i} className="inline-flex items-center rounded-[6px] bg-[#f1f7f4] px-2 py-0.5 text-[12px] font-medium text-[#1d5c3a]">
                                                    {fmtTime12(s.startTime)} – {fmtTime12(s.endTime)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
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
    variant = "class",
    sessions,
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
        customerName,
    } = data;
    const isAppt = variant === "appointment";

    const instructorField = (
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
                    <span className="text-[14px] leading-5 font-medium text-[#101828] truncate">{instructorName}</span>
                </div>
            )}
        </Field>
    );

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

            {/* 2-col field grid. Left column then right column, row by row.
                Appointment variant hides class-only fields (gender / equipment /
                spot selection) and shows a Customer field instead. */}
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label={isAppt ? "Session type" : "Class type"} value={classType} />
                <Field label={isAppt ? "Category" : "Class category"} value={classCategory} />
                <Field label="Duration" value={duration} />
                <Field label={isAppt ? "Capacity" : "Class capacity"} value={capacity} />
                {isAppt ? (
                    <>
                        <Field label="Location" value={location} />
                        <Field label="Customer" value={customerName} />
                        {instructorField}
                        <Field label="Date & time" value={dateTime} />
                    </>
                ) : (
                    <>
                        <Field label="Gender access" value={genderAccess} />
                        <Field label="Location" value={location} />
                        <Field label="Equipment" value={equipment} />
                        <Field label="Spot selection" value={spotSelection} />
                        {instructorField}
                        <Field label="Date & time" value={dateTime} />
                    </>
                )}
            </div>

            {sessions && sessions.length > 0 && <SessionList sessions={sessions} />}
        </div>
    );
}
