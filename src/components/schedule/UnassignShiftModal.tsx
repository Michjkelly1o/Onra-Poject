"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — "Unassign staff shift" modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened from a staff row's 3-dot → "Unassign shift". Lists every shift the
// staff member still holds live from this week onward. Each shift row carries a
// PERIOD dropdown (DS FixedDropdown) before its trash — pick the weeks first,
// then hit the trash to un-assign (client 2026-08-19). The dropdown options are
// the shift's assigned weeks:
//   • Select all = "this week onward" (only shown when the shift spans >1 week)
//   • one checkbox per assigned week ("17 – 23 August 2026")
// Un-assigning every week caps the shift forward; ticking a subset removes only
// those weeks. Past weeks are never touched.

import { useRef, useState } from "react";
import { XClose, Clock, Check, ChevronDown } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { useAppStore, type Staff, type Shift } from "@/lib/store";
import { cn } from "@/lib/utils";
import { currentWeekMondayISO, addWeeksISO } from "@/lib/week";
import { shiftDaysSummary, shiftTime12 } from "@/components/schedule/AddShiftPanel";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseWeek(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
}
/** "17 – 23 Aug 2026" (or "31 Aug – 6 Sep 2026" across a month). */
function weekLabel(mondayIso: string): string {
    const mon = parseWeek(mondayIso);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const yr = sun.getFullYear();
    return mon.getMonth() === sun.getMonth()
        ? `${mon.getDate()} – ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${yr}`
        : `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${yr}`;
}

/** Sage-green filled checkbox — matches the shared MultiSelectCard. */
function FilledCheckbox({ checked }: { checked: boolean }) {
    return (
        <span className={cn(
            "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
            checked ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)]" : "bg-white border-[var(--colors-border-primary)]",
        )}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </span>
    );
}

/** One shift row — an optional select checkbox, shift info, and a period
 *  dropdown. The checkbox is hidden when it's the staff's only shift. */
function ShiftUnassignRow({ shift, weeks, selected, checked, fromWeekISO, showCheckbox, onToggleShift, onToggleWeek, onToggleAll }: {
    shift: Shift;
    weeks: string[];
    selected: string[];
    checked: boolean;
    fromWeekISO: string;
    showCheckbox: boolean;
    onToggleShift: () => void;
    onToggleWeek: (iso: string) => void;
    onToggleAll: () => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const allChecked = weeks.length > 0 && weeks.every(w => selected.includes(w));
    const label = selected.length === 0
        ? "Select period"
        : allChecked ? "This week onward" : `${selected.length} week${selected.length === 1 ? "" : "s"}`;

    return (
        <div className="flex items-center gap-3 rounded-[10px] border-1 border-[var(--colors-bg-quaternary)] bg-[var(--colors-bg-secondary)] pl-2.5 pr-2.5 py-2.5">
            {showCheckbox && (
                <button type="button" onClick={onToggleShift} aria-label={`Select ${shift.name}`} className="shrink-0">
                    <FilledCheckbox checked={checked} />
                </button>
            )}
            <span className="w-1 self-stretch shrink-0 rounded-full bg-[var(--colors-bg-quaternary)]" />
            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--colors-text-secondary)] truncate">{shift.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-[var(--colors-text-quaternary)]">
                    <Clock className="w-4 h-4 shrink-0" />
                    {shiftDaysSummary(shift.working_days)} • {shiftTime12(shift.start_time)} – {shiftTime12(shift.end_time)}
                </p>
            </div>

            {/* Period dropdown */}
            <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border-1 border-[var(--colors-border-primary)] bg-white px-2.5 text-[13px] font-medium text-[var(--colors-text-secondary)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors hover:bg-[var(--colors-bg-secondary)]">
                <span className={cn("max-w-[120px] truncate", selected.length === 0 && "text-[var(--colors-text-quaternary)]")}>{label}</span>
                <ChevronDown className={cn("w-4 h-4 shrink-0 text-[var(--colors-text-quaternary)] transition-transform", open && "rotate-180")} />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={264}>
                <div className="max-h-[300px] overflow-y-auto py-1">
                    {weeks.length > 1 && (
                        <>
                            <button type="button" onClick={onToggleAll}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--colors-bg-secondary)]">
                                <FilledCheckbox checked={allChecked} />
                                <span className="text-[14px] font-medium text-[var(--colors-text-primary)]">Select all</span>
                                <span className="text-[12px] text-[var(--colors-text-quaternary)]">· this week onward</span>
                            </button>
                            <div className="mx-3 my-1 h-px bg-[var(--colors-bg-quaternary)]" />
                        </>
                    )}
                    {weeks.map(iso => (
                        <button key={iso} type="button" onClick={() => onToggleWeek(iso)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--colors-bg-secondary)]">
                            <FilledCheckbox checked={selected.includes(iso)} />
                            <span className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{weekLabel(iso)}</span>
                            {iso === fromWeekISO && <span className="text-[12px] text-[var(--colors-text-quaternary)]">· this week</span>}
                        </button>
                    ))}
                </div>
            </FixedDropdown>
        </div>
    );
}

export function UnassignShiftModal({ staff, onClose }: {
    staff: Staff;
    onClose: () => void;
}) {
    const shiftAssignments           = useAppStore(s => s.shiftAssignments);
    const shifts                     = useAppStore(s => s.shifts);
    const endShiftAssignmentsForward = useAppStore(s => s.endShiftAssignmentsForward);
    const unassignShiftForWeeks      = useAppStore(s => s.unassignShiftForWeeks);
    const showToast                  = useAppStore(s => s.showToast);

    const fromWeekISO = currentWeekMondayISO();
    const currentYear = new Date().getFullYear();

    const [selected, setSelected] = useState<Record<string, string[]>>({});
    const selFor = (id: string): string[] => selected[id] ?? [];

    // One card per shift the staff still holds live from this week onward.
    const byShift = new Map<string, Shift>();
    for (const a of shiftAssignments) {
        if (a.staff_id !== staff.id) continue;
        if (a.end_week_start && a.end_week_start <= fromWeekISO) continue;
        const shift = shifts.find(s => s.id === a.shift_id);
        if (!shift) continue;
        byShift.set(shift.id, shift);
    }
    // Only shifts that actually have assignable weeks left — an elapsed 1-week
    // span leaves an empty period list, which would be an un-actionable row.
    const rows = Array.from(byShift.values()).filter(sh => assignedWeeks(sh.id).length > 0);

    /** The weeks this shift is assigned, from this week to its end. A finite
     *  assignment lists its exact span; an open-ended recurring one (seed
     *  baseline) is bounded at the end of the current year so the list stays finite. */
    function assignedWeeks(shiftId: string): string[] {
        const live = shiftAssignments.filter(a =>
            a.staff_id === staff.id && a.shift_id === shiftId &&
            !(a.end_week_start && a.end_week_start <= fromWeekISO));
        let endExclusive: string | null = null;
        let indefinite = false;
        for (const a of live) {
            if (a.end_week_start) { if (!endExclusive || a.end_week_start > endExclusive) endExclusive = a.end_week_start; }
            else if (a.week_start) { const e = addWeeksISO(a.week_start, a.weeks ?? 1); if (!endExclusive || e > endExclusive) endExclusive = e; }
            else indefinite = true;
        }
        const out: string[] = [];
        let cur = fromWeekISO;
        for (let i = 0; i < 60; i++) {
            if (indefinite) { if (parseWeek(cur).getFullYear() > currentYear) break; }
            else if (endExclusive && cur >= endExclusive) break;
            else if (!endExclusive) break;
            out.push(cur);
            cur = addWeeksISO(cur, 1);
        }
        return out;
    }

    function toggleWeek(shiftId: string, iso: string) {
        setSelected(p => {
            const cur = p[shiftId] ?? [];
            return { ...p, [shiftId]: cur.includes(iso) ? cur.filter(w => w !== iso) : [...cur, iso] };
        });
    }
    function toggleAll(shiftId: string, weeks: string[]) {
        setSelected(p => {
            const cur = p[shiftId] ?? [];
            const all = weeks.length > 0 && weeks.every(w => cur.includes(w));
            return { ...p, [shiftId]: all ? [] : [...weeks] };
        });
    }

    /** Apply a shift's selected period; returns true if the shift was removed
     *  fully onward (so the modal can close on the last one). */
    function applyShift(shift: Shift): boolean {
        const weeks = assignedWeeks(shift.id);
        const sel = selFor(shift.id).filter(w => weeks.includes(w));
        if (sel.length === 0) return false;
        const isAll = weeks.length > 0 && weeks.every(w => sel.includes(w));
        if (isAll) {
            endShiftAssignmentsForward({ staffId: staff.id, shiftId: shift.id });
            showToast("Shift unassigned", `${shift.name} removed from ${staff.fullName} from this week onward.`, "error", "trash");
            return true;
        }
        unassignShiftForWeeks({ staffId: staff.id, shiftId: shift.id, weeks: sel });
        showToast("Shift unassigned", `${shift.name} removed from ${staff.fullName} for ${sel.length} week${sel.length === 1 ? "" : "s"}.`, "error", "trash");
        return false;
    }

    /** Left checkbox — selecting a shift auto-picks its full period ("this week
     *  onward"); the dropdown can then narrow it. Unchecking clears it. */
    function toggleShift(shift: Shift) {
        const weeks = assignedWeeks(shift.id);
        setSelected(p => ({ ...p, [shift.id]: (p[shift.id]?.length ?? 0) > 0 ? [] : [...weeks] }));
    }

    // A shift is actionable once it has a period selected (checkbox-selected
    // shifts default to their full span). The primary button applies them all.
    const actionable = rows.filter(sh => selFor(sh.id).length > 0);
    function unassign() {
        actionable.forEach(applyShift);
        onClose();
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]">
                {/* Header */}
                <div className="flex items-start justify-between px-6 pb-4 pt-6">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-[18px] font-semibold leading-[28px] text-[var(--colors-text-primary)]">Unassign staff shift?</p>
                        <p className="text-[14px] leading-[20px] text-[var(--colors-text-tertiary)]">
                            Select the shifts and weeks to un-assign for <span className="font-medium text-[var(--colors-text-secondary)]">{staff.fullName}</span>. Past weeks stay as read-only history.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="flex size-9 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--colors-bg-secondary)]">
                        <XClose className="size-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                {/* Shift list */}
                <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-6 pb-2">
                    {rows.length === 0 ? (
                        <p className="py-8 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                            {staff.fullName} has no shifts assigned.
                        </p>
                    ) : rows.map((shift) => (
                        <ShiftUnassignRow
                            key={shift.id}
                            shift={shift}
                            weeks={assignedWeeks(shift.id)}
                            selected={selFor(shift.id)}
                            fromWeekISO={fromWeekISO}
                            onToggleWeek={(iso) => toggleWeek(shift.id, iso)}
                            onToggleAll={() => toggleAll(shift.id, assignedWeeks(shift.id))}
                            checked={selFor(shift.id).length > 0}
                            showCheckbox={rows.length > 1}
                            onToggleShift={() => toggleShift(shift)}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 pb-6 pt-4">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" disabled={actionable.length === 0} onClick={unassign}>
                        Unassign shift
                    </Button>
                </div>
            </div>
        </div>
    );
}
