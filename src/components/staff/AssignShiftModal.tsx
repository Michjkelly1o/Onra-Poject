"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Assign a shift to a staff member (modal)
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened from a staff row's 3-dot "Assign shift". Same modal chrome as
// [AssignStaffModal] (centered card, header title + subtitle + X, search) with
// the EXACT shift cards from the Staff Schedule picker (`PickerShiftRow`), and
// the same store action (`addShiftAssignment`) + overlap guard
// (`findShiftConflict`) — so the behaviour matches the week-view flow.

import { useMemo } from "react";
import { XClose, Clock } from "@untitledui/icons";
import { useAppStore, type Staff } from "@/lib/store";
import { findShiftConflict } from "@/lib/staff/shift-conflict";
import { currentWeekMondayISO } from "@/lib/week";
import { shiftDaysSummary, shiftTime12 } from "@/components/schedule/AddShiftPanel";

export function AssignShiftModal({ staff, onClose, onPick }: {
    staff: Staff;
    onClose: () => void;
    /** When provided, picking a shift calls this (so the caller can chain the
     *  period-confirmation modal) INSTEAD of assigning immediately. */
    onPick?: (shiftId: string, shiftName: string) => void;
}) {
    const shifts             = useAppStore((s) => s.shifts);
    const shiftAssignments   = useAppStore((s) => s.shiftAssignments);
    const addShiftAssignment = useAppStore((s) => s.addShiftAssignment);
    const showToast          = useAppStore((s) => s.showToast);

    // Only LIVE assignments count — a shift un-assigned forward lives on as
    // read-only past history and must stay re-assignable this week onward
    // (client 2026-08-19).
    const myAssignments = useMemo(() => {
        const currentWeekISO = currentWeekMondayISO();
        return shiftAssignments.filter((a) =>
            a.staff_id === staff.id
            && (!a.end_week_start || a.end_week_start > currentWeekISO)
            && a.days_of_week.some(Boolean));
    }, [shiftAssignments, staff.id]);
    const assignedIds = useMemo(() => new Set(myAssignments.map((a) => a.shift_id)), [myAssignments]);

    // Shifts are branch-agnostic (client 2026-08) — every active shift is
    // assignable to this staff member regardless of branch.
    const branchShifts = useMemo(
        () => shifts.filter((sh) => sh.status === "active" && !sh.deleted_at),
        [shifts],
    );
    // Not already held.
    const available = branchShifts.filter((sh) => sh.id !== staff.shiftId && !assignedIds.has(sh.id));

    function handlePick(shiftId: string) {
        const shift = shifts.find((s) => s.id === shiftId);
        if (!shift) return;
        const clash = findShiftConflict(shift, myAssignments, (id) => shifts.find((s) => s.id === id));
        if (clash) {
            showToast(
                "Shift conflict",
                `${staff.fullName} is already on ${clash.name}, which overlaps ${shift.name}.`,
                "error", "alert",
            );
            return;
        }
        if (onPick) { onPick(shiftId, shift.name); return; }
        addShiftAssignment({ shift_id: shiftId, staff_id: staff.id });
        showToast(
            "Shift assigned",
            `${shift.name} has been assigned to ${staff.fullName}.`,
            "success", "check",
        );
        onClose();
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-[#e4e7ec] px-6 pb-5 pt-6">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-[18px] font-semibold leading-[28px] text-[#101828]">Assign shift</p>
                        <p className="text-[14px] leading-[20px] text-[#475467]">
                            Pick a shift to assign to <span className="font-medium text-[#344054]">{staff.fullName}</span>.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="flex size-11 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[#f9fafb]">
                        <XClose className="size-6 text-[#667085]" />
                    </button>
                </div>

                {/* Shift cards — the same gray picker card the Staff schedule uses. */}
                <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-6 pb-6 pt-5">
                    {available.length === 0 ? (
                        <p className="py-8 text-center text-[14px] text-[#667085]">
                            {branchShifts.length === 0
                                ? "No active shifts at this branch yet."
                                : "All shifts already assigned."}
                        </p>
                    ) : (
                        available.map((sh) => (
                            <button key={sh.id} type="button" onClick={() => handlePick(sh.id)}
                                className="group text-left flex items-stretch gap-3 rounded-[10px] border-1 border-[var(--colors-bg-quaternary)] bg-[var(--colors-bg-secondary)] pl-2.5 pr-2 py-3 hover:bg-white hover:border-[var(--colors-secondary-400)] transition-colors">
                                <span className="w-1 shrink-0 rounded-full bg-[var(--colors-bg-quaternary)]" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-semibold text-[var(--colors-text-secondary)] truncate">{sh.name}</p>
                                    <p className="flex items-center gap-1.5 text-[13px] text-[var(--colors-text-quaternary)] mt-0.5 truncate">
                                        <Clock className="w-4 h-4 shrink-0" />
                                        {shiftDaysSummary(sh.working_days)} • {shiftTime12(sh.start_time)} – {shiftTime12(sh.end_time)}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
