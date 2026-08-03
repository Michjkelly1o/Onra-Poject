"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · In-chat RECURRENCE editor (mirrors the admin schedule form's
// recurring section, Figma 391-157099 / 391-148046)
// ─────────────────────────────────────────────────────────────────────────────
//
// The whole recurring configuration in the chat column, built from the SAME
// components the real /schedule/new form uses — no chat-only reinventions:
//   • Start date + "Recurring Ends → On" date  → <DatePicker>  (ui/DatePicker)
//   • "Repeat every N weeks" / "After N classes" → <NumericInput> (ui/NumericInput)
//   • Select days                                → horizontal WEEK_DAYS buttons
//   • Per-day time slots                         → <TimeDropdown> (ui/TimeDropdown)
//
// On Confirm it hands the parent a RecurrenceConfig which ClassCard relays to
// the model as a compact JSON line; the model maps each field onto
// preview_class_schedule's recur* arguments.

import { useMemo, useState } from "react";
import { Trash01, Plus, CheckCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { NumericInput } from "@/components/ui/NumericInput";
import { TimeDropdown, fmtSlotRange, DAY_FULL } from "@/components/ui/TimeDropdown";
import type { DaySchedule } from "@/ai-agent/schedule/schedule-wizard";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type EndRule = "never" | "on" | "after";

/** Full recurring config the editor emits — matches preview_class_schedule's
 *  recur* argument set 1-for-1. */
export interface RecurrenceConfig {
    startISO: string;
    endRule: EndRule;
    endOnISO?: string;
    endAfter?: number;
    everyWeeks: number;
    days: DaySchedule[];
}

/** Add minutes to a "HH:MM" clock string (24h, no wrap past midnight needed here). */
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
    /** Class length in minutes — end time is auto-derived as start + duration,
     *  exactly like the admin form. */
    durationMinutes: number;
    onConfirm: (config: RecurrenceConfig) => void;
    confirmed?: RecurrenceConfig | null;
}

export function SelectDaysEditor({ durationMinutes, onConfirm, confirmed }: SelectDaysEditorProps) {
    const today = todayISO();
    const [startISO, setStartISO] = useState<string>(today);
    const [endRule, setEndRule] = useState<EndRule>("never");
    const [endOnISO, setEndOnISO] = useState<string>("");
    const [endAfter, setEndAfter] = useState<number>(8);
    const [everyWeeks, setEveryWeeks] = useState<number>(1);

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
                setByDay((b) => (b[day] ? b : { ...b, [day]: [{ startTime: "", endTime: "" }] }));
            }
            return next;
        });
    };

    // Picking a start auto-fills the end from the class duration (matches the
    // admin form's single combined slot input).
    const setSlotStart = (day: string, i: number, start: string) =>
        setByDay((b) => ({
            ...b,
            [day]: b[day].map((s, si) => (si === i ? { startTime: start, endTime: addMinutes(start, durationMinutes) } : s)),
        }));
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

    // Confirm enabled once: a start date is set, the end rule's dependent field
    // is valid, and every selected day has ≥1 complete slot.
    const endValid =
        endRule === "never" ||
        (endRule === "on" && !!endOnISO) ||
        (endRule === "after" && endAfter >= 1);
    const canConfirm =
        !!startISO &&
        endValid &&
        everyWeeks >= 1 &&
        selectedDays.length > 0 &&
        selectedDays.every((d) => (byDay[d] ?? []).some((s) => s.startTime && s.endTime));

    const confirm = () => {
        const days: DaySchedule[] = selectedDays.map((d) => ({
            day: d,
            slots: (byDay[d] ?? []).filter((s) => s.startTime && s.endTime),
        }));
        onConfirm({
            startISO,
            endRule,
            ...(endRule === "on" ? { endOnISO } : {}),
            ...(endRule === "after" ? { endAfter } : {}),
            // "Never" pins the series to a single week, so the interval is 1.
            everyWeeks: endRule === "never" ? 1 : everyWeeks,
            days,
        });
    };

    if (confirmed) {
        const total = confirmed.days.reduce((n, d) => n + d.slots.length, 0);
        const ends =
            confirmed.endRule === "never"
                ? "no end date"
                : confirmed.endRule === "on"
                  ? `ends ${confirmed.endOnISO}`
                  : `ends after ${confirmed.endAfter} classes`;
        return (
            <div className="w-full flex items-start gap-2.5 rounded-[12px] border border-[#aad4bd] bg-[#f1f7f4] px-4 py-3">
                <CheckCircle className="size-4 text-[#3f8f68] shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">
                        Recurring schedule set — {confirmed.days.map((d) => d.day).join(", ")}
                        {total ? ` · ${total} time slot${total === 1 ? "" : "s"}` : ""}
                    </p>
                    <p className="text-[13px] text-[#475467] leading-5 mt-0.5">
                        From {confirmed.startISO}, every {confirmed.everyWeeks} week{confirmed.everyWeeks === 1 ? "" : "s"}, {ends}.
                    </p>
                </div>
            </div>
        );
    }

    const labelCls = "text-[14px] font-medium text-[#344054]";

    return (
        <div className="w-full bg-white border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-6">
            {/* ── Start date ── */}
            <div className="flex flex-col gap-1.5">
                <label className={labelCls}>When should the series start?</label>
                <div className="w-[220px] max-w-full">
                    <DatePicker value={startISO} onChange={setStartISO} minDate={today} />
                </div>
            </div>

            {/* ── Recurring Ends ── */}
            <div className="flex flex-col gap-4">
                <p className="text-[16px] font-semibold text-[#101828]">Recurring Ends</p>
                <div className="flex flex-col items-start gap-3">
                    <EndRadio label="Never" checked={endRule === "never"} onSelect={() => setEndRule("never")} />
                    <EndRadio label="On" checked={endRule === "on"} onSelect={() => setEndRule("on")}>
                        <div className={cn("w-[200px]", endRule !== "on" && "opacity-40 pointer-events-none")}>
                            <DatePicker value={endOnISO} onChange={setEndOnISO} minDate={startISO || today} />
                        </div>
                    </EndRadio>
                    <EndRadio label="After" checked={endRule === "after"} onSelect={() => setEndRule("after")}>
                        <div className={cn("flex items-center gap-2", endRule !== "after" && "opacity-40 pointer-events-none")}>
                            <div className="w-[100px]">
                                <NumericInput value={endAfter} onChange={setEndAfter} min={1} max={365} />
                            </div>
                            <span className="text-[14px] text-[#475467]">classes</span>
                        </div>
                    </EndRadio>
                </div>

                {/* Repeat every — hidden for "Never" (a single-week schedule has no interval). */}
                {endRule !== "never" && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className={labelCls}>Repeat every</label>
                            <NumericInput value={everyWeeks} onChange={setEveryWeeks} min={1} max={52} suffix="week" />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Select days (horizontal, same as the admin form) ── */}
            <div className="flex flex-col gap-4">
                <p className="text-[16px] font-semibold text-[#101828]">Select days</p>
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

/** Recurring-ends radio row — same look as the admin form's RepeatEndRadio. */
function EndRadio({ label, checked, onSelect, children }: { label: string; checked: boolean; onSelect: () => void; children?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <button type="button" onClick={onSelect} aria-pressed={checked} className="flex items-center gap-2 shrink-0 group">
                <span
                    className={cn(
                        "w-5 h-5 rounded-full border-1 flex items-center justify-center transition-colors",
                        checked ? "border-[#658774]" : "border-[#d0d5dd] group-hover:border-[#98a2b3]",
                    )}
                >
                    {checked && <span className="w-2.5 h-2.5 rounded-full bg-[#658774]" />}
                </span>
                <span className="text-[14px] font-medium text-[#344054]">{label}</span>
            </button>
            {children}
        </div>
    );
}
