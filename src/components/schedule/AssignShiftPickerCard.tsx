"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Assign-shift picker card (shared)
// ─────────────────────────────────────────────────────────────────────────────
//
// The "Add shift · Pick a shift to assign to {name}" card that flies out from a
// staff column / row 3-dot menu. Extracted so the /admin/schedule Day view and
// the Staff-schedule week view render the EXACT same picker (client 2026-08-11).
//
// Header + "+ Add shift" primary (opens the new-shift form) + a list of the
// active shifts the staff member doesn't already hold. Positioning is owned by
// the caller (a fixed-position wrapper anchored to the menu).

import { Plus, Clock } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { shiftDaysSummary, shiftTime12 } from "@/components/schedule/AddShiftPanel";
import type { Shift } from "@/lib/store";

export function AssignShiftPickerCard({ staffName, pickList, onAddShift, onPick }: {
    staffName: string;
    /** Active shifts the staff member does NOT already hold. */
    pickList: Shift[];
    onAddShift: () => void;
    onPick: (shiftId: string) => void;
}) {
    return (
        <div className="w-[380px] max-h-[68vh] bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.10),0px_8px_8px_-4px_rgba(16,24,40,0.04)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-3">
                <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">Add shift</p>
                <p className="text-[13px] text-[var(--colors-text-quaternary)] mt-0.5">Pick a shift to assign to {staffName}.</p>
            </div>
            {/* + Add shift → new-shift form side panel */}
            <div className="px-5 pb-4 shrink-0">
                <Button variant="primary" className="w-full" leftIcon={<Plus className="w-4 h-4" />} onClick={onAddShift}>
                    Add shift
                </Button>
            </div>
            {/* Shift list — only shifts the staff doesn't already hold. */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5 pb-5 flex flex-col gap-2.5">
                {pickList.length === 0 ? (
                    <p className="text-[13px] text-[var(--colors-text-quaternary)] text-center py-8">No more shifts to assign.</p>
                ) : pickList.map(s => (
                    <button key={s.id} type="button"
                        onClick={() => onPick(s.id)}
                        className="group text-left flex items-stretch gap-3 rounded-[10px] border-1 border-[var(--colors-bg-quaternary)] bg-[var(--colors-bg-secondary)] pl-2.5 pr-2 py-3 hover:bg-white hover:border-[var(--colors-secondary-400)] transition-colors">
                        <span className="w-1 shrink-0 rounded-full bg-[var(--colors-bg-quaternary)]" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-[var(--colors-text-secondary)] truncate">{s.name}</p>
                            <p className="flex items-center gap-1.5 text-[13px] text-[var(--colors-text-quaternary)] mt-0.5 truncate">
                                <Clock className="w-4 h-4 shrink-0" />
                                {shiftDaysSummary(s.working_days)} • {shiftTime12(s.start_time)} – {shiftTime12(s.end_time)}
                            </p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
