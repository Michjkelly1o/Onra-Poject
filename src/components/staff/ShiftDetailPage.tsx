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
//                  Change role · Change shift · Archive · Deactivate /
//                  Delete · Reactivate · Recover · Resend invitation).
//
// Cross-module sync: every mutation routes through Zustand store actions
// so the Shift management table, the Staff & shift Staff tab, the
// instructor detail page, and any future schedule grid all stay coherent.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    XClose, Check, Clock,
    Edit02, Archive, RefreshCcw01, SlashCircle01, Trash01, Trash02,
    UserPlus01, SearchMd, FilterLines, Eye, Send01,
    UserSquare,
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

// ─── Tokens — status/role badges (lifted from RoleDetailPage) ─────────────

const SHIFT_STATUS_LABEL: Record<Shift["status"], string> = {
    active: "Active", inactive: "Inactive", archive: "Archive",
};
const SHIFT_STATUS_BADGE: Record<Shift["status"], string> = {
    active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    archive:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
    pending: "Pending", active: "Active", inactive: "Inactive", archive: "Archive",
};
const STAFF_STATUS_BADGE: Record<StaffStatus, string> = {
    pending:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    archive:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

const ROLE_TYPE_BADGE: Record<Role["type"], string> = {
    owner:        "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    branch_admin: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    operator:     "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    front_desk:   "bg-[#fdf2fa] border-1 border-[#fcceee] text-[#c11574]",
    instructor:   "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
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

type ConfirmKind = "archive" | "recover" | "deactivate" | "reactivate" | "delete";
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
};

// ─── Sidebar action button ────────────────────────────────────────────────

function ActionBtn({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] transition-colors text-left",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[#475467] hover:text-[#344054]",
            )}>
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

// ─── Change shift modal ───────────────────────────────────────────────────

function ChangeShiftModal({ staffMember, onClose, onConfirmed }: {
    staffMember: Staff;
    onClose: () => void;
    onConfirmed: (nextShift: Shift | null) => void;
}) {
    const shifts      = useAppStore(s => s.shifts);
    const updateStaff = useAppStore(s => s.updateStaff);

    const [picked, setPicked] = useState<string>(staffMember.shiftId ?? "");

    const options = shifts.filter(s => s.status === "active" && s.branch_id === staffMember.branchId);

    function handleSave() {
        updateStaff(staffMember.id, { shiftId: picked === "" ? undefined : picked });
        const nextShift = picked ? shifts.find(s => s.id === picked) ?? null : null;
        onConfirmed(nextShift);
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[480px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="px-6 pt-6 pb-2">
                    <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Change shift</h3>
                    <p className="text-[14px] text-[#475467] mt-1">
                        Pick a new shift for <span className="font-medium text-[#344054]">{staffMember.fullName}</span>.
                    </p>
                </div>
                <div className="px-6 py-4 max-h-[360px] overflow-y-auto flex flex-col gap-2">
                    <button type="button" onClick={() => setPicked("")}
                        className={cn(
                            "flex items-center justify-between gap-3 px-4 py-3 rounded-[8px] border-1 text-left transition-colors",
                            picked === ""
                                ? "border-[#7ba08c] bg-[#f5fffa]"
                                : "border-[#e4e7ec] hover:bg-[#f9fafb]",
                        )}>
                        <div className="flex flex-col">
                            <span className="text-[14px] font-medium text-[#101828]">No shift</span>
                            <span className="text-[13px] text-[#667085]">Remove from current shift</span>
                        </div>
                        {picked === "" && <Check className="w-4 h-4 text-[#658774]" />}
                    </button>
                    {options.length === 0 ? (
                        <p className="text-[14px] text-[#667085] text-center py-4">
                            No other active shifts at this branch yet.
                        </p>
                    ) : options.map(s => (
                        <button key={s.id} type="button" onClick={() => setPicked(s.id)}
                            className={cn(
                                "flex items-center justify-between gap-3 px-4 py-3 rounded-[8px] border-1 text-left transition-colors",
                                picked === s.id
                                    ? "border-[#7ba08c] bg-[#f5fffa]"
                                    : "border-[#e4e7ec] hover:bg-[#f9fafb]",
                            )}>
                            <div className="flex flex-col">
                                <span className="text-[14px] font-medium text-[#101828]">{s.name}</span>
                                <span className="text-[13px] text-[#667085]">
                                    {daysSummary(s.working_days)} · {fmtTime12(s.start_time)} – {fmtTime12(s.end_time)}
                                </span>
                            </div>
                            {picked === s.id && <Check className="w-4 h-4 text-[#658774]" />}
                        </button>
                    ))}
                </div>
                <div className="flex gap-3 px-6 pt-2 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1"
                        disabled={picked === (staffMember.shiftId ?? "")}
                        onClick={handleSave}>
                        Save
                    </Button>
                </div>
            </div>
        </div>
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
                        <FilterLines className="w-4 h-4" />
                        {value !== null && (
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" aria-hidden />
                        )}
                    </span>
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-2 min-w-[160px]">
                    {STATUS_FILTER_OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(value === opt.value ? null : opt.value); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center justify-between text-left px-5 py-3 text-[15px] font-medium transition-colors",
                                value === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {opt.label}
                            {value === opt.value && <Check className="w-4 h-4 text-[#658774]" />}
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
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]"
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

// ─── Row action kinds — matches the Staff & shift table dropdown + adds
//                       `change_shift` for the assigned-staff context. ─────

type StaffRowAction =
    | "view" | "edit_details" | "change_role" | "change_shift"
    | "resend_invite" | "archive" | "recover" | "deactivate" | "reactivate" | "delete";

// Local PaginationFooter removed — uses canonical `@/components/ui/Pagination`
// with `variant="compact"` + `pageSizeOptions={[10, 20, 50]}`.

// ─── Tab button ───────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-3 pb-3 -mb-px text-[14px] font-semibold transition-colors border-b-2",
                active ? "border-[#658774] text-[#101828]" : "border-transparent text-[#667085] hover:text-[#344054]",
            )}>
            {label}
        </button>
    );
}

// ─── Assigned staffs tab body ─────────────────────────────────────────────

type BulkKind = "archive" | "deactivate" | "reactivate" | "recover" | "delete";

function AssignedStaffsTab({ shift, onChangeRoleFor, onChangeShiftFor }: {
    shift: Shift;
    onChangeRoleFor: (s: Staff) => void;
    onChangeShiftFor: (s: Staff) => void;
}) {
    const router = useRouter();
    const allStaff           = useAppStore(s => s.staff);
    const branches           = useAppStore(s => s.branches);
    const roles              = useAppStore(s => s.roles);
    const setStaffStatus     = useAppStore(s => s.setStaffStatus);
    const deleteStaffAction  = useAppStore(s => s.deleteStaff);
    const canDeleteStaff     = useAppStore(s => s.canDeleteStaff);
    const resendStaffInvite  = useAppStore(s => s.resendStaffInvite);
    const showToast          = useAppStore(s => s.showToast);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pending, setPending] = useState<{ kind: ConfirmKind; row: Staff } | null>(null);
    const [bulkPending, setBulkPending] = useState<BulkKind | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const scoped = useMemo(() => allStaff.filter(s => s.shiftId === shift.id), [allStaff, shift.id]);
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
        const back = `/staff/shifts/${shift.id}`;
        if (kind === "view")          return router.push(`/staff/members/${s.id}?returnTo=${back}`);
        if (kind === "edit_details")  return router.push(`/staff/members/${s.id}/edit?returnTo=${back}`);
        if (kind === "change_role")   return onChangeRoleFor(s);
        if (kind === "change_shift")  return onChangeShiftFor(s);
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
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {scoped.length} {scoped.length === 1 ? "staff" : "staffs"}
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
                                            className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                            <td className={TD}>
                                                <CheckboxCell checked={isSelected} onChange={() => toggleOne(s.id)} ariaLabel={`Select ${s.fullName}`} />
                                            </td>
                                            <td className={TD}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <StaffAvatar staff={s} />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[14px] font-medium text-[#101828] truncate">{s.fullName}</span>
                                                        <span className="text-[13px] text-[#667085] truncate">{s.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={TD}>
                                                {role ? (
                                                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", ROLE_TYPE_BADGE[role.type])}>
                                                        {role.name}
                                                    </span>
                                                ) : <span className="text-[#667085]">—</span>}
                                            </td>
                                            <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{branchLabel}</td>
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
                                                        { label: "Change shift",      icon: Clock,         onClick: () => handleAction(s, "change_shift"),  hidden: s.status !== "active" },
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
                const subject = `${selectionCount} ${selectionCount === 1 ? "staff" : "staffs"}`;
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
                    <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                        <button type="button" onClick={clearSelection}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                            {selectionCount} selected
                            <XClose className="w-5 h-5 text-[#667085]" />
                        </button>
                        <div className="flex items-center gap-3">
                            {hasArchivable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Archive className="w-5 h-5 text-[#667085]" />}
                                    onClick={() => setBulkPending("archive")}>
                                    Archive
                                </Button>
                            )}
                            {hasReactivatable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Check className="w-5 h-5 text-[#067647]" />}
                                    onClick={() => setBulkPending("reactivate")}>
                                    Reactivate
                                </Button>
                            )}
                            {hasRecoverable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />}
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
    const canDelete  = !isArchive && totalStaffs === 0;

    return (
        <aside className="w-[320px] shrink-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            <div className="relative shrink-0">
                <DecorativeBanner bannerHeight={156} iconBox={72} icon={Clock} {...BANNER_TINTS.package} />
                <div className="absolute top-3 right-3">
                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", SHIFT_STATUS_BADGE[shift.status])}>
                        {SHIFT_STATUS_LABEL[shift.status]}
                    </span>
                </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <div className="flex flex-col gap-1">
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828] break-words">
                            {shift.name}
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Branch location</p>
                            <p className="text-[16px] font-medium text-[#101828]">{branchName}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Shift days</p>
                            <p className="text-[16px] font-medium text-[#101828]">{daysSummary(shift.working_days)}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Shift hours</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {fmtTime12(shift.start_time)} – {fmtTime12(shift.end_time)}
                            </p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Staffs</p>
                            <p className="text-[16px] font-medium text-[#101828]">{totalStaffs}</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Shift actions</p>
                    <div className="flex flex-col gap-4">
                        {isActive && (
                            <>
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit shift" onClick={() => onAction("edit_details")} />
                                <ActionBtn icon={<UserPlus01 className="w-5 h-5" />} label="Assign staff" onClick={() => onAction("assign_staff")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive shift" onClick={() => onAction("archive")} />
                                {canDelete
                                    ? <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete shift" danger onClick={() => onAction("delete")} />
                                    : <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate shift" danger onClick={() => onAction("deactivate")} />
                                }
                            </>
                        )}
                        {isInactive && (
                            <>
                                <ActionBtn icon={<Check className="w-5 h-5" />} label="Reactivate shift" onClick={() => onAction("reactivate")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive shift" onClick={() => onAction("archive")} />
                                {canDelete && (
                                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete shift" danger onClick={() => onAction("delete")} />
                                )}
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
    const pathname = usePathname();
    const shifts          = useAppStore(s => s.shifts);
    const staff           = useAppStore(s => s.staff);
    const branches        = useAppStore(s => s.branches);
    const setShiftsStatus = useAppStore(s => s.setShiftsStatus);
    const deleteShifts    = useAppStore(s => s.deleteShifts);
    const showToast       = useAppStore(s => s.showToast);

    const shift = shifts.find(s => s.id === shiftId);
    const branch = useMemo(() => shift ? branches.find(b => b.id === shift.branch_id) : undefined, [shift?.branch_id, branches]);
    const totalStaffs = useMemo(() => shift ? staff.filter(s => s.shiftId === shift.id).length : 0, [staff, shift?.id]);

    const [sidebarConfirm, setSidebarConfirm] = useState<ConfirmKind | null>(null);
    const [showAssign, setShowAssign] = useState(false);
    const [changingRoleFor, setChangingRoleFor] = useState<Staff | null>(null);
    const [changingShiftFor, setChangingShiftFor] = useState<Staff | null>(null);

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
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Shift details</h1>
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
        if (kind === "edit_details") return router.push(`/staff/shifts/${shift!.id}/edit?returnTo=${encodeURIComponent(pathname)}`);
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
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Shift details</h1>
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
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px]">
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <div className="flex gap-1">
                                <TabBtn label="Assigned staffs" active onClick={() => {}} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                            <AssignedStaffsTab
                                shift={shift}
                                onChangeRoleFor={setChangingRoleFor}
                                onChangeShiftFor={setChangingShiftFor}
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

            {changingShiftFor && (
                <ChangeShiftModal
                    staffMember={changingShiftFor}
                    onClose={() => setChangingShiftFor(null)}
                    onConfirmed={nextShift => {
                        showToast(
                            "Shift updated",
                            nextShift
                                ? `${changingShiftFor.fullName} moved to ${nextShift.name}.`
                                : `${changingShiftFor.fullName} removed from ${shift.name}.`,
                            "success", "check",
                        );
                        setChangingShiftFor(null);
                    }}
                />
            )}

            <Toast />
        </div>
    );
}
