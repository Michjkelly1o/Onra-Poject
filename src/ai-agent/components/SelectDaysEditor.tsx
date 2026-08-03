"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · In-chat Select-days editor (Figma 391-157099 / 391-148046)
// ─────────────────────────────────────────────────────────────────────────────
//
// The recurring branch's per-day time-slot editor, in the chat column. Pick
// days (multi-select pills), then set one or more start/end slots per day.
// Mirrors the admin schedule form's recurrence editor; on Confirm it hands the
// parent a DaySchedule[] which ClassCard relays to the model as a compact JSON
// line the recurrence tools consume.

import { useMemo, useState } from "react";
import { Trash01, Plus, CheckCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DaySchedule } from "@/ai-agent/schedule/schedule-wizard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const FULL: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

/** 06:00 → 22:00 in 30-minute steps. */
const TIME_OPTIONS = (() => {
    const out: string[] = [];
    for (let m = 6 * 60; m <= 22 * 60; m += 30) {
        out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return out;
})();

interface Slot {
    startTime: string;
    endTime: string;
}

function TimeSelect({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                "flex-1 min-w-0 h-9 px-2.5 rounded-[8px] border border-[#d0d5dd] bg-white text-[14px] outline-none",
                value ? "text-[#101828]" : "text-[#667085]",
            )}
        >
            <option value="">{placeholder}</option>
            {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                    {t}
                </option>
            ))}
        </select>
    );
}

export interface SelectDaysEditorProps {
    onConfirm: (days: DaySchedule[]) => void;
    confirmed?: DaySchedule[] | null;
}

export function SelectDaysEditor({ onConfirm, confirmed }: SelectDaysEditorProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [byDay, setByDay] = useState<Record<string, Slot[]>>({});

    const toggleDay = (day: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(day)) next.delete(day);
            else {
                next.add(day);
                setByDay((b) => (b[day] ? b : { ...b, [day]: [{ startTime: "", endTime: "" }] }));
            }
            return next;
        });

    const setSlot = (day: string, i: number, patch: Partial<Slot>) =>
        setByDay((b) => ({ ...b, [day]: b[day].map((s, si) => (si === i ? { ...s, ...patch } : s)) }));
    const addSlot = (day: string) =>
        setByDay((b) => ({ ...b, [day]: [...(b[day] ?? []), { startTime: "", endTime: "" }] }));
    const removeSlot = (day: string, i: number) =>
        setByDay((b) => ({ ...b, [day]: b[day].filter((_, si) => si !== i) }));

    // Confirm enabled once every selected day has ≥1 complete slot.
    const selectedDays = useMemo(() => DAYS.filter((d) => selected.has(d)), [selected]);
    const canConfirm =
        selectedDays.length > 0 &&
        selectedDays.every((d) => (byDay[d] ?? []).some((s) => s.startTime && s.endTime));

    const confirm = () => {
        const result: DaySchedule[] = selectedDays.map((d) => ({
            day: d,
            slots: (byDay[d] ?? []).filter((s) => s.startTime && s.endTime),
        }));
        onConfirm(result);
    };

    if (confirmed) {
        const total = confirmed.reduce((n, d) => n + d.slots.length, 0);
        return (
            <div className="w-full flex items-center gap-2.5 rounded-[12px] border border-[#aad4bd] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#3f8f68] shrink-0" />
                <p className="text-[14px] text-[#101828] leading-5">
                    Days confirmed — <span className="font-medium">{confirmed.map((d) => d.day).join(", ")}</span>
                    {total ? ` · ${total} time slot${total === 1 ? "" : "s"}` : ""}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full bg-white border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
                <p className="text-[15px] font-semibold text-[#101828]">Select days</p>
                <p className="text-[13px] text-[#667085]">Pick the days, then set a start time for each. You can add multiple slots per day.</p>
            </div>

            {/* Day pills. */}
            <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                    const on = selected.has(d);
                    return (
                        <button
                            key={d}
                            type="button"
                            onClick={() => toggleDay(d)}
                            className={cn(
                                "px-3.5 h-9 rounded-[8px] border text-[14px] font-medium transition-colors",
                                on ? "border-[#3f8f68] bg-[#f1f7f4] text-[#1d5c3a]" : "border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f9fafb]",
                            )}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>

            {/* Per-day slot cards. */}
            {selectedDays.length > 0 && (
                <div className="flex flex-col gap-3">
                    <p className="text-[13px] font-semibold text-[#101828]">General schedule</p>
                    {selectedDays.map((d) => (
                        <div key={d} className="border border-[#e4e7ec] rounded-[10px] p-3 flex flex-col gap-2.5">
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[14px] font-medium text-[#101828]">{FULL[d]}</p>
                                <p className="text-[12px] text-[#667085]">Set schedule for this day.</p>
                            </div>
                            {(byDay[d] ?? []).map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <TimeSelect value={s.startTime} placeholder="Start" onChange={(v) => setSlot(d, i, { startTime: v })} />
                                    <span className="text-[#667085] text-[13px]">–</span>
                                    <TimeSelect value={s.endTime} placeholder="End" onChange={(v) => setSlot(d, i, { endTime: v })} />
                                    <button
                                        type="button"
                                        onClick={() => removeSlot(d, i)}
                                        className="shrink-0 size-9 flex items-center justify-center rounded-[8px] text-[#667085] hover:bg-[#f9fafb]"
                                        aria-label="Remove slot"
                                    >
                                        <Trash01 className="size-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addSlot(d)}
                                className="flex items-center justify-center gap-1.5 h-9 rounded-[8px] border border-dashed border-[#d0d5dd] text-[13px] font-medium text-[#344054] hover:bg-[#f9fafb]"
                            >
                                <Plus className="size-4" /> Add time slot
                            </button>
                        </div>
                    ))}
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
