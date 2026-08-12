"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Schedule Day view · "Unassign staff shift" modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened from a staff column's 3-dot → "Unassign shift". Lists every shift the
// staff member currently holds; each row can be unassigned individually via its
// trash button, or all at once with "Unassign all shifts". Every removal fires
// the red/error "Shift unassigned" toast (client 2026-08). Closing when the
// last shift is removed. Matches the Figma unassign modal.

import { XClose, Trash01, Clock } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { useAppStore, type Staff, type Shift } from "@/lib/store";
import { shiftDaysSummary, shiftTime12 } from "@/components/schedule/AddShiftPanel";

export function UnassignShiftModal({ staff, onClose }: {
    staff: Staff;
    onClose: () => void;
}) {
    const shiftAssignments      = useAppStore(s => s.shiftAssignments);
    const shifts                = useAppStore(s => s.shifts);
    const removeShiftAssignment = useAppStore(s => s.removeShiftAssignment);
    const showToast             = useAppStore(s => s.showToast);

    // One card per shift (a staff can hold several week-scoped assignment rows
    // for the same shift — unassigning removes them all).
    const byShift = new Map<string, { shift: Shift; assignmentIds: string[] }>();
    for (const a of shiftAssignments) {
        if (a.staff_id !== staff.id) continue;
        const shift = shifts.find(s => s.id === a.shift_id);
        if (!shift) continue;
        const entry = byShift.get(shift.id) ?? { shift, assignmentIds: [] };
        entry.assignmentIds.push(a.id);
        byShift.set(shift.id, entry);
    }
    const rows = Array.from(byShift.values());

    function unassignOne(shift: Shift, assignmentIds: string[]) {
        assignmentIds.forEach(id => removeShiftAssignment(id));
        showToast("Shift unassigned", `${shift.name} was unassigned from ${staff.fullName}.`, "error", "trash");
        // Close once the final shift is gone.
        if (rows.length <= 1) onClose();
    }
    function unassignAll() {
        rows.forEach(r => r.assignmentIds.forEach(id => removeShiftAssignment(id)));
        showToast("Shifts unassigned", `All shifts were removed for ${staff.fullName}.`, "error", "trash");
        onClose();
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative flex max-h-[80vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]">
                {/* Header */}
                <div className="flex items-start justify-between px-6 pb-4 pt-6">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-[18px] font-semibold leading-[28px] text-[var(--colors-text-primary)]">Unassign staff shift?</p>
                        <p className="text-[14px] leading-[20px] text-[var(--colors-text-tertiary)]">
                            Are you sure you want to unassign <span className="font-medium text-[var(--colors-text-secondary)]">{staff.fullName}</span>&apos;s shift? They can be assigned again later.
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
                    ) : rows.map(({ shift, assignmentIds }) => (
                        <div key={shift.id}
                            className="flex items-center gap-3 rounded-[10px] border-1 border-[var(--colors-bg-quaternary)] bg-[var(--colors-bg-secondary)] pl-2.5 pr-3 py-3">
                            <span className="w-1 self-stretch shrink-0 rounded-full bg-[var(--colors-bg-quaternary)]" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold text-[var(--colors-text-secondary)] truncate">{shift.name}</p>
                                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-[var(--colors-text-quaternary)]">
                                    <Clock className="w-4 h-4 shrink-0" />
                                    {shiftDaysSummary(shift.working_days)} • {shiftTime12(shift.start_time)} – {shiftTime12(shift.end_time)}
                                </p>
                            </div>
                            <button type="button" aria-label={`Unassign ${shift.name}`}
                                onClick={() => unassignOne(shift, assignmentIds)}
                                className="flex size-9 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[#fef3f2]">
                                <Trash01 className="w-[18px] h-[18px] text-[var(--colors-text-quaternary)] hover:text-[#b42318]" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 pb-6 pt-4">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" disabled={rows.length === 0} onClick={unassignAll}>
                        Unassign all shifts
                    </Button>
                </div>
            </div>
        </div>
    );
}
