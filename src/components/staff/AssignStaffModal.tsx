"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Assign staff to a shift (modal)
// ─────────────────────────────────────────────────────────────────────────────
//
// Lifted from the class-schedule's `AddCustomerModal` chrome so admins
// recognise the interaction immediately (same header layout, same search
// + list rows + per-row primary action).
//
// The modal lists every ACTIVE staff member at the shift's branch (regardless
// of role) and shows badges for the staff member's current assignment state so
// the admin understands the consequence of clicking Assign:
//
//   • "Assigned" — already on THIS shift (button shows "Assigned",
//                  disabled).
//   • "On <name>" — currently on another shift; clicking Assign ADDS this
//                  shift on top (a staff member can hold multiple shifts).
//   • No badge — staff has no shift; clicking Assign places them.
//
// Client 2026-07-23 — assignment is now ADDITIVE and goes through the M2M
// `shiftAssignments` slice (`addShiftAssignment`), matching the week-view
// picker. It previously wrote the legacy single `staff.shiftId` via
// `updateStaff`, which destructively collapsed a staff member's multi-shift
// assignments down to one. It also enforces the same overlap rule as the week
// view: a staff member can't be added to a shift that clashes on the same
// weekday + time with one they already hold.

import { useState, useEffect } from "react";
import { XClose, SearchMd, UserPlus01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, type Shift } from "@/lib/store";
import { findShiftConflict } from "@/lib/staff/shift-conflict";

export function AssignStaffModal({ shift, onClose }: {
    shift: Shift;
    onClose: () => void;
}) {
    const staff              = useAppStore(s => s.staff);
    const shifts             = useAppStore(s => s.shifts);
    const shiftAssignments   = useAppStore(s => s.shiftAssignments);
    const addShiftAssignment = useAppStore(s => s.addShiftAssignment);
    const showToast          = useAppStore(s => s.showToast);

    const [search, setSearch] = useState("");
    useEffect(() => { setSearch(""); }, [shift.id]);

    // All ACTIVE staff at this branch — no role filter. Admin can assign
    // anyone (instructor, operator, front desk, etc.) to a shift.
    const available = staff
        .filter(s => s.branchId === shift.branch_id && s.status === "active")
        .filter(s => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                s.fullName.toLowerCase().includes(q) ||
                s.firstName.toLowerCase().includes(q) ||
                s.lastName.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q)
            );
        });

    function handleAssign(staffId: string, staffName: string) {
        // Overlap guard — mirror the week-view picker. A staff member can hold
        // multiple shifts, but not two that collide on the same weekday + time.
        const mine = shiftAssignments.filter(a => a.staff_id === staffId);
        const clash = findShiftConflict(shift, mine, (id) => shifts.find(s => s.id === id));
        if (clash) {
            showToast(
                "Shift conflict",
                `${staffName} is already on ${clash.name}, which overlaps ${shift.name}.`,
                "error", "alert",
            );
            return;
        }
        // Additive — adds this shift to the staff member's assignments without
        // touching any they already hold.
        addShiftAssignment({ shift_id: shift.id, staff_id: staffId });
        showToast(
            "Staff assigned",
            `${staffName} has been assigned to ${shift.name}.`,
            "success", "check",
        );
        // Keep the modal open so the admin can keep assigning more — same
        // UX as the Add customer modal.
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-full max-w-[720px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-[#e4e7ec]">
                    <div className="flex flex-col gap-1 min-w-0">
                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Assign staff</p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            Pick an instructor to assign to <span className="font-medium text-[#344054]">{shift.name}</span>.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 pt-5 pb-4">
                    <div className="relative">
                        <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#667085] pointer-events-none" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search staff by name or email"
                            className="w-full h-10 pl-10 pr-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {available.length === 0 ? (
                        <p className="text-[14px] text-[#667085] text-center py-8">
                            {search
                                ? "No matching staff found."
                                : "No staff available at this branch yet."}
                        </p>
                    ) : (
                        <div className="flex flex-col">
                            {available.map((s, i) => {
                                // A staff already assigned to this shift via
                                // the M2M table (or the legacy shiftId) counts
                                // as "on this shift".
                                const myAssignments = shiftAssignments.filter(a => a.staff_id === s.id);
                                const onThisShift = s.shiftId === shift.id
                                    || myAssignments.some(a => a.shift_id === shift.id);
                                // Client 2026-07-23 — the "On <shifts>" hint now
                                // lists every OTHER shift the staff holds (M2M),
                                // not just the legacy primary, so the multi-shift
                                // reality reads correctly. Falls back to the
                                // legacy shiftId when there are no M2M rows.
                                const otherShiftNames = (() => {
                                    const names = myAssignments
                                        .filter(a => a.shift_id !== shift.id)
                                        .map(a => shifts.find(x => x.id === a.shift_id)?.name)
                                        .filter((n): n is string => !!n);
                                    if (names.length === 0 && s.shiftId && s.shiftId !== shift.id) {
                                        const legacy = shifts.find(x => x.id === s.shiftId)?.name;
                                        if (legacy) names.push(legacy);
                                    }
                                    return names;
                                })();
                                return (
                                    <div key={s.id}
                                        className={cn(
                                            "grid grid-cols-[1fr_auto] items-center gap-4 py-3",
                                            i > 0 && "border-t border-[#e4e7ec]",
                                        )}>
                                        {/* Staff info */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            {s.imageUrl ? (
                                                <img src={s.imageUrl} alt={s.fullName}
                                                    className="w-10 h-10 rounded-full object-cover shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-white shrink-0"
                                                    style={{ backgroundColor: s.color }}>
                                                    {s.initials}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-medium text-[#101828] truncate">{s.fullName}</p>
                                                <p className="text-[13px] text-[#667085] truncate">
                                                    {onThisShift
                                                        ? s.email
                                                        : otherShiftNames.length > 0
                                                            ? <>On <span className="text-[#344054] font-medium">{otherShiftNames.join(", ")}</span></>
                                                            : s.email}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Assign button — disabled if already on THIS shift. */}
                                        {onThisShift ? (
                                            <Button variant="secondary-gray" size="sm" disabled>
                                                Assigned
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="secondary-gray"
                                                size="sm"
                                                leftIcon={<UserPlus01 className="w-4 h-4 text-[#344054]" />}
                                                onClick={() => handleAssign(s.id, s.fullName)}
                                            >
                                                Assign
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
