"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Shared time-of-day picker — the NON-native dropdown used by the admin class
// schedule form's per-day "General schedule" slot rows. Extracted verbatim from
// ScheduleFormPage so the in-chat AI-agent recurrence editor renders the exact
// same control (no native <select> anywhere). Both import from here.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";
import { ClockFastForward, ChevronUp, ChevronDown } from "@untitledui/icons";
import { cn, to12h } from "@/lib/utils";

export const DAY_FULL: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

// 06:00 → 22:00 in 15-minute steps — the last-resort slot list for callers that
// don't pass a branch-business-hours-derived window.
export const DEFAULT_TIME_SLOTS: string[] = [];
for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
        if (h === 22 && m > 0) break;
        DEFAULT_TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
}

export function fmtTime(t: string): string {
    return to12h(t);
}

/** "09:00 - 10:00 AM" when start and end share AM/PM; falls back to full "09:00 AM - 12:30 PM" across periods. */
export function fmtSlotRange(start: string, end: string): string {
    if (!start || !end) return "";
    const sh = Number(start.split(":")[0]);
    const eh = Number(end.split(":")[0]);
    const sap = sh >= 12 ? "PM" : "AM";
    const eap = eh >= 12 ? "PM" : "AM";
    if (sap === eap) {
        const startNoSuffix = fmtTime(start).replace(/ (AM|PM)$/, "");
        return `${startNoSuffix} - ${fmtTime(end)}`;
    }
    return `${fmtTime(start)} - ${fmtTime(end)}`;
}

export function TimeDropdown({ value, onChange, slots, unavailable = [], placeholder = "Select time", minAfter, disabled, emptyLabel, displayValue }: {
    value: string; onChange: (t: string) => void;
    /** Selectable slots — defaults to 06:00–22:00 when not provided. The
     *  schedule form passes branch-business-hours-derived slots so the form
     *  and the day/week grid agree on the legal window. */
    slots?: string[];
    unavailable?: string[]; placeholder?: string;
    minAfter?: string; // disables slots <= this value (use for end time)
    /** Renders the trigger as non-interactive (e.g. when no date/branch is picked yet). */
    disabled?: boolean;
    /** Message shown in the dropdown when `slots` is empty (branch is closed). */
    emptyLabel?: string;
    /** Optional label override for the trigger — when set, overrides the
     *  default `fmtTime(value)` rendering. The General-schedule day card
     *  uses this to show the combined "HH:MM – HH:MM" start/end range on a
     *  single line, so each slot collapses to one input instead of two. */
    displayValue?: string;
}) {
    const visibleSlots = slots ?? DEFAULT_TIME_SLOTS;
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    // Fixed-positioning state so the menu can escape any `overflow:auto`
    // ancestor (the General-schedule horizontal-scroll row clips its
    // children when overflow-x is auto — see memory[feedback_dropdown_overflow]).
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

    useEffect(() => {
        function h(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node) &&
                listRef.current && !listRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // Recompute menu position whenever it opens, the trigger moves, or the
    // user scrolls. Anchored to the trigger's bounding rect so the dropdown
    // always lines up with the input.
    useEffect(() => {
        if (!open) { setMenuStyle(null); return; }
        function position() {
            const t = triggerRef.current;
            if (!t) return;
            const r = t.getBoundingClientRect();
            const menuH = 220;
            const margin = 8;
            const spaceBelow = window.innerHeight - r.bottom;
            const flipUp = spaceBelow < menuH + margin && r.top > menuH + margin;
            setMenuStyle({
                position: "fixed",
                left: r.left,
                width: r.width,
                zIndex: 9999,
                ...(flipUp
                    ? { bottom: window.innerHeight - r.top + 4 }
                    : { top: r.bottom + 4 }),
            });
        }
        position();
        window.addEventListener("scroll", position, true);
        window.addEventListener("resize", position);
        return () => {
            window.removeEventListener("scroll", position, true);
            window.removeEventListener("resize", position);
        };
    }, [open]);

    useEffect(() => {
        if (open && value && listRef.current) {
            const el = listRef.current.querySelector('[data-sel="true"]');
            if (el) el.scrollIntoView({ block: "center" });
        }
    }, [open, value]);

    return (
        <div ref={ref} className="relative">
            <button ref={triggerRef} type="button" onClick={() => { if (!disabled) setOpen(p => !p); }} disabled={disabled}
                className={cn("flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[16px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] transition-all",
                    value ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-text-quaternary)]",
                    disabled ? "opacity-60 cursor-not-allowed" : open ? "ring-2 ring-[var(--colors-secondary-300)] border-[var(--colors-secondary-500)]" : "hover:border-[var(--colors-secondary-500)]")}>
                <ClockFastForward className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                <span className="flex-1 text-left truncate">{value ? (displayValue ?? fmtTime(value)) : placeholder}</span>
                {open ? <ChevronUp className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />}
            </button>
            {open && menuStyle && (
                <div ref={listRef} style={menuStyle}
                    className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] max-h-[220px] overflow-y-auto py-1">
                    {visibleSlots.length === 0 ? (
                        <p className="px-4 py-3 text-[14px] text-[var(--colors-text-quaternary)]">{emptyLabel ?? "No time slots available."}</p>
                    ) : visibleSlots.map(slot => {
                        const isUnavail = unavailable.includes(slot) || (minAfter !== undefined && minAfter !== "" && slot <= minAfter);
                        const isSel = value === slot;
                        return (
                            <button key={slot} type="button" data-sel={isSel}
                                disabled={isUnavail}
                                onClick={() => { if (!isUnavail) { onChange(slot); setOpen(false); } }}
                                className={cn("flex items-center justify-between w-full px-4 py-3 text-left transition-colors",
                                    isUnavail ? "cursor-not-allowed bg-[var(--colors-bg-secondary)]" : "hover:bg-[var(--colors-bg-secondary)]",
                                    !isUnavail && isSel && "bg-[#f0fff8]")}>
                                <span className={cn(
                                    "text-[16px]",
                                    isUnavail ? "text-[var(--colors-fg-quaternary)]" : isSel ? "font-semibold text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)]",
                                )}>
                                    {fmtTime(slot)}
                                </span>
                                {isUnavail && (
                                    <span className="text-[12px] font-medium text-[var(--colors-text-quaternary)] bg-[var(--colors-bg-tertiary)] rounded-full px-3 py-[2px]">Unavailable</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
