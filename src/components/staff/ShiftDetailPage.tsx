"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shift detail (Staff & shift module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the chrome of [RoleDetailPage](RoleDetailPage.tsx) end-to-end so
// detail pages across the Staff & shift route feel like one screen:
//
//   • Header — × close + page title.
//   • Body — px-6 py-6, two-column flex with h-[832px].
//   • Sidebar — w-[320px] white card: DecorativeBanner (package tint) +
//               status badge top-right, then scrollable name/metadata,
//               then divider + "Shift actions" footer.
//   • Right card — flex-1 white card with underline tab "Assigned staffs"
//                  hosting a search + status filter + staff table + bulk
//                  action bar + pagination. Row actions match the main
//                  staff dropdown EXACTLY (View details · Edit details ·
//                  Change role · Archive · Deactivate /
//                  Delete · Reactivate · Recover · Resend invitation).
//
// Cross-module sync: every mutation routes through Zustand store actions
// so the Shift management table, the Staff & shift Staff tab, the
// instructor detail page, and any future schedule grid all stay coherent.

import { useEffect, useMemo, useRef, useState } from "react";
import { useBulkSelectionSignal } from "@/lib/hooks/useBulkSelectionSignal";
import { useRouter } from "next/navigation";
import { openStaffFormPanel } from "@/lib/staff-form-panel";
import {
    XClose, Check, Clock,
    Edit02, Archive, RefreshCcw01, SlashCircle01, Trash01, Trash02,
    UserPlus01, SearchMd, Eye, Send01,
    UserSquare, LogOut01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { Toast } from "@/components/ui/Toast";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DecorativeBanner, BANNER_TINTS } from "@/components/products/DecorativeBanner";
import ChangeRoleModal from "@/components/staff/ChangeRoleModal";
import { AssignStaffModal } from "@/components/staff/AssignStaffModal";
import {
    useAppStore,
    type Shift, type Staff, type StaffStatus, type Role,
} from "@/lib/store";
import { Sliders } from "@/components/icons/Sliders";

// ─── Tokens — status/role badges (lifted from RoleDetailPage) ─────────────

const SHIFT_STATUS_LABEL: Record<Shift["status"], string> = {
    active: "Active", inactive: "Inactive", archive: "Archive",
};
const SHIFT_STATUS_BADGE: Record<Shift["status"], string> = {
    active:   "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    inactive: "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
    archive:  "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
};

const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
    pending: "Pending", active: "Active", inactive: "Inactive", archive: "Archive",
};
const STAFF_STATUS_BADGE: Record<StaffStatus, string> = {
    pending:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    active:   "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    inactive: "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
    archive:  "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
};

const ROLE_TYPE_BADGE: Record<Role["type"], string> = {
    owner:        "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    branch_admin: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    operator:     "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    front_desk:   "bg-[#fdf2fa] border-1 border-[#fcceee] text-[#c11574]",
    instructor:   "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    attendees:    "bg-[#ecfeff] border-1 border-[#a5f0fc] text-[#0e7090]",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${String(hh).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function daysSummary(workingDays: boolean[]): string {
    const picked = workingDays.flatMap((on, i) => on ? [i] : []);
    if (picked.length === 0) return "—";
    if (picked.length === 7) return "Every day";
    const min = picked[0];
    const max = picked[picked.length - 1];
    const contiguous = picked.length === (max - min + 1);
    if (contiguous && picked.length >= 3) return `${DAY_LABELS[min]} - ${DAY_LABELS[max]}`;
    return picked.map(i => DAY_LABELS[i]).join(", ");
}

// ─── Confirm modal (shared chrome) ────────────────────────────────────────

type ConfirmKind = "archive" | "recover" | "deactivate" | "reactivate" | "delete" | "remove_from_shift";
type ConfirmTone = "danger" | "success" | "warning" | "info";

const CONFIRM_CFG: Record<ConfirmKind, {
    title: (s: string) => string;
    description: string;
    confirmLabel: string;
    tone: ConfirmTone;
    Icon: React.ComponentType<{ className?: string }>;
}> = {
    archive: {
        title: s => `Archive ${s}?`,
        description: "Archived records are hidden from the default lists but kept for audit. You can recover later.",
        confirmLabel: "Archive", tone: "success", Icon: Archive,
    },
    recover: {
        title: s => `Recover ${s}?`,
        description: "The record returns to Active and becomes assignable again.",
        confirmLabel: "Recover", tone: "success", Icon: RefreshCcw01,
    },
    deactivate: {
        title: s => `Deactivate ${s}?`,
        description: "The record is disabled but kept for historical reference. You can reactivate later.",
        confirmLabel: "Deactivate", tone: "danger", Icon: SlashCircle01,
    },
    reactivate: {
        title: s => `Reactivate ${s}?`,
        description: "The record returns to Active and becomes assignable again.",
        confirmLabel: "Reactivate", tone: "success", Icon: Check,
    },
    delete: {
        title: s => `Delete ${s}?`,
        description: "This permanently removes the record. Only allowed when no history is attached.",
        confirmLabel: "Delete", tone: "danger", Icon: Trash01,
    },
    // Restored local update 2026-08-08 — dropped in the insights merge.
    remove_from_shift: {
        title: s => `Remove ${s} from this shift?`,
        description: "This removes them from THIS shift only — any other shifts they're assigned to are kept. You can re-assign them anytime.",
        confirmLabel: "Remove", tone: "warning", Icon: LogOut01,
    },
};

// ─── Sidebar action button ────────────────────────────────────────────────

function ActionBtn({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] transition-colors text-left",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[var(--colors-text-tertiary)] hover:text-[var(--colors-text-secondary)]",
            )}>
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

// ─── Status filter dropdown ───────────────────────────────────────────────

type StaffStatusFilter = StaffStatus | null;
const STATUS_FILTER_OPTIONS: { value: StaffStatus; label: string }[] = [
    { value: "active",   label: "Active" },
    { value: "pending",  label: "Pending" },
    { value: "inactive", label: "Inactive" },
    { value: "archive",  label: "Archive" },
];

function StatusFilterDropdown({ value, onChange }: {
    value: StaffStatusFilter; onChange: (next: StaffStatusFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <IconTooltip label="Filter" disabled={open}>
                <Button variant="secondary-gray" size="icon" aria-label="Filter"
                    onClick={() => setOpen(p => !p)}>
                    <span className="relative inline-flex">
                        <Sliders className="w-5 h-5" />
                        {value !== null && (
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" aria-hidden />
                        )}
                    </span>
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-2 min-w-[160px]">
                    {STATUS_FILTER_OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(value === opt.value ? null : opt.value); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center justify-between text-left px-5 py-3 text-[15px] font-medium transition-colors",
                                value === opt.value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                            )}>
                            {opt.label}
                            {value === opt.value && <Check className="w-4 h-4 text-[var(--colors-secondary-600)]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: (next: boolean) => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)] text-white"
                    : "bg-white border-[var(--colors-border-primary)] hover:border-[var(--colors-secondary-500)]"
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" /> : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

function StaffAvatar({ staff }: { staff: Staff }) {
    if (staff.imageUrl) {
        return <img src={staff.imageUrl} alt={staff.fullName} className="w-10 h-10 rounded-full object-cover shrink-0" />;
    }
    return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-[14px] shrink-0"
            style={{ backgroundColor: staff.color }}>
            {staff.initials}
        </div>
    );
}

// ─── Row action kinds — matches the Staff & shift table dropdown for the
//                       assigned-staff context. ─────

type StaffRowAction =
    | "view" | "edit_details" | "change_role" | "remove_from_shift"
    | "resend_invite" | "archive" | "recover" | "deactivate" | "reactivate" | "delete";

// Local PaginationFooter removed — uses canonical `@/components/ui/Pagination`
// with `variant="compact"` + `pageSizeOptions={[10, 20, 50]}`.

// ─── Tab button ───────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-3 pb-3 -mb-px text-[14px] font-semibold transition-colors border-b-2",
                active ? "border-[var(--colors-secondary-600)] text-[var(--colors-text-primary)]" : "border-transparent text-[var(--colors-text-quaternary)] hover:text-[var(--colors-text-secondary)]",
            )}>
            {label}
        </button>
    );
}

// ─── Assigned staffs tab body ─────────────────────────────────────────────

type BulkKind = "archive" | "deactivate" | "reactivate" | "recover" | "delete";

function AssignedStaffsTab({ shift, returnTo, onChangeRoleFor }: {
    shift: Shift;
    /** The Shift-detail page's own returnTo (the Shift sub-tab), preserved so
     *  a staff page opened from the roster returns here and then back to the
     *  Shift tab — not the Staff tab. */
    returnTo: string;
    onChangeRoleFor: (s: Staff) => void;
}) {
    const router = useRouter();
    const allStaff           = useAppStore(s => s.staff);
    const branches           = useAppStore(s => s.branches);
    const roles              = useAppStore(s => s.roles);
    const setStaffStatus     = useAppStore(s => s.setStaffStatus);
    const deleteStaffAction  = useAppStore(s => s.deleteStaff);
    const canDeleteStaff     = useAppStore(s => s.canDeleteStaff);
    const resendStaffInvite  = useAppStore(s => s.resendStaffInvite);
    const removeShiftAssignment = useAppStore(s => s.removeShiftAssignment);
    const updateStaff        = useAppStore(s => s.updateStaff);
    const showToast          = useAppStore(s => s.showToast);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pending, setPending] = useState<{ kind: ConfirmKind; row: Staff } | null>(null);
    const [bulkPending, setBulkPending] = useState<BulkKind | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    useBulkSelectionSignal(selectedIds.size > 0);

    // Audit fix 2026-07-22 — blend M2M shiftAssignments with the legacy
    // shiftId so a staff whose PRIMARY shift is elsewhere but who ALSO
    // holds an M2M assignment for this shift still shows in the roster.
    const shiftAssignmentsSlice = useAppStore(s => s.shiftAssignments);
    const scoped = useMemo(() => {
        const m2mStaffIds = new Set(
            shiftAssignmentsSlice.filter(a => a.shift_id === shift.id).map(a => a.staff_id),
        );
        return allStaff.filter(s => s.shiftId === shift.id || m2mStaffIds.has(s.id));
    }, [allStaff, shiftAssignmentsSlice, shift.id]);
    const searched = useMemo(() => {
        const q = search.trim().toLowerCase();
        return scoped.filter(s => {
            if (statusFilter !== null && s.status !== statusFilter) return false;
            if (q && !s.fullName.toLowerCase().includes(q)
                  && !s.email.toLowerCase().includes(q)
                  && !s.phone.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [scoped, search, statusFilter]);

    const STATUS_ORDER: Record<StaffStatus, number> = { active: 0, pending: 1, inactive: 2, archive: 3 };
    const { sorted: filtered, sortKey, sortDir, toggle: toggleSort } = useSort<Staff>(searched, {
        name:   (a, b) => a.fullName.localeCompare(b.fullName),
        branch: (a, b) => {
            const an = a.branchId === null ? "All locations" : branches.find(x => x.id === a.branchId)?.name ?? "";
            const bn = b.branchId === null ? "All locations" : branches.find(x => x.id === b.branchId)?.name ?? "";
            return an.localeCompare(bn);
        },
        status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    });

    useEffect(() => { setPage(1); }, [search, statusFilter, shift.id]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = filtered.slice((clamped - 1) * pageSize, clamped * pageSize);
    const pageIds = pageRows.map(r => r.id);
    const allChecked  = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const someChecked = !allChecked && pageIds.some(id => selectedIds.has(id));

    function toggleAllOnPage(next: boolean) {
        setSelectedIds(prev => {
            const out = new Set(prev);
            if (next) pageIds.forEach(id => out.add(id));
            else      pageIds.forEach(id => out.delete(id));
            return out;
        });
    }
    function toggleOne(id: string) {
        setSelectedIds(prev => {
            const out = new Set(prev);
            if (out.has(id)) out.delete(id); else out.add(id);
            return out;
        });
    }
    function clearSelection() { setSelectedIds(new Set()); }
    function hasHistory(s: Staff): boolean { return !canDeleteStaff(s.id); }

    function handleAction(s: Staff, kind: StaffRowAction) {
        // Back target = THIS shift detail, carrying its own returnTo so the
        // chain lands on the Shift sub-tab (not the Staff tab).
        const back = encodeURIComponent(`/staff/shifts/${shift.id}?returnTo=${encodeURIComponent(returnTo)}`);
        if (kind === "view")          return router.push(`/staff/members/${s.id}?returnTo=${back}`);
        if (kind === "edit_details")  return openStaffFormPanel({ kind: "staff", mode: "edit", id: s.id });
        if (kind === "change_role")   return onChangeRoleFor(s);
        if (kind === "resend_invite") {
            const ok = resendStaffInvite(s.id);
            if (ok) showToast("Invitation sent", `Invite resent to ${s.email}.`, "success", "check");
            else    showToast("Cannot resend", "This staff member has already signed in.", "error");
            return;
        }
        setPending({ kind, row: s });
    }
    function performConfirm(p: NonNullable<typeof pending>) {
        const { kind, row } = p;
        const subject = `"${row.fullName}"`;
        if (kind === "delete") {
            const { deleted, blocked } = deleteStaffAction([row.id]);
            if (deleted.length > 0) showToast("Staff deleted", `${subject} permanently removed.`, "success", "trash");
            else if (blocked.length > 0) showToast("Cannot delete", "Staff has historical records — archive instead.", "error");
        } else if (kind === "archive") {
            setStaffStatus([row.id], "archive");
            showToast("Staff archived", `${subject} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setStaffStatus([row.id], "active");
            showToast("Staff recovered", `${subject} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            setStaffStatus([row.id], "inactive");
            showToast("Staff deactivated", `${subject} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setStaffStatus([row.id], "active");
            showToast("Staff reactivated", `${subject} restored to Active.`, "success", "check");
        } else if (kind === "remove_from_shift") {
            // Remove the link to THIS shift only — every other shift the staffer
            // holds stays intact. An M2M assignment row is removed directly; a
            // staffer linked ONLY via the legacy primary shiftId gets it cleared.
            const assignment = shiftAssignmentsSlice.find(
                a => a.staff_id === row.id && a.shift_id === shift.id,
            );
            if (assignment) removeShiftAssignment(assignment.id);
            else if (row.shiftId === shift.id) updateStaff(row.id, { shiftId: undefined });
            showToast("Removed from shift", `${subject} removed from ${shift.name}.`, "success", "check");
        }
        setPending(null);
    }

    const selectedRows = useMemo(() => scoped.filter(s => selectedIds.has(s.id)), [scoped, selectedIds]);
    const selectionCount = selectedRows.length;
    const hasArchivable    = selectedRows.some(s => s.status !== "archive");
    const hasReactivatable = selectedRows.some(s => s.status === "inactive");
    const hasRecoverable   = selectedRows.some(s => s.status === "archive");
    const allDeletable     = selectionCount > 0 && selectedRows.every(s => !hasHistory(s) && s.status !== "archive");

    function performBulk(kind: BulkKind) {
        if (selectionCount === 0) return;
        const ids = selectedRows.map(s => s.id);
        if (kind === "archive") {
            setStaffStatus(ids, "archive");
            showToast("Staff archived", `${selectionCount} staff moved to archive.`, "success", "archive");
        } else if (kind === "deactivate") {
            setStaffStatus(ids, "inactive");
            showToast("Staff deactivated", `${selectionCount} staff disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setStaffStatus(ids, "active");
            showToast("Staff reactivated", `${selectionCount} staff restored to Active.`, "success", "check");
        } else if (kind === "recover") {
            setStaffStatus(ids, "active");
            showToast("Staff recovered", `${selectionCount} staff restored to Active.`, "success", "refresh");
        } else if (kind === "delete") {
            const { deleted, blocked } = deleteStaffAction(ids);
            if (deleted.length > 0) showToast("Staff deleted", `${deleted.length} staff permanently removed.`, "success", "trash");
            if (blocked.length > 0) showToast("Some skipped", `${blocked.length} had history — archive them instead.`, "error");
        }
        setSelectedIds(new Set());
        setBulkPending(null);
    }

    return (
        <div className="px-6 pb-6 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="flex flex-col">
                    <p className="text-[14px] text-[var(--colors-text-quaternary)]">Total</p>
                    <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">
                        {scoped.length} {scoped.length === 1 ? "staff" : "staff"}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <ToolbarSearch value={search} onChange={setSearch} placeholder="Search staff..." />
                    <StatusFilterDropdown value={statusFilter} onChange={setStatusFilter} />
                </div>
            </div>

            {scoped.length === 0 ? (
                <div className="relative" style={{ minHeight: 320 }}>
                    <EmptyState
                        title="No staff assigned yet"
                        subtitle="Use Assign staff on the left to add staff to this shift."
                    />
                </div>
            ) : filtered.length === 0 ? (
                <div className="relative" style={{ minHeight: 320 }}>
                    <EmptyState
                        title="No matches"
                        subtitle="Try a different search or clear the status filter."
                    />
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[44px]")}>
                                        <CheckboxCell
                                            checked={allChecked}
                                            indeterminate={someChecked}
                                            onChange={toggleAllOnPage}
                                            ariaLabel="Select all staff"
                                        />
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableHeader>
                                    </th>
                                    <th className={TH}>Role</th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="branch" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Branch location</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[52px]")} />
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map(s => {
                                    const isSelected = selectedIds.has(s.id);
                                    const role = roles.find(r => r.id === s.roleId);
                                    const branchLabel = s.branchId === null
                                        ? "All locations"
                                        : branches.find(b => b.id === s.branchId)?.name ?? "—";
                                    return (
                                        <tr key={s.id}
                                            className={cn("transition-colors", isSelected ? "bg-[var(--colors-bg-secondary)]" : "hover:bg-[var(--colors-bg-secondary)]")}>
                                            <td className={TD}>
                                                <CheckboxCell checked={isSelected} onChange={() => toggleOne(s.id)} ariaLabel={`Select ${s.fullName}`} />
                                            </td>
                                            <td className={TD}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <StaffAvatar staff={s} />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[14px] font-medium text-[var(--colors-text-primary)] truncate">{s.fullName}</span>
                                                        <span className="text-[13px] text-[var(--colors-text-quaternary)] truncate">{s.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={TD}>
                                                {role ? (
                                                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", ROLE_TYPE_BADGE[role.type])}>
                                                        {role.name}
                                                    </span>
                                                ) : <span className="text-[var(--colors-text-quaternary)]">—</span>}
                                            </td>
                                            <td className={cn(TD, "text-[var(--colors-text-tertiary)] whitespace-nowrap")}>{branchLabel}</td>
                                            <td className={TD}>
                                                <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", STAFF_STATUS_BADGE[s.status])}>
                                                    {STAFF_STATUS_LABEL[s.status]}
                                                </span>
                                            </td>
                                            <td className={TD}>
                                                <RowActions
                                                    items={[
                                                        { label: "View details",      icon: Eye,           onClick: () => handleAction(s, "view") },
                                                        { label: "Resend invitation", icon: Send01,        onClick: () => handleAction(s, "resend_invite"), hidden: s.status !== "pending" },
                                                        { label: "Edit details",      icon: Edit02,        onClick: () => handleAction(s, "edit_details"),  hidden: s.status !== "active" },
                                                        { label: "Change role",       icon: UserSquare,    onClick: () => handleAction(s, "change_role"),   hidden: s.status !== "active" },
                                                        { label: "Remove from shift", icon: LogOut01,      onClick: () => handleAction(s, "remove_from_shift"), hidden: s.status !== "active" },
                                                        { label: "Archive",           icon: Archive,       onClick: () => handleAction(s, "archive"),       hidden: !(s.status === "active" || s.status === "inactive") },
                                                        { label: "Reactivate",        icon: Check,         onClick: () => handleAction(s, "reactivate"),    hidden: s.status !== "inactive" },
                                                        { label: "Recover",           icon: RefreshCcw01,  onClick: () => handleAction(s, "recover"),       hidden: s.status !== "archive" },
                                                        { label: "Deactivate",        icon: SlashCircle01, onClick: () => handleAction(s, "deactivate"),    hidden: s.status !== "active", danger: true },
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        variant="compact"
                        pageSizeOptions={[10, 20, 50]}
                        page={clamped}
                        total={filtered.length}
                        pageSize={pageSize}
                        onPage={setPage}
                        onPageSize={n => { setPageSize(n); setPage(1); }}
                    />
                </>
            )}

            {pending && (() => {
                const cfg = CONFIRM_CFG[pending.kind];
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPending(null)}
                        icon={cfg.Icon}
                        tone={cfg.tone}
                        title={cfg.title(`"${pending.row.fullName}"`)}
                        description={cfg.description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performConfirm(pending)}
                    />
                );
            })()}
            {bulkPending && (() => {
                const cfg = CONFIRM_CFG[bulkPending];
                const subject = `${selectionCount} ${selectionCount === 1 ? "staff" : "staff"}`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setBulkPending(null)}
                        icon={cfg.Icon}
                        tone={cfg.tone}
                        title={cfg.title(subject)}
                        description={cfg.description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performBulk(bulkPending)}
                    />
                );
            })()}

            {/* Floating bulk-action bar */}
            {selectionCount > 0 && (
                <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
                    <div className="pointer-events-auto bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-fit max-w-full">
                        <button type="button" onClick={clearSelection}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] font-medium text-[var(--colors-text-primary)] hover:bg-[var(--colors-bg-secondary)] transition-colors whitespace-nowrap shrink-0">
                            {selectionCount} selected
                            <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                        </button>
                        <div className="flex items-center gap-3">
                            {hasArchivable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Archive className="w-5 h-5 text-[var(--colors-text-quaternary)]" />}
                                    onClick={() => setBulkPending("archive")}>
                                    Archive
                                </Button>
                            )}
                            {hasReactivatable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Check className="w-5 h-5 text-[#164e52]" />}
                                    onClick={() => setBulkPending("reactivate")}>
                                    Reactivate
                                </Button>
                            )}
                            {hasRecoverable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#164e52]" />}
                                    onClick={() => setBulkPending("recover")}>
                                    Recover
                                </Button>
                            )}
                            {hasArchivable && (
                                allDeletable ? (
                                    <Button variant="secondary-gray" size="sm"
                                        className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                        leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                        onClick={() => setBulkPending("delete")}>
                                        Delete
                                    </Button>
                                ) : (
                                    <Button variant="secondary-gray" size="sm"
                                        className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                        leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                                        onClick={() => setBulkPending("deactivate")}>
                                        Deactivate
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────

function Sidebar({ shift, totalStaffs, branchName, onAction }: {
    shift: Shift;
    totalStaffs: number;
    branchName: string;
    onAction: (kind: "assign_staff" | "edit_details" | ConfirmKind) => void;
}) {
    const isActive   = shift.status === "active";
    const isInactive = shift.status === "inactive";
    const isArchive  = shift.status === "archive";

    return (
        <aside className="w-[320px] shrink-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
            <div className="relative shrink-0">
                <DecorativeBanner bannerHeight={156} iconBox={72} icon={Clock} {...BANNER_TINTS.package} />
                <div className="absolute top-3 right-3">
                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", SHIFT_STATUS_BADGE[shift.status])}>
                        {SHIFT_STATUS_LABEL[shift.status]}
                    </span>
                </div>
            </div>

            <div className="flex flex-col flex-1">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <div className="flex flex-col gap-1">
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)] break-words">
                            {shift.name}
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[var(--colors-text-quaternary)]">Branch location</p>
                            <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{branchName}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[var(--colors-text-quaternary)]">Shift days</p>
                            <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{daysSummary(shift.working_days)}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[var(--colors-text-quaternary)]">Shift hours</p>
                            <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">
                                {fmtTime12(shift.start_time)} – {fmtTime12(shift.end_time)}
                            </p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[var(--colors-text-quaternary)]">Staff</p>
                            <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{totalStaffs}</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-6 mt-auto">
                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)] mb-5" />
                    <p className="text-[14px] text-[var(--colors-text-quaternary)] mb-4">Shift actions</p>
                    <div className="flex flex-col gap-4">
                        {isActive && (
                            <>
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit shift" onClick={() => onAction("edit_details")} />
                                <ActionBtn icon={<UserPlus01 className="w-5 h-5" />} label="Assign staff" onClick={() => onAction("assign_staff")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive shift" onClick={() => onAction("archive")} />
                                {/* Deactivate stays as the soft option while staff are assigned;
                                    Delete is always available and cascades (unassigns staff). */}
                                {totalStaffs > 0 && (
                                    <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate shift" danger onClick={() => onAction("deactivate")} />
                                )}
                                <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete shift" danger onClick={() => onAction("delete")} />
                            </>
                        )}
                        {isInactive && (
                            <>
                                <ActionBtn icon={<Check className="w-5 h-5" />} label="Reactivate shift" onClick={() => onAction("reactivate")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive shift" onClick={() => onAction("archive")} />
                                <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete shift" danger onClick={() => onAction("delete")} />
                            </>
                        )}
                        {isArchive && (
                            <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover shift" onClick={() => onAction("recover")} />
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}

// ─── Top-level page ───────────────────────────────────────────────────────

export interface ShiftDetailPageProps {
    shiftId: string;
    returnTo?: string;
}

export default function ShiftDetailPage({ shiftId, returnTo = "/admin/staff" }: ShiftDetailPageProps) {
    const router = useRouter();
    const shifts          = useAppStore(s => s.shifts);
    const staff           = useAppStore(s => s.staff);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    const branches        = useAppStore(s => s.branches);
    const setShiftsStatus = useAppStore(s => s.setShiftsStatus);
    const deleteShifts    = useAppStore(s => s.deleteShifts);
    const showToast       = useAppStore(s => s.showToast);

    const shift = shifts.find(s => s.id === shiftId);
    const branch = useMemo(() => shift ? branches.find(b => b.id === shift.branch_id) : undefined, [shift?.branch_id, branches]);
    // Audit fix 2026-07-22 — count via UNION of legacy shiftId + M2M
    // so multi-shift staff aren't undercounted.
    const totalStaffs = useMemo(() => {
        if (!shift) return 0;
        const ids = new Set<string>();
        for (const s of staff) if (s.shiftId === shift.id) ids.add(s.id);
        for (const a of shiftAssignments) if (a.shift_id === shift.id) ids.add(a.staff_id);
        return ids.size;
    }, [staff, shiftAssignments, shift?.id]);

    const [sidebarConfirm, setSidebarConfirm] = useState<ConfirmKind | null>(null);
    const [showAssign, setShowAssign] = useState(false);
    const [changingRoleFor, setChangingRoleFor] = useState<Staff | null>(null);

    useEffect(() => {
        if (!shift && shifts.length > 0) {
            showToast("Shift not found", "Returned to the staff list.", "error");
            router.push(returnTo);
        }
    }, [shift, shifts.length, router, returnTo, showToast]);

    if (!shift) {
        return (
            <div className="h-screen bg-white flex flex-col">
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button type="button" onClick={() => router.push(returnTo)}
                        aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">Shift details</h1>
                </div>
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="relative w-full max-w-[480px]" style={{ minHeight: 320 }}>
                        <EmptyState title="Loading…" subtitle="Fetching shift details." />
                    </div>
                </div>
                <Toast />
            </div>
        );
    }

    function handleSidebarAction(kind: "assign_staff" | "edit_details" | ConfirmKind) {
        if (kind === "assign_staff") return setShowAssign(true);
        if (kind === "edit_details") {
            // Edit shift → back returns to THIS detail page, which itself keeps
            // its returnTo so the whole chain lands back on the Shift sub-tab.
            const selfUrl = `/staff/shifts/${shift!.id}?returnTo=${encodeURIComponent(returnTo)}`;
            return openStaffFormPanel({ kind: "shift", mode: "edit", id: shift!.id });
        }
        setSidebarConfirm(kind);
    }
    function performSidebarConfirm(kind: ConfirmKind) {
        if (!shift) return;
        const subject = `"${shift.name}"`;
        if (kind === "archive") {
            setShiftsStatus([shift.id], "archive");
            showToast("Shift archived", `${subject} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setShiftsStatus([shift.id], "active");
            showToast("Shift recovered", `${subject} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            setShiftsStatus([shift.id], "inactive");
            showToast("Shift deactivated", `${subject} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setShiftsStatus([shift.id], "active");
            showToast("Shift reactivated", `${subject} restored to Active.`, "success", "check");
        } else if (kind === "delete") {
            const { deleted, blocked } = deleteShifts([shift.id]);
            if (deleted.length > 0) {
                showToast("Shift deleted", `${subject} permanently removed.`, "success", "trash");
                setSidebarConfirm(null);
                router.push(returnTo);
                return;
            }
            if (blocked.length > 0) {
                showToast("Cannot delete", "Shift has staff assigned — reassign first.", "error");
            }
        }
        setSidebarConfirm(null);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">Shift details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            <DetailPageShell
                sidebar={
                    <Sidebar
                        shift={shift}
                        totalStaffs={totalStaffs}
                        branchName={branch?.name ?? "—"}
                        onAction={handleSidebarAction}
                    />
                }
                main={
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[var(--colors-border-secondary)] rounded-[20px]">
                        <div className="shrink-0 border-b border-[var(--colors-border-secondary)] px-6 pt-6">
                            <div className="flex gap-1">
                                <TabBtn label="Assigned staffs" active onClick={() => {}} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                            <AssignedStaffsTab
                                shift={shift}
                                returnTo={returnTo}
                                onChangeRoleFor={setChangingRoleFor}
                            />
                        </div>
                    </div>
                }
            />

            {sidebarConfirm && (() => {
                const cfg = CONFIRM_CFG[sidebarConfirm];
                return (
                    <ConfirmModal
                        open
                        onClose={() => setSidebarConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.tone}
                        title={cfg.title(`"${shift.name}"`)}
                        description={cfg.description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performSidebarConfirm(sidebarConfirm)}
                    />
                );
            })()}

            {showAssign && (
                <AssignStaffModal shift={shift} onClose={() => setShowAssign(false)} />
            )}

            {changingRoleFor && (
                <ChangeRoleModal
                    staff={changingRoleFor}
                    onCancel={() => setChangingRoleFor(null)}
                    onConfirmed={newRoleName => {
                        showToast("Role updated", `${changingRoleFor.fullName} is now ${newRoleName}.`, "success", "check");
                        setChangingRoleFor(null);
                    }}
                />
            )}


            <Toast />
        </div>
    );
}
