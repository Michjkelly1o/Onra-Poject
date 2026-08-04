"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · In-chat "Select days & General schedule" editor
// (Figma 391-148046) — the ONLY recurring editor left.
// ─────────────────────────────────────────────────────────────────────────────
//
// The recurring start date, end rule (Never/On/After) and repeat interval are
// now asked as individual question cards above the composer (ask_recur_*). This
// editor only collects the WEEKDAYS + per-day time slots — the last piece that
// genuinely needs a multi-control surface. On Confirm it hands the parent the
// day list; ChatThread relays it as "Days confirmed — days: <JSON>" and the
// model maps it onto preview_class_schedule's recurDays.

import { useMemo, useState } from "react";
import { Trash01, Plus, CheckCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TimeDropdown, fmtSlotRange, DAY_FULL } from "@/components/ui/TimeDropdown";
import type { DaySchedule } from "@/ai-agent/schedule/schedule-wizard";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Add minutes to a "HH:MM" clock string (24h, no midnight wrap needed here). */
function addMinutes(hhmm: string, mins: number): string {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const t = h * 60 + m + mins;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

interface Slot {
    startTime: string;
    endTime: string;
}

export interface SelectDaysEditorProps {
    /** Class length in minutes — end time is auto-derived as start + duration. */
    durationMinutes: number;
    onConfirm: (days: DaySchedule[]) => void;
    confirmed?: DaySchedule[] | null;
}

export function SelectDaysEditor({ durationMinutes, onConfirm, confirmed }: SelectDaysEditorProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [byDay, setByDay] = useState<Record<string, Slot[]>>({});

    const locked = !!confirmed;

    const toggleDay = (day: string) => {
        if (locked) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(day)) next.delete(day);
            else {
                next.add(day);
                // Newly-added days inherit the schedule of an already-filled day
                // (admin "General schedule" — set once, the rest follow).
                setByDay((b) => {
                    if (b[day]) return b;
                    const donor = WEEK_DAYS.find((d) => prev.has(d) && (b[d] ?? []).some((s) => s.startTime && s.endTime));
                    return { ...b, [day]: donor ? b[donor].map((s) => ({ ...s })) : [{ startTime: "", endTime: "" }] };
                });
            }
            return next;
        });
    };

    // Picking a start auto-fills the end from the class duration (matches the
    // admin form's single combined slot input). Setting the time on ONE day also
    // fills the other selected days that are still empty — you set it once and
    // the rest of the active days follow (admin "General schedule"). Any day can
    // still be overridden afterward.
    const setSlotStart = (day: string, i: number, start: string) =>
        setByDay((b) => {
            const updatedDay = b[day].map((s, si) => (si === i ? { startTime: start, endTime: addMinutes(start, durationMinutes) } : s));
            const next: Record<string, Slot[]> = { ...b, [day]: updatedDay };
            for (const d of WEEK_DAYS) {
                if (d === day || !selected.has(d)) continue;
                if (!(next[d] ?? []).some((s) => s.startTime && s.endTime)) {
                    next[d] = updatedDay.map((s) => ({ ...s }));
                }
            }
            return next;
        });
    const addSlot = (day: string) =>
        setByDay((b) => ({ ...b, [day]: [...(b[day] ?? []), { startTime: "", endTime: "" }] }));
    const removeSlot = (day: string, i: number) =>
        setByDay((b) => {
            const nextSlots = b[day].filter((_, si) => si !== i);
            // Deleting the last slot drops the weekday entirely — same as the form.
            if (nextSlots.length === 0) {
                setSelected((prev) => {
                    const n = new Set(prev);
                    n.delete(day);
                    return n;
                });
            }
            return { ...b, [day]: nextSlots };
        });

    const selectedDays = useMemo(() => WEEK_DAYS.filter((d) => selected.has(d)), [selected]);

    // Confirm enabled once every selected day has ≥1 complete slot.
    const canConfirm =
        selectedDays.length > 0 &&
        selectedDays.every((d) => (byDay[d] ?? []).some((s) => s.startTime && s.endTime));

    const confirm = () => {
        const days: DaySchedule[] = selectedDays.map((d) => ({
            day: d,
            slots: (byDay[d] ?? []).filter((s) => s.startTime && s.endTime),
        }));
        onConfirm(days);
    };

    if (confirmed) {
        const total = confirmed.reduce((n, d) => n + d.slots.length, 0);
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#aad4bd] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#3f8f68] shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">
                        Days set — {confirmed.map((d) => d.day).join(", ")}
                        {total ? ` · ${total} time slot${total === 1 ? "" : "s"}` : ""}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-6 shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]">
            {/* ── Select days (horizontal, same as the admin form) ── */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                    <p className="text-[16px] font-semibold text-[#101828]">Select days</p>
                    <p className="text-[14px] text-[#667085]">Pick the days, then set a start time for each one. You can add multiple slots per day.</p>
                </div>
                <div className="flex gap-2 sm:gap-3">
                    {WEEK_DAYS.map((d) => {
                        const isSel = selected.has(d);
                        return (
                            <button
                                key={d}
                                type="button"
                                onClick={() => toggleDay(d)}
                                className={cn(
                                    "flex-1 h-11 flex items-center justify-center rounded-[8px] text-[15px] font-medium transition-all",
                                    isSel
                                        ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                                        : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:border-[#aad4bd]",
                                )}
                            >
                                {d}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── General schedule — horizontal-scroll day cards with the shared TimeDropdown ── */}
            {selectedDays.length > 0 && (
                <div className="flex flex-col gap-4">
                    <p className="text-[16px] font-semibold text-[#101828]">General schedule</p>
                    <div className="relative">
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            {selectedDays.map((day) => (
                                <div key={day} className="w-[300px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3">
                                    <div className="flex flex-col">
                                        <p className="text-[14px] font-medium text-[#101828]">{DAY_FULL[day] ?? day}</p>
                                        <p className="text-[14px] text-[#667085]">Set schedule for this day.</p>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {(byDay[day] ?? []).map((s, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <TimeDropdown
                                                        value={s.startTime}
                                                        onChange={(v) => setSlotStart(day, i, v)}
                                                        placeholder="Select time"
                                                        displayValue={s.startTime ? fmtSlotRange(s.startTime, s.endTime) : ""}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeSlot(day, i)}
                                                    aria-label="Remove time slot"
                                                    className="w-11 h-11 flex items-center justify-center rounded-[8px] border-1 border-[#e4e7ec] bg-white shrink-0 text-[#d92d20] hover:bg-[#fef3f2] hover:border-[#fda29b] transition-colors"
                                                >
                                                    <Trash01 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => addSlot(day)}
                                        className="self-start flex items-center gap-1 px-3 py-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[14px] font-semibold text-[#344054] hover:bg-[#f9fafb] transition-colors"
                                    >
                                        <Plus className="w-5 h-5" />
                                        <span className="px-0.5">Add time slot</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-white to-transparent" />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end">
                <Button variant="primary" size="sm" disabled={!canConfirm} onClick={confirm}>
                    Confirm
                </Button>
            </div>
        </div>
    );
}
