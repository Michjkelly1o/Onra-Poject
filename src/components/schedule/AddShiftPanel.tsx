"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Schedule Day view · "Add shift" panel
// ─────────────────────────────────────────────────────────────────────────────
//
// A right-anchored panel that floats INSIDE the schedule view-card (16px inset
// top/bottom/right), with NO overlay backdrop — so the admin can still see + drag
// shift templates onto the staff columns. Same modal shadow stack as the DS.
//
// Top: an "Add shift" primary button that opens the new-shift form side panel.
// Below: the shift template list. Each card has a hover 3-dot menu — Assign staff
// (→ pick a staff → period modal → assign), Edit details, Delete shift. Assigning
// always confirms the 1-week / 1-month / 1-year period first. Card colour matches
// the Day-view shift blocks — the sidebar warm-neutral tone.

import { useState } from "react";
import { Plus, XClose, Clock, DotsVertical, UserPlus01, Edit02, Trash01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openStaffFormPanel } from "@/lib/staff-form-panel";
import { useAppStore, type Shift } from "@/lib/store";
import { AssignStaffModal } from "@/components/staff/AssignStaffModal";
import { ShiftPeriodModal } from "@/components/schedule/ShiftPeriodModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { findShiftConflict } from "@/lib/staff/shift-conflict";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // 0=Sun..6=Sat

/** "Mon - Sat" for a contiguous run, else "Wed, Fri, Sat"; "One-off" when none. */
export function shiftDaysSummary(days: boolean[]): string {
    const on = days.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    if (on.length === 0) return "One-off";
    if (on.length === 7) return "Every day";
    const contiguous = on.every((v, i) => i === 0 || v === on[i - 1] + 1);
    if (contiguous && on.length > 2) return `${DAY_ABBR[on[0]]} - ${DAY_ABBR[on[on.length - 1]]}`;
    return on.map(i => DAY_ABBR[i]).join(", ");
}

/** "07:00" → "7:00 AM". */
export function shiftTime12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Monday-of-week ISO for a "YYYY-MM-DD" date. */
function mondayISOof(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddShiftPanel({ open, onClose, shifts, branchId, dateISO, assignToStaff, topClass = "top-4" }: {
    open: boolean;
    onClose: () => void;
    shifts: Shift[];
    /** Toolbar location. Kept for compatibility — shifts are branch-agnostic
     *  now (client 2026-08) so the list is no longer scoped by it. */
    branchId: string;
    /** The viewed day — the assignment is scoped to this day's week. */
    dateISO: string;
    /** When set, the panel is in "assign to this staff" mode: the header
     *  reads "Pick a shift to assign to {name}", every template card is a
     *  one-click assign (period modal → assign), and no per-card 3-dot menu
     *  shows. Absent → the general Add-shift panel (drag / 3-dot actions). */
    assignToStaff?: { id: string; name: string };
    /** Position of the panel's top edge inside its relative container. Defaults
     *  to `top-4` (day view); the Staff schedule passes `top-[72px]` to clear
     *  its tab row. */
    topClass?: string;
}) {
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    const addShiftAssignment = useAppStore(s => s.addShiftAssignment);
    const deleteShifts = useAppStore(s => s.deleteShifts);
    const showToast = useAppStore(s => s.showToast);
    const allShifts = useAppStore(s => s.shifts);

    const [menuFor, setMenuFor] = useState<string | null>(null);         // shift id whose ⋮ menu is open
    const [assignFor, setAssignFor] = useState<Shift | null>(null);      // AssignStaffModal target
    const [periodFor, setPeriodFor] = useState<{ shift: Shift; staffId: string; staffName: string } | null>(null);
    const [deleteFor, setDeleteFor] = useState<Shift | null>(null);

    if (!open) return null;

    const assignMode = !!assignToStaff;
    // Shifts are branch-agnostic (client 2026-08) — every active shift is
    // pickable regardless of branch. In assign mode, hide shifts the target
    // staff already holds.
    const heldByTarget = assignToStaff
        ? new Set(shiftAssignments.filter(a => a.staff_id === assignToStaff.id).map(a => a.shift_id))
        : null;
    const list = shifts.filter(s =>
        s.status === "active" && (!heldByTarget || !heldByTarget.has(s.id)),
    );
    const weekStart = mondayISOof(dateISO);

    function confirmAssign(weeks: number) {
        if (!periodFor) return;
        const { shift, staffId, staffName } = periodFor;
        // Overlap guard — mirror the picker's rule.
        const mine = shiftAssignments.filter(a => a.staff_id === staffId);
        const clash = findShiftConflict(shift, mine, id => allShifts.find(s => s.id === id));
        if (clash) {
            showToast("Shift conflict", `${staffName} is already on ${clash.name}, which overlaps ${shift.name}.`, "error", "alert");
            setPeriodFor(null);
            return;
        }
        addShiftAssignment({ shift_id: shift.id, staff_id: staffId, week_start: weekStart, weeks });
        showToast("Staff assigned", `${staffName} was assigned to ${shift.name}.`, "success", "check");
        setPeriodFor(null);
        setAssignFor(null);
        // A targeted assign is a one-shot — close the panel once done.
        if (assignMode) onClose();
    }

    return (
        <>
            <div className={cn(
                `absolute ${topClass} right-4 z-30 w-[352px] max-w-[calc(100%-32px)] bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.10),0px_8px_8px_-4px_rgba(16,24,40,0.04)] flex flex-col overflow-hidden`,
                // General mode = full-height right rail (drag target). Assign mode
                // = a compact card that hugs its content (Figma 8132:406438).
                assignMode ? "max-h-[calc(100%-32px)]" : "bottom-4",
            )}>
                {/* Header */}
                <div className="shrink-0 flex items-start justify-between px-5 pt-5 pb-3">
                    <div className="min-w-0">
                        <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">Add shift</p>
                        <p className="text-[13px] text-[var(--colors-text-quaternary)] mt-0.5">
                            {assignMode ? `Pick a shift to assign to ${assignToStaff!.name}.` : "Drag and drop to the schedule"}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                {/* Add shift primary → new-shift form side panel */}
                <div className="px-5 pb-4 shrink-0">
                    <Button variant="primary" className="w-full" leftIcon={<Plus className="w-4 h-4" />}
                        onClick={() => openStaffFormPanel({ kind: "shift", mode: "create" })}>
                        Add shift
                    </Button>
                </div>

                {/* "Or choose from template" label — general mode only. In assign
                    mode the whole panel IS the shift picker, so it's dropped. */}
                {!assignMode && (
                    <p className="px-5 pb-2 text-[13px] font-medium text-[var(--colors-text-tertiary)] shrink-0">Or choose from template</p>
                )}

                {/* Shift template list */}
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-5 pb-5 pt-1 flex flex-col gap-2.5">
                    {list.length === 0 ? (
                        <p className="text-[13px] text-[var(--colors-text-quaternary)] text-center py-8">
                            {assignMode ? "No more shifts to assign." : "No shifts yet — create one above."}
                        </p>
                    ) : list.map(s => (
                        <div key={s.id}
                            draggable={!assignMode}
                            onDragStart={assignMode ? undefined : (e) => { e.dataTransfer.setData("text/shift-id", s.id); e.dataTransfer.effectAllowed = "copy"; setMenuFor(null); }}
                            onClick={assignMode ? () => setPeriodFor({ shift: s, staffId: assignToStaff!.id, staffName: assignToStaff!.name }) : undefined}
                            className={cn(
                                "group relative flex items-stretch gap-3 rounded-[10px] border-1 border-[var(--colors-bg-quaternary)] bg-[var(--colors-bg-secondary)] pl-2.5 pr-2 py-3",
                                assignMode
                                    ? "cursor-pointer hover:border-[var(--colors-secondary-400)] hover:bg-white transition-colors"
                                    : "cursor-grab active:cursor-grabbing",
                            )}>
                            <span className="w-1 shrink-0 rounded-full bg-[var(--colors-bg-quaternary)]" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[14px] font-semibold text-[var(--colors-text-secondary)] truncate">{s.name}</p>
                                <p className="flex items-center gap-1.5 text-[13px] text-[var(--colors-text-quaternary)] mt-0.5 truncate">
                                    <Clock className="w-4 h-4 shrink-0" />
                                    {shiftDaysSummary(s.working_days)} • {shiftTime12(s.start_time)} – {shiftTime12(s.end_time)}
                                </p>
                            </div>
                            {/* Hover 3-dot menu — general mode only. In assign mode
                                the whole card is a one-click assign. */}
                            {!assignMode && (
                            <button type="button" aria-label="Shift actions"
                                onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                                className={`w-7 h-7 shrink-0 self-start flex items-center justify-center rounded-[6px] hover:bg-[var(--colors-bg-quaternary)] transition-opacity ${menuFor === s.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                <DotsVertical className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
                            </button>
                            )}
                            {!assignMode && menuFor === s.id && (
                                <>
                                    <div className="fixed inset-0 z-[35]" onClick={() => setMenuFor(null)} />
                                    <div className="absolute right-2 top-10 z-40 w-[180px] bg-white border-1 border-[var(--colors-border-secondary)] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1.5">
                                        <button type="button" onClick={() => { setMenuFor(null); setAssignFor(s); }}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                                            <UserPlus01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" /> Assign staff
                                        </button>
                                        <button type="button" onClick={() => { setMenuFor(null); openStaffFormPanel({ kind: "shift", mode: "edit", id: s.id }); }}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]">
                                            <Edit02 className="w-4 h-4 text-[var(--colors-text-quaternary)]" /> Edit details
                                        </button>
                                        <button type="button" onClick={() => { setMenuFor(null); setDeleteFor(s); }}
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[14px] text-[#b42318] hover:bg-[#fef3f2]">
                                            <Trash01 className="w-4 h-4" /> Delete shift
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Assign staff → pick a staff member → period modal. */}
            {assignFor && (
                <AssignStaffModal
                    shift={assignFor}
                    onClose={() => setAssignFor(null)}
                    onPick={(staffId, staffName) => setPeriodFor({ shift: assignFor, staffId, staffName })}
                />
            )}

            {/* Period confirmation — always shown before an assignment commits. */}
            <ShiftPeriodModal
                open={!!periodFor}
                staffName={periodFor?.staffName ?? ""}
                onCancel={() => setPeriodFor(null)}
                onConfirm={confirmAssign}
            />

            {/* Delete shift — cascades to assigned staff. */}
            <ConfirmModal
                open={!!deleteFor}
                onClose={() => setDeleteFor(null)}
                tone="danger"
                icon={Trash01}
                title="Delete this shift?"
                description={<>Deleting <span className="font-semibold">{deleteFor?.name}</span> removes it from every staff member it's assigned to. This can't be undone.</>}
                confirmLabel="Delete"
                onConfirm={() => {
                    if (deleteFor) {
                        deleteShifts([deleteFor.id]);
                        showToast("Shift deleted", `${deleteFor.name} has been deleted.`, "success", "check");
                    }
                    setDeleteFor(null);
                }}
            />
        </>
    );
}
