"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shift management tab (Staff & shift module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Sub-tab inside the Staff & shift route — renders the shifts table with
// bulk select + the standard archive/deactivate/delete action matrix.
//
// Per the brief (Figma 6223:378535):
//   Columns: Shift name (avatar + label), Branch location, Shift days,
//            Shift hours, Staff (assigned count), Status badge,
//            Enabled toggle (drives active ↔ inactive), Actions.
//   Bulk:    Same set as row actions — Archive · Deactivate / Delete ·
//            Reactivate · Recover. Delete only available when EVERY
//            selected row has zero assigned staff (mirrors role + service).
//
// Cross-module sync — `shifts` slice persists via Zustand `persist` to
// localStorage and propagates cross-tab. Staff-form Assign shift dropdown
// + instructor detail Shift hours line read live from the same slice, so
// edits here surface everywhere on the same render cycle.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    DotsVertical, XClose, Check, ChevronLeft,
    Eye, Edit02, Archive, SlashCircle01, RefreshCcw01, Trash01, Trash02,
    UserPlus01, Clock, AlignLeft,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppStore, type Shift, type ShiftAssignment, type Staff } from "@/lib/store";
import { AssignStaffModal } from "@/components/staff/AssignStaffModal";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { ShiftsWeekView } from "@/components/staff/ShiftsWeekView";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Shift["status"], string> = {
    active:   "Active",
    inactive: "Inactive",
    archive:  "Archived",
};

// Local StatusBadge removed — uses canonical `@/components/patterns/StatusBadge`
// with `type="shift"` (palette + labels live in the canonical mapping).

// ─── Enabled toggle (drives active ↔ inactive flip) ────────────────────────

function EnabledToggle({ on, disabled, onChange }: {
    on: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} disabled={disabled}
            onClick={() => !disabled && onChange(!on)}
            className={cn(
                "relative w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0",
                on ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
                disabled && "opacity-60 cursor-not-allowed",
            )}>
            <span className="w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

// ─── Time formatter — "07:00" → "07:00 AM" ─────────────────────────────────

function fmtTime12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${String(hh).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

// ─── Shift days summary (e.g. "Mon - Sat", "Wed, Fri, Sat") ───────────────
//
// Detects contiguous ranges so the demo reads naturally:
//   • All 7 days       → "Every day"
//   • Mon..Sat (6)     → "Mon - Sat"
//   • Mon..Fri (5)     → "Mon - Fri"
//   • Sparse selection → comma-joined ("Wed, Fri, Sat")

function daysSummary(workingDays: boolean[]): string {
    const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const picked = workingDays.flatMap((on, i) => on ? [i] : []);
    if (picked.length === 0) return "—";
    if (picked.length === 7) return "Every day";
    // Detect a single contiguous run (treating Sun..Sat linearly).
    const min = picked[0];
    const max = picked[picked.length - 1];
    const contiguous = picked.length === (max - min + 1);
    if (contiguous && picked.length >= 3) return `${LABELS[min]} - ${LABELS[max]}`;
    return picked.map(i => LABELS[i]).join(", ");
}

// ─── Row expand — Assigned staff · days_of_week (client 2026-07-22) ───────
//
// Renders inside a `<tr><td colSpan={8}>` beneath the parent shift row.
// Shows:
//   • Staffing target — inline number stepper (± controls) so admins can
//     change the "M in N / M needed" without opening the shift form.
//   • Assigned staff table — one row per staff member on this shift, with
//     day-of-week chips (M T W T F S S). Click a chip to toggle that day
//     for THIS staff member on THIS shift (narrows the per-assignment
//     `days_of_week` from the shift's full `working_days`). Trash icon
//     removes the assignment entirely.
//   • Helper line explaining the "default = all shift days, narrow here"
//     rule (client 2026-07-22 mockup copy).

const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_FULL  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function DayChip({ active, disabled, letter, onClick, title }: {
    active: boolean;
    disabled: boolean;
    letter: string;
    onClick: () => void;
    title: string;
}) {
    return (
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            title={title}
            aria-pressed={active}
            aria-label={title}
            className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold transition-colors border-1",
                disabled
                    ? "border-transparent bg-[#f2f4f7] text-[#d0d5dd] cursor-not-allowed"
                    : active
                        ? "border-[#7ba08c] bg-[#e7f2eb] text-[#3b5446]"
                        : "border-[#e4e7ec] bg-white text-[#98a2b3] hover:border-[#aad4bd]",
            )}
        >
            {letter}
        </button>
    );
}

function ShiftExpandBody({
    shift, assignments, staffById,
    onChangeDays, onRemoveAssignment, onChangeTarget,
}: {
    shift: Shift;
    assignments: ShiftAssignment[];
    staffById: Map<string, Staff>;
    onChangeDays: (assignmentId: string, days: boolean[]) => void;
    onRemoveAssignment: (assignmentId: string) => void;
    onChangeTarget: (nextTarget: number) => void;
}) {
    // Sort by staff full name for a stable, scannable order.
    const rows = [...assignments].sort((a, b) => {
        const na = staffById.get(a.staff_id)?.fullName ?? a.staff_id;
        const nb = staffById.get(b.staff_id)?.fullName ?? b.staff_id;
        return na.localeCompare(nb);
    });
    return (
        <div className="flex flex-col gap-3">
            {/* Staffing target stepper */}
            <div className="flex items-center gap-3">
                <p className="text-[12px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3]">Staffing target</p>
                <div className="inline-flex items-center border-1 border-[#e4e7ec] rounded-[8px] bg-white overflow-hidden">
                    <button type="button"
                        onClick={() => onChangeTarget(Math.max(0, (shift.staffing_target ?? 1) - 1))}
                        aria-label="Decrease staffing target"
                        className="w-8 h-8 flex items-center justify-center text-[16px] font-semibold text-[#475467] hover:bg-[#f9fafb] transition-colors">
                        −
                    </button>
                    <span className="w-10 text-center text-[14px] font-semibold text-[#101828] border-x-1 border-[#e4e7ec]">
                        {shift.staffing_target ?? 1}
                    </span>
                    <button type="button"
                        onClick={() => onChangeTarget((shift.staffing_target ?? 1) + 1)}
                        aria-label="Increase staffing target"
                        className="w-8 h-8 flex items-center justify-center text-[16px] font-semibold text-[#475467] hover:bg-[#f9fafb] transition-colors">
                        +
                    </button>
                </div>
                <p className="text-[13px] text-[#667085]">staff needed on this shift</p>
            </div>

            <p className="text-[12px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3]">Assigned staff · days within the shift</p>
            {rows.length === 0 ? (
                <p className="text-[14px] text-[#667085]">No staff assigned yet. Use the row's "Assign staff" action to add one.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {rows.map(a => {
                        const s = staffById.get(a.staff_id);
                        if (!s) return null;
                        return (
                            <div key={a.id} className="flex items-center gap-3 py-1.5">
                                {/* Staff avatar + name — 180px column for a
                                    stable left rail. */}
                                <div className="flex items-center gap-2 w-[180px] shrink-0 min-w-0">
                                    {s.imageUrl ? (
                                        <img src={s.imageUrl} alt={s.fullName}
                                            className="w-7 h-7 rounded-full object-cover" />
                                    ) : (
                                        <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                                            style={{ backgroundColor: s.color }}>
                                            {s.initials}
                                        </div>
                                    )}
                                    <span className="text-[14px] font-medium text-[#101828] truncate">{s.fullName}</span>
                                </div>
                                {/* Day chips — clickable when the parent shift
                                    has that weekday in its working_days;
                                    otherwise disabled so admins can't grant
                                    a Sunday assignment on a Mon-Sat shift. */}
                                <div className="flex items-center gap-1.5 flex-1">
                                    {WEEKDAY_SHORT.map((letter, i) => {
                                        const parentAllowsDay = shift.working_days[i];
                                        const active = parentAllowsDay && a.days_of_week[i];
                                        return (
                                            <DayChip
                                                key={i}
                                                active={active}
                                                disabled={!parentAllowsDay}
                                                letter={letter}
                                                title={parentAllowsDay
                                                    ? `${active ? "Remove" : "Add"} ${WEEKDAY_FULL[i]}`
                                                    : `Shift doesn't cover ${WEEKDAY_FULL[i]}`}
                                                onClick={() => {
                                                    const next = [...a.days_of_week];
                                                    next[i] = !active;
                                                    onChangeDays(a.id, next);
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                                {/* Remove assignment */}
                                <button
                                    type="button"
                                    onClick={() => onRemoveAssignment(a.id)}
                                    aria-label={`Remove ${s.fullName} from ${shift.name}`}
                                    className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[#98a2b3] hover:text-[#b42318] hover:bg-[#fef3f2] transition-colors shrink-0">
                                    <Trash01 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
            <p className="text-[13px] text-[#667085]">
                A staff member's days default to all shift days; narrow them here. Profile "working days" are derived from shift assignments — one source of truth.
            </p>
        </div>
    );
}

// ─── Row action menu ───────────────────────────────────────────────────────

type RowActionKind =
    | "view" | "edit" | "assign_staff"
    | "archive" | "deactivate" | "reactivate" | "recover" | "delete";

// Local RowActions removed — uses canonical `<RowActions items={[...]}>` from
// `@/components/patterns/RowActions`. Items array is built per-row at the
// call site below based on status + hasStaff.

// ─── Confirmation modal ────────────────────────────────────────────────────

const MODAL_CONFIG: Record<RowActionKind, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
    tone: "destructive" | "primary";
}> = {
    view:         {} as never,
    edit:         {} as never,
    assign_staff: {} as never,
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this shift?",
        titleBulk:   n => `Archive ${n} shifts?`,
        description: subject => <>{subject} will be hidden from the default shift list. You can recover archived shifts at any time.</>,
        confirmLabel: "Archive",
        tone: "primary",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this shift?",
        titleBulk:   n => `Deactivate ${n} shifts?`,
        description: (subject, n) => <>{subject} will be marked inactive and won't be assignable to new staff. Existing staff keep their assignment until {n === 1 ? "it's" : "they're"} reassigned.</>,
        confirmLabel: "Deactivate",
        tone: "destructive",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        titleSingle: "Reactivate this shift?",
        titleBulk:   n => `Reactivate ${n} shifts?`,
        description: subject => <>{subject} will become assignable again.</>,
        confirmLabel: "Reactivate",
        tone: "primary",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this shift?",
        titleBulk:   n => `Recover ${n} shifts?`,
        description: subject => <>{subject} will be restored to Active status and become assignable to staff again.</>,
        confirmLabel: "Recover",
        tone: "primary",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        titleSingle: "Delete this shift?",
        titleBulk:   n => `Delete ${n} shifts?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
        tone: "destructive",
    },
};

// Local ActionModal removed — uses canonical `<ConfirmModal>` from
// `@/components/modals/ConfirmModal`, driven by MODAL_CONFIG above.

// ─── Bulk action bar (floating pill) ───────────────────────────────────────

function BulkActionBar({ count, hasArchivable, hasReactivatable, hasRecoverable, hasDeletable, onClear, onAction }: {
    count: number;
    hasArchivable: boolean;
    hasReactivatable: boolean;
    hasRecoverable: boolean;
    hasDeletable: boolean;
    onClear: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                    {count} selected<XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {hasArchivable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Archive className="w-5 h-5 text-[#667085]" />} onClick={() => onAction("archive")}>
                            Archive
                        </Button>
                    )}
                    {hasReactivatable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Check className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("reactivate")}>
                            Reactivate
                        </Button>
                    )}
                    {hasRecoverable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("recover")}>
                            Recover
                        </Button>
                    )}
                    {hasArchivable && (
                        hasDeletable ? (
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("delete")}>
                                Delete
                            </Button>
                        ) : (
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("deactivate")}>
                                Deactivate
                            </Button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Filter side panel — Status pills only (minimum viable) ────────────────

type StatusFilter = Shift["status"][];

function FilterPanel({ open, onClose, applied, onApply }: {
    open: boolean;
    onClose: () => void;
    applied: StatusFilter;
    onApply: (next: StatusFilter) => void;
}) {
    const [pending, setPending] = useState<StatusFilter>([]);
    useEffect(() => { if (open) setPending([...applied]); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);
    function toggle(v: Shift["status"]) {
        setPending(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
    }
    return (
        <SlidePanel open={open} onClose={onClose} width={400} zIndex={50}>
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {(["active", "inactive", "archive"] as const).map(s => (
                                <button key={s} type="button" onClick={() => toggle(s)}
                                    className={cn(
                                        "px-4 py-2 rounded-[8px] text-[14px] font-medium transition-all",
                                        pending.includes(s)
                                            ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                                            : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
                                    )}>
                                    {STATUS_LABEL[s]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={pending.length === 0}
                        onClick={() => { setPending([]); onApply([]); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={pending.length === 0}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Shift avatar — clock glyph in a neutral circle ────────────────────────

function ShiftAvatar() {
    return (
        <div className="w-10 h-10 rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-[#475467]" />
        </div>
    );
}

// ─── Checkbox cell ─────────────────────────────────────────────────────────

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: (next: boolean) => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Table constants ───────────────────────────────────────────────────────


// ─── Main tab component ───────────────────────────────────────────────────

export interface ShiftManagementTabProps {
    /** Used by the parent route to set `returnTo` on every form / detail
     *  link the tab spawns. */
    returnTo: string;
    /** Branch filter from the shared toolbar (Select location dropdown).
     *  Empty string = "All locations". */
    branchId: string;
    /** Search query from the shared toolbar. */
    search: string;
    /** Tells the parent whether the Filter button should render the
     *  green active-dot. */
    onFilterStateChange?: (hasActive: boolean) => void;
    /** Tells the parent the table is mounted so it can enable / wire its
     *  Filter button click handler. */
    filterOpen: boolean;
    onCloseFilter: () => void;
    /** View mode driven by the parent's List / Week SegmentedTabs on the
     *  sub-tab row (client 2026-07-22 lifted from inline). Defaults to
     *  "list" so the tab still renders standalone. */
    viewMode?: "list" | "week";
}

export function ShiftManagementTab({
    returnTo, branchId, search, filterOpen, onCloseFilter, onFilterStateChange,
    viewMode = "list",
}: ShiftManagementTabProps) {
    const router = useRouter();
    const shifts            = useAppStore(s => s.shifts);
    const staff             = useAppStore(s => s.staff);
    // Client 2026-07-22 Phase 3 — many-to-many staff ↔ shift. The
    // assignments slice replaces the old "one shift per staff via
    // Staff.shiftId" model for the list's Staffing column + row expand.
    const shiftAssignments  = useAppStore(s => s.shiftAssignments);
    const updateShiftAssignmentDays = useAppStore(s => s.updateShiftAssignmentDays);
    const removeShiftAssignment     = useAppStore(s => s.removeShiftAssignment);
    const branches          = useAppStore(s => s.branches);
    const setShiftsStatus   = useAppStore(s => s.setShiftsStatus);
    const deleteShifts      = useAppStore(s => s.deleteShifts);
    const updateShift       = useAppStore(s => s.updateShift);
    const showToast         = useAppStore(s => s.showToast);

    const [appliedStatuses, setAppliedStatuses] = useState<StatusFilter>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pendingConfirm, setPendingConfirm] = useState<
        | { mode: "row"; row: Shift; kind: Exclude<RowActionKind, "view" | "edit" | "assign_staff"> }
        | { mode: "bulk"; rows: Shift[]; kind: Exclude<RowActionKind, "view" | "edit" | "assign_staff"> }
        | null
    >(null);
    const [assignTarget, setAssignTarget] = useState<Shift | null>(null);

    // Reset page when filters / search / branch / sub-tab state change so
    // the admin lands on page 1 of the new result set.
    useEffect(() => { setPage(1); }, [branchId, search, appliedStatuses]);

    // Surface the active-filter state up so the toolbar Filter button can
    // render its green dot.
    useEffect(() => {
        onFilterStateChange?.(appliedStatuses.length > 0);
    }, [appliedStatuses, onFilterStateChange]);

    // ── Derived lookups ────────────────────────────────────────────────────
    //
    // `staffCountByShift` used to count off Staff.shiftId (one-shift-
    // per-staff). Client 2026-07-22 Phase 3 replaced that with the
    // many-to-many `shiftAssignments` slice, so the count now walks
    // that array. Falls back to the legacy Staff.shiftId when no
    // assignment slice is present (very old persisted stores that
    // somehow slipped past the v82 migration).
    const staffCountByShift = useMemo(() => {
        const m = new Map<string, number>();
        if (shiftAssignments.length > 0) {
            for (const a of shiftAssignments) m.set(a.shift_id, (m.get(a.shift_id) ?? 0) + 1);
        } else {
            for (const s of staff) {
                if (!s.shiftId) continue;
                m.set(s.shiftId, (m.get(s.shiftId) ?? 0) + 1);
            }
        }
        return m;
    }, [shiftAssignments, staff]);
    /** Assignment rows grouped by shift id — feeds the expand-row's
     *  per-staff day chips. */
    const assignmentsByShift = useMemo(() => {
        const m = new Map<string, typeof shiftAssignments>();
        for (const a of shiftAssignments) {
            const list = m.get(a.shift_id) ?? [];
            list.push(a);
            m.set(a.shift_id, list);
        }
        return m;
    }, [shiftAssignments]);
    const staffById = useMemo(() => new Map(staff.map(s => [s.id, s] as const)), [staff]);
    const branchById = useMemo(() => new Map(branches.map(b => [b.id, b] as const)), [branches]);

    // Client 2026-07-22: click "· details" on a shift name to expand
    // the row and reveal assigned staff + per-staff days.
    const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

    // ── Filter + search ───────────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return shifts.filter(s => {
            if (branchId && s.branch_id !== branchId)                 return false;
            if (appliedStatuses.length && !appliedStatuses.includes(s.status)) return false;
            if (q && !s.name.toLowerCase().includes(q))               return false;
            return true;
        });
    }, [shifts, branchId, search, appliedStatuses]);

    // ── Pagination slice ──────────────────────────────────────────────────
    // ── Shift sort — Name / Branch / Days (count) / Hours (start) /
    //    Staff count / Status. ──
    const SHIFT_STATUS_ORDER: Record<Shift["status"], number> = { active: 0, inactive: 1, archive: 2 };
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<Shift>(filtered, {
        name:   (a, b) => a.name.localeCompare(b.name),
        branch: (a, b) => {
            const an = branchById.get(a.branch_id)?.name ?? "";
            const bn = branchById.get(b.branch_id)?.name ?? "";
            return an.localeCompare(bn);
        },
        days:   (a, b) => a.working_days.filter(Boolean).length - b.working_days.filter(Boolean).length,
        hours:  (a, b) => a.start_time.localeCompare(b.start_time),
        staff:  (a, b) => (staffCountByShift.get(a.id) ?? 0) - (staffCountByShift.get(b.id) ?? 0),
        status: (a, b) => SHIFT_STATUS_ORDER[a.status] - SHIFT_STATUS_ORDER[b.status],
    });

    const totalPages   = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage  = Math.min(Math.max(1, page), totalPages);
    const pagedRows    = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ── Selection — operates over the CURRENT PAGE only, mirroring the
    //    staff table's bulk-select behaviour. ─────────────────────────────
    const allChecked  = pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && pagedRows.some(r => selectedIds.has(r.id));
    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    }
    function toggleAll(check: boolean) {
        const next = new Set(selectedIds);
        if (check) pagedRows.forEach(r => next.add(r.id));
        else       pagedRows.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    function clearSelection() { setSelectedIds(new Set()); }

    const selectedRows = useMemo(
        () => filtered.filter(r => selectedIds.has(r.id)),
        [filtered, selectedIds],
    );
    const hasArchivable    = selectedRows.some(r => r.status !== "archive");
    const hasReactivatable = selectedRows.some(r => r.status === "inactive");
    const hasRecoverable   = selectedRows.some(r => r.status === "archive");
    const hasDeletable     = selectedRows.length > 0 &&
        selectedRows.every(r => r.status === "active" && (staffCountByShift.get(r.id) ?? 0) === 0);

    // ── Row + bulk action plumbing ─────────────────────────────────────────
    function handleRowAction(row: Shift, kind: RowActionKind) {
        if (kind === "view")         return router.push(`/staff/shifts/${row.id}?returnTo=${encodeURIComponent(returnTo)}`);
        if (kind === "edit")         return router.push(`/staff/shifts/${row.id}/edit?returnTo=${encodeURIComponent(returnTo)}`);
        if (kind === "assign_staff") {
            setAssignTarget(row);
            return;
        }
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rows = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "archive":    return selectedRows.filter(r => r.status !== "archive");
                case "recover":    return selectedRows.filter(r => r.status === "archive");
                case "delete":     return selectedRows.filter(r => r.status === "active" && (staffCountByShift.get(r.id) ?? 0) === 0);
                default:           return [];
            }
        })();
        if (rows.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows, kind: kind as Exclude<RowActionKind, "view" | "edit" | "assign_staff"> });
    }
    function performAction() {
        if (!pendingConfirm) return;
        const rows = pendingConfirm.mode === "row" ? [pendingConfirm.row] : pendingConfirm.rows;
        const ids = rows.map(r => r.id);
        const isBulk = pendingConfirm.mode === "bulk";
        const kind = pendingConfirm.kind;

        if (kind === "delete") {
            const result = deleteShifts(ids);
            showToast(
                "Shift deleted",
                isBulk
                    ? `${result.deleted.length} shift${result.deleted.length === 1 ? "" : "s"} deleted.`
                    : `${rows[0].name} has been deleted.`,
                "success", "trash",
            );
        } else {
            const nextStatus: Shift["status"] =
                kind === "archive"    ? "archive"  :
                kind === "deactivate" ? "inactive" :
                                        "active"; // reactivate / recover
            setShiftsStatus(ids, nextStatus);
            const verbPast =
                kind === "archive"    ? "archived"    :
                kind === "deactivate" ? "deactivated" :
                kind === "reactivate" ? "reactivated" :
                                        "recovered";
            const tone: "success" | "error" = kind === "deactivate" ? "error" : "success";
            const icon: "slash" | "archive" | "refresh" | "check" =
                kind === "deactivate" ? "slash"   :
                kind === "archive"    ? "archive" :
                kind === "recover"    ? "refresh" :
                                        "check";
            showToast(
                isBulk
                    ? `${ids.length} shifts ${verbPast}`
                    : `Shift ${verbPast}`,
                isBulk
                    ? `Your selected shifts have been ${verbPast}.`
                    : `${rows[0].name} has been ${verbPast}.`,
                tone, icon,
            );
        }
        clearSelection();
        setPendingConfirm(null);
    }

    // ── Enable toggle handler — routes through the confirm modal so the
    //    admin never accidentally flips a shift (especially OFF, which
    //    breaks every active assignment until re-toggled). Same modal
    //    chrome the row dropdown's Deactivate / Reactivate actions use,
    //    just spawned from the inline toggle. ─────────────────────────────
    function handleEnableToggle(row: Shift, next: boolean) {
        if (row.status === "archive") return; // archived rows can't be toggled
        // next=true → currently inactive, flipping to active → "reactivate"
        // next=false → currently active, flipping to inactive → "deactivate"
        setPendingConfirm({ mode: "row", row, kind: next ? "reactivate" : "deactivate" });
    }

    const isTrulyEmpty = shifts.length === 0;
    const isFilteredEmpty = !isTrulyEmpty && filtered.length === 0;

    return (
        <>
            {viewMode === "week" ? (
                <div className="relative flex flex-col flex-1">
                    <ShiftsWeekView branchId={branchId} search={search} />
                </div>
            ) : (
            /* Table card — wrapped in px-6 so the table edges line up with
               the surrounding tab nav row + the pagination row below,
               matching the staff table's padding model exactly. */
            <div className="relative flex flex-col flex-1">
                {filtered.length === 0 ? (
                    <div className="relative flex-1" style={{ minHeight: 400 }}>
                        <EmptyState
                            title={isTrulyEmpty ? "No shifts yet" : "No shifts found"}
                            subtitle={isTrulyEmpty
                                ? "Add your first shift to start assigning staff."
                                : "Try adjusting your search or filters."}
                            icon={isTrulyEmpty ? Clock : AlignLeft}
                        />
                    </div>
                ) : (
                    <div className="px-6">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[44px]")}>
                                            <CheckboxCell
                                                checked={allChecked}
                                                indeterminate={someChecked}
                                                onChange={toggleAll}
                                                ariaLabel="Select all shifts"
                                            />
                                        </th>
                                        <th className={cn(TH, "w-[220px]")}>
                                            <SortableHeader sortKey="name"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Shift name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[180px]")}>
                                            <SortableHeader sortKey="branch" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Branch location</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="days"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Shift days</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[180px]")}>
                                            <SortableHeader sortKey="hours"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Shift hours</SortableHeader>
                                        </th>
                                        {/* Client 2026-07-22: Staff count column replaced
                                            with a Staffing column ("N / M needed" +
                                            Understaffed pill). Enabled column removed —
                                            client feedback: "one Status control instead
                                            of Status + Enabled." Status column now hosts
                                            the enable/disable toggle inline (see
                                            the row below). */}
                                        <th className={cn(TH, "w-[160px]")}>
                                            <SortableHeader sortKey="staff"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Staffing</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map(s => {
                                    const isSelected = selectedIds.has(s.id);
                                    const assignedCount = staffCountByShift.get(s.id) ?? 0;
                                    // Client 2026-07-22: understaffed = assigned < needed.
                                    const target = s.staffing_target ?? 1;
                                    const isUnderstaffed = assignedCount < target;
                                    const branch = branchById.get(s.branch_id);
                                    const isExpanded = expandedShiftId === s.id;
                                    return (
                                        <React.Fragment key={s.id}>
                                        <tr
                                            className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                            <td className={TD}>
                                                <CheckboxCell
                                                    checked={isSelected}
                                                    onChange={() => toggleOne(s.id)}
                                                    ariaLabel={`Select ${s.name}`}
                                                />
                                            </td>
                                            <td className={TD}>
                                                <div className="flex items-center gap-3">
                                                    <ShiftAvatar />
                                                    <span className="text-[14px] font-medium text-[#101828]">{s.name}</span>
                                                    {/* "· details" toggles the expand
                                                        row below. Client 2026-07-22
                                                        mockup: clicking "· details"
                                                        reveals the per-staff day chips
                                                        for this shift's assignments. */}
                                                    <button type="button"
                                                        onClick={() => setExpandedShiftId(prev => prev === s.id ? null : s.id)}
                                                        className="text-[13px] text-[#658774] hover:text-[#3b5446] underline underline-offset-2 transition-colors">
                                                        · {isExpanded ? "hide" : "details"}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className={cn(TD, "whitespace-nowrap")}>{branch?.name ?? "—"}</td>
                                            <td className={cn(TD, "whitespace-nowrap")}>{daysSummary(s.working_days)}</td>
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                {fmtTime12(s.start_time)} – {fmtTime12(s.end_time)}
                                            </td>
                                            {/* Staffing cell — "N / M needed" + optional
                                                Understaffed pill (amber tone matches
                                                the range-chip color family so both
                                                warnings read as one voice). */}
                                            <td className={cn(TD, "whitespace-nowrap")}>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={cn(
                                                        "text-[14px] font-medium",
                                                        isUnderstaffed ? "text-[#b54708]" : "text-[#101828]",
                                                    )}>
                                                        {assignedCount}
                                                    </span>
                                                    <span className="text-[13px] text-[#667085]">/ {target} needed</span>
                                                    {isUnderstaffed && (
                                                        <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 bg-[#fef4e1] border-[#fecc85] text-[#b54708] whitespace-nowrap">
                                                            Understaffed
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={TD}><StatusBadge type="shift" status={s.status} /></td>
                                            <td className={TD}>
                                                <RowActions items={[
                                                    { label: "View details", icon: Eye, onClick: () => handleRowAction(s, "view") },
                                                    { label: "Edit details", icon: Edit02, onClick: () => handleRowAction(s, "edit"), hidden: s.status !== "active" },
                                                    { label: "Assign staff", icon: UserPlus01, onClick: () => handleRowAction(s, "assign_staff"), hidden: s.status !== "active" },
                                                    { label: "Archive", icon: Archive, onClick: () => handleRowAction(s, "archive"), hidden: s.status === "archive" },
                                                    { label: "Reactivate", icon: Check, onClick: () => handleRowAction(s, "reactivate"), hidden: s.status !== "inactive" },
                                                    { label: "Recover", icon: RefreshCcw01, onClick: () => handleRowAction(s, "recover"), hidden: s.status !== "archive" },
                                                    { label: "Deactivate", icon: SlashCircle01, onClick: () => handleRowAction(s, "deactivate"), danger: true, hidden: !(s.status === "active" && assignedCount > 0) },
                                                    { label: "Delete", icon: Trash01, onClick: () => handleRowAction(s, "delete"), danger: true, hidden: !(s.status === "active" && assignedCount === 0) },
                                                ]} />
                                            </td>
                                        </tr>
                                        {/* Row expand — assigned staff + per-staff
                                            days_of_week chips. Client 2026-07-22
                                            mockup: "days default to all shift days;
                                            narrow them here." Also inlines a
                                            "Staffing target" editor so admins can
                                            change the M in "N / M needed" without
                                            opening the form. */}
                                        {isExpanded && (
                                            <tr className="bg-[#fafbfa]">
                                                <td colSpan={8} className="px-6 py-4">
                                                    <ShiftExpandBody
                                                        shift={s}
                                                        assignments={assignmentsByShift.get(s.id) ?? []}
                                                        staffById={staffById}
                                                        onChangeDays={(assignmentId, days) => updateShiftAssignmentDays(assignmentId, days)}
                                                        onRemoveAssignment={(assignmentId) => removeShiftAssignment(assignmentId)}
                                                        onChangeTarget={(nextTarget) => updateShift(s.id, { staffing_target: Math.max(0, nextTarget) })}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                        </React.Fragment>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Pagination — only rendered when the table has data so
                    the empty state stays uncluttered. Matches the staff
                    table's 24px L/R padding. */}
                {filtered.length > 0 && (
                    <div className="px-6 shrink-0">
                        <Pagination
                            page={clampedPage}
                            total={sortedRows.length}
                            pageSize={pageSize}
                            onPage={setPage}
                            onPageSize={n => { setPageSize(n); setPage(1); }}
                        />
                    </div>
                )}

                <BulkActionBar
                    count={selectedIds.size}
                    hasArchivable={hasArchivable}
                    hasReactivatable={hasReactivatable}
                    hasRecoverable={hasRecoverable}
                    hasDeletable={hasDeletable}
                    onClear={clearSelection}
                    onAction={openBulkConfirm}
                />
            </div>
            )}

            <FilterPanel
                open={filterOpen}
                onClose={onCloseFilter}
                applied={appliedStatuses}
                onApply={setAppliedStatuses}
            />

            {pendingConfirm && (() => {
                const count   = pendingConfirm.mode === "row" ? 1 : pendingConfirm.rows.length;
                const subject = pendingConfirm.mode === "row"
                    ? <span className="font-medium text-[#344054]">{pendingConfirm.row.name}</span>
                    : <><span className="font-medium text-[#344054]">{pendingConfirm.rows.length}</span> selected shifts</>;
                const cfg = MODAL_CONFIG[pendingConfirm.kind];
                const title = count === 1 ? cfg.titleSingle : cfg.titleBulk(count);
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.IconComp}
                        tone={cfg.tone === "destructive" ? "danger" : "success"}
                        title={title}
                        description={cfg.description(subject, count)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={performAction}
                    />
                );
            })()}

            {/* The empty-states already suppress duplicate states; this
                kept here so the parent can know if a filter narrowed
                everything away vs a fresh module. */}
            {void isFilteredEmpty}

            {/* Assign staff modal — reuses the AddCustomerModal chrome from
                the class schedule add-customer flow. Mirrors the same
                search + pick interaction so admins recognise it
                immediately. */}
            {assignTarget && (
                <AssignStaffModal
                    shift={assignTarget}
                    onClose={() => setAssignTarget(null)}
                />
            )}
        </>
    );
}
