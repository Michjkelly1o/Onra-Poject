"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · In-chat SINGLE date + time picker (Step 3, single class)
// ─────────────────────────────────────────────────────────────────────────────
//
// The single-class counterpart to SelectDaysEditor. A two-step card the model
// opens after the user chooses "Single" (does-not-repeat):
//   1. "When is the session?" — the next OPEN days at the branch as quick rows,
//      plus a "Pick a custom date" row that is the shared <DatePicker> (calendar
//      popover). Selecting either advances to step 2.
//   2. "When does the class start?" — only the GENUINELY-available start times
//      for the chosen instructor + room on that date, computed with the SAME
//      admin logic: branch business hours (buildTimeSlots) gated by the
//      instructor's shift + blocked time (gateSlotsByInstructor), minus any
//      instructor/room double-booking, minus past times today.
//
// On Confirm it hands the parent { dateISO, startTime }; ClassCard relays it to
// the model as a "Session date & time confirmed — …" line, which the model maps
// onto preview_class_schedule (recurring=false, dateISO, startTime).

import { useMemo, useState } from "react";
import { CheckCircle, ChevronLeft, ChevronRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { fmtTime } from "@/components/ui/TimeDropdown";
import { useAppStore, getBusinessHours, buildTimeSlots } from "@/lib/store";
import { gateSlotsByInstructor } from "@/lib/instructor-availability";

export interface SingleDateTimePick {
    dateISO: string;
    startTime: string;
}

export interface SingleDateTimeEditorProps {
    /** Class length in minutes — bounds the last start slot + conflict windows. */
    durationMinutes: number;
    /** Chosen instructor (step 2) — gates times to their shift + free slots. */
    instructorId?: string;
    /** Chosen room (step 2) — no other class may hold the room at that time. */
    roomId?: string;
    onConfirm: (pick: SingleDateTimePick) => void;
    confirmed?: SingleDateTimePick | null;
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && aE > bS;

/** ISO "YYYY-MM-DD" `n` days after `iso` (local calendar, no timezone drift). */
function addDaysISO(iso: string, n: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
/** "Fri, 26 Feb 2026". */
function fmtDateLabel(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const wd = dt.toLocaleDateString("en-US", { weekday: "short" });
    const mon = dt.toLocaleDateString("en-US", { month: "short" });
    return `${wd}, ${d} ${mon} ${y}`;
}

export function SingleDateTimeEditor({ durationMinutes, instructorId, roomId, onConfirm, confirmed }: SingleDateTimeEditorProps) {
    const businessHours    = useAppStore((s) => s.businessHours);
    const rooms            = useAppStore((s) => s.rooms);
    const staff            = useAppStore((s) => s.staff);
    const shifts           = useAppStore((s) => s.shifts);
    const shiftAssignments = useAppStore((s) => s.shiftAssignments);
    const blockedTimes     = useAppStore((s) => s.blockedTimes);
    const classSchedules   = useAppStore((s) => s.classSchedules);
    const appointments     = useAppStore((s) => s.appointments);

    const today = todayISO();
    const [step, setStep] = useState<1 | 2>(1);
    const [dateISO, setDateISO] = useState<string>("");
    const [startTime, setStartTime] = useState<string>("");

    // Branch = the room's branch (falls back to the instructor's) — drives
    // business hours, exactly like the admin form resolves it.
    const branchId = useMemo(
        () => rooms.find((r) => r.id === roomId)?.branch_id ?? staff.find((s) => s.id === instructorId)?.branchId ?? "",
        [rooms, roomId, staff, instructorId],
    );
    const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

    // Genuinely-available start times for a date — admin logic: branch hours →
    // instructor shift/blocked gate → no instructor/room double-book → not past.
    const timesFor = useMemo(() => (iso: string): string[] => {
        if (!iso || !branchId) return [];
        const window = getBusinessHours(businessHours, branchId, iso);
        if (!window) return [];
        let slots = buildTimeSlots(window, durationMinutes);
        if (instructorId) {
            slots = gateSlotsByInstructor(slots, iso, {
                instructorId, durationMins: durationMinutes, staffById, shifts, shiftAssignments, blockedTimes,
            });
        }
        slots = slots.filter((t) => {
            const s = toMin(t), e = s + durationMinutes;
            const classClash = classSchedules.some((c) =>
                c.dateISO === iso && c.status !== "Cancelled"
                && ((instructorId && c.instructorId === instructorId) || (roomId && c.roomId === roomId))
                && overlaps(s, e, toMin(c.startTime), toMin(c.endTime)),
            );
            if (classClash) return false;
            const apptClash = instructorId && appointments.some((a) =>
                a.dateISO === iso && a.status !== "Cancelled" && a.instructorId === instructorId
                && overlaps(s, e, toMin(a.startTime), toMin(a.endTime)),
            );
            return !apptClash;
        });
        if (iso === today) {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            slots = slots.filter((t) => toMin(t) > nowMin);
        }
        return slots;
    }, [businessHours, branchId, durationMinutes, instructorId, roomId, staffById, shifts, shiftAssignments, blockedTimes, classSchedules, appointments, today]);

    // The next OPEN days at the branch — quick date options (custom picker covers
    // any other date).
    const dateOptions = useMemo(() => {
        const out: string[] = [];
        for (let i = 0; i < 30 && out.length < 4; i++) {
            const iso = addDaysISO(today, i);
            if (branchId && getBusinessHours(businessHours, branchId, iso)) out.push(iso);
        }
        return out;
    }, [businessHours, branchId, today]);

    const times = useMemo(() => timesFor(dateISO), [timesFor, dateISO]);

    function pickDate(iso: string) {
        setDateISO(iso);
        setStartTime("");
        setStep(2);
    }
    function pickTime(t: string) {
        setStartTime(t);
        onConfirm({ dateISO, startTime: t });
    }

    if (confirmed) {
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[var(--colors-secondary-300)] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#3f8f68] shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5">Session scheduled</p>
                    <p className="text-[13px] text-[var(--colors-text-tertiary)] leading-5 mt-0.5">
                        {fmtDateLabel(confirmed.dateISO)} · {fmtTime(confirmed.startTime)}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white border border-[var(--colors-border-secondary)] rounded-[12px] overflow-hidden shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]">
            {/* Header — title + pager. Matches the AiQuestionPrompt chrome so
                the date/time step reads as the same kind of question panel. */}
            <div className="h-[52px] flex items-center gap-2 px-3.5 border-b border-[var(--colors-border-secondary)]">
                <p className="flex-1 min-w-0 text-[16px] font-semibold text-[var(--colors-text-primary)] leading-6 truncate">
                    {step === 1 ? "When is the session?" : "When does the class start?"}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        disabled={step === 1}
                        aria-label="Previous question"
                        className="size-6 flex items-center justify-center rounded-[3px] text-[var(--colors-text-quaternary)] enabled:hover:bg-[var(--colors-bg-secondary)] disabled:opacity-40 transition-colors"
                    >
                        <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="text-[14px] font-medium text-[var(--colors-text-quaternary)] tabular-nums px-1">
                        {step} of 2
                    </span>
                    <button
                        type="button"
                        onClick={step === 1 && dateISO ? () => setStep(2) : undefined}
                        disabled={!(step === 1 && dateISO)}
                        aria-label="Next question"
                        className="size-6 flex items-center justify-center rounded-[3px] text-[var(--colors-text-quaternary)] enabled:hover:bg-[var(--colors-bg-secondary)] disabled:opacity-40 transition-colors"
                    >
                        <ChevronRight className="size-3.5" />
                    </button>
                </div>
            </div>

            <div className="py-2">
                {step === 1 ? (
                    <>
                        {dateOptions.map((iso, i) => (
                            <OptionRow key={iso} index={i + 1} label={fmtDateLabel(iso)}
                                selected={dateISO === iso} onClick={() => pickDate(iso)} />
                        ))}
                        {/* Pick a custom date — the shared DS DatePicker (calendar popover). */}
                        <div className="px-1.5 pt-1">
                            <DatePicker
                                value={dateOptions.includes(dateISO) ? "" : dateISO}
                                onChange={(iso) => pickDate(iso)}
                                minDate={today}
                                placeholder="Pick a custom date"
                            />
                        </div>
                    </>
                ) : times.length === 0 ? (
                    <div className="mx-3 my-1 rounded-[10px] border border-dashed border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] py-8 px-4 flex flex-col items-center gap-1 text-center">
                        <p className="text-[14px] font-medium text-[var(--colors-text-tertiary)]">No times available on {fmtDateLabel(dateISO)}</p>
                        <p className="text-[12px] text-[var(--colors-fg-quaternary)]">The instructor is fully booked or off that day — go back and pick another date.</p>
                    </div>
                ) : (
                    <div className="max-h-[280px] overflow-y-auto">
                        {times.map((t, i) => (
                            <OptionRow key={t} index={i + 1} label={fmtTime(t)}
                                selected={startTime === t} onClick={() => pickTime(t)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/** A numbered selectable row — IDENTICAL to AiQuestionPrompt's plain option:
 *  a borderless row (only the number badge is bordered), same padding + hover,
 *  so the date/time step reads exactly like every other question step. */
function OptionRow({ index, label, selected, onClick }: {
    index: number; label: string; selected: boolean; onClick: () => void;
}) {
    return (
        <div className="px-1.5 py-0.5">
            <button type="button" onClick={onClick} aria-pressed={selected}
                className={cn(
                    "w-full flex items-center gap-3 pl-2 pr-2.5 py-1.5 rounded-[6px] text-left transition-colors",
                    selected ? "bg-[#f1f7f4]" : "hover:bg-[var(--colors-bg-secondary)]",
                )}>
                <span className={cn(
                    "shrink-0 size-6 flex items-center justify-center rounded-[6px] border text-[12px] font-medium",
                    selected ? "border-[var(--colors-secondary-300)] text-[var(--colors-text-secondary)] bg-white" : "border-[var(--colors-border-secondary)] text-[var(--colors-text-quaternary)] bg-white",
                )}>
                    {index}
                </span>
                <span className="flex-1 min-w-0 text-[14px] leading-5 font-medium text-[var(--colors-text-secondary)] truncate">{label}</span>
            </button>
        </div>
    );
}
