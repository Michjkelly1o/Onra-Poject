"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff & Permissions (/admin/staff)
// ─────────────────────────────────────────────────────────────────────────────
//
// PRD 10 §3 + §5 + Brief — Staff & Permissions module. Figma:
//   • 6223-328106  — Roles tab
//   • 6223-378535  — Staffs tab
//   • 6229-352915  — Roles filter side panel
//   • 6229-359613  — Staffs filter side panel
//
// Layout:
//   • Toolbar: Total · branch SelectInput · search · Export · + Add new
//   • Container with rounded border:
//       • Pill tabs (Roles · Staffs) + Filter button on the right
//       • Tab 1 — roles table (toggle status + ⋮ row actions)
//       • Tab 2 — staff table (⋮ row actions, Pending rows get Resend invite)
//
// Edit-gating rules (audited): Edit hidden on inactive/archived rows.
// Delete-gating: only on rows with zero records. Owner role is locked
// (toggle disabled, no edit/delete/archive).
//
// State source of truth: useAppStore(s => s.roles) + useAppStore(s => s.staff).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SearchMd, Download01, Plus, DotsVertical, ChevronLeft, ChevronRight, ChevronDown,
    MarkerPin01, FilterLines, XClose, Eye, Edit02, Archive, Trash01,
    Trash02, RefreshCcw01, SlashCircle01, Check, User01, Send01, UserPlus01,
    UserSquare, ClockPlus, AlarmClockOff, AlertTriangle,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { NeutralAvatar } from "@/components/patterns/NeutralAvatar";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import ChangeRoleModal from "@/components/staff/ChangeRoleModal";
import { ShiftManagementTab } from "@/components/staff/ShiftManagementTab";
import { BlockedTimeTab } from "@/components/staff/BlockedTimeTab";
import { SlidePanel } from "@/components/ui/SlidePanel";
import {
    useAppStore, type Branch,
    type Role, type RoleStatus, type RoleType,
    type Staff, type StaffStatus,
} from "@/lib/store";

// ─── Tabs config ───────────────────────────────────────────────────────────

type TabId = "roles" | "staff";

// ─── Role status labels & badge styles ─────────────────────────────────────

const ROLE_STATUS_LABEL: Record<RoleStatus, string> = {
    active: "Active", inactive: "Inactive", archive: "Archive",
};
const ROLE_STATUS_BADGE: Record<RoleStatus, string> = {
    active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    archive:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

// ─── Staff status labels & badge styles ────────────────────────────────────

const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
    pending: "Pending", active: "Active", inactive: "Inactive", archive: "Archive",
};
const STAFF_STATUS_BADGE: Record<StaffStatus, string> = {
    pending:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    archive:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

// ─── Role-type badge palette (per Figma staff tab) ─────────────────────────

const ROLE_TYPE_BADGE: Record<RoleType, string> = {
    owner:        "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    branch_admin: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    operator:     "bg-[#eff4ff] border-1 border-[#c7d7fe] text-[#3538cd]",
    front_desk:   "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    instructor:   "bg-[#fff4ed] border-1 border-[#f9dbaf] text-[#b93815]",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function branchName(id: string | null, branches: Branch[]): string {
    if (id === null) return "All locations";
    return branches.find(b => b.id === id)?.name ?? "—";
}

// ─── Toggle switch (role row "Enabled" column) ─────────────────────────────

function ToggleSwitch({ on, disabled, onChange }: {
    on: boolean; disabled?: boolean; onChange: () => void;
}) {
    return (
        <button type="button" role="switch" aria-checked={on}
            disabled={disabled}
            onClick={onChange}
            className={cn(
                "w-9 h-5 rounded-full p-[2px] flex items-center transition-colors shrink-0",
                disabled && "opacity-40 cursor-not-allowed",
                on ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
            )}>
            <span className="block w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

// ─── Avatar ────────────────────────────────────────────────────────────────

interface AvatarShape { imageUrl?: string; initials: string; color: string; name: string }

// Thin wrappers around the canonical `<NeutralAvatar>` — preserve the local
// names so the dozens of call sites in this file don't need to change.
function Avatar({ a, size = 40 }: { a: AvatarShape; size?: number }) {
    return <NeutralAvatar initials={a.initials} imageUrl={a.imageUrl} size={size} />;
}

/** Generic role avatar (no individual photo) — used in the Roles tab. */
function RoleAvatar({ size = 40 }: { size?: number }) {
    return <NeutralAvatar icon={User01} size={size} />;
}

// ─── Checkbox cell (shared sage style) ─────────────────────────────────────

function CheckboxCell({ checked, indeterminate = false, onChange, ariaLabel }: {
    checked: boolean; indeterminate?: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// ─── Add-new button — variant-aware ────────────────────────────────────────
//
//   • "combined" (legacy `/admin/staff` route showing both tabs together) →
//     dropdown with "Add role" + "Add staff".
//   • "role-only" (new `/admin/staff/roles` menu item) → plain "Add role"
//     primary button, no dropdown.
//   • "staff-only" (new `/admin/staff` menu item — Staff & shift) → dropdown
//     with "Add staff" + "Add shift" + "Add time off" so the Shift
//     management + Blocked time sub-tabs can spawn their own records.
//
// Designs for Shift / Blocked time forms land next pass — the dropdown
// items toast a friendly "coming soon" until then so the click isn't dead.

type AddNewVariant = "combined" | "role-only" | "staff-only";

function AddNewMenu({ variant, onAddRole, onAddStaff, onAddShift, onAddBlockedTime }: {
    variant: AddNewVariant;
    onAddRole: () => void;
    onAddStaff: () => void;
    onAddShift?: () => void;
    onAddBlockedTime?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // Roles page — single primary button, no dropdown. Per Figma 7413:239946.
    if (variant === "role-only") {
        return (
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={onAddRole}>
                Add role
            </Button>
        );
    }

    const items: { label: string; icon: React.ReactNode; onClick: () => void }[] =
        variant === "staff-only"
            ? [
                { label: "Add staff",         icon: <UserPlus01 className="w-4 h-4 text-[#667085]" />,    onClick: onAddStaff },
                { label: "Add shift",         icon: <ClockPlus className="w-4 h-4 text-[#667085]" />,     onClick: () => onAddShift?.() },
                { label: "Add time off",  icon: <AlarmClockOff className="w-4 h-4 text-[#667085]" />, onClick: () => onAddBlockedTime?.() },
            ]
            : [
                { label: "Add role",  icon: <UserSquare className="w-4 h-4 text-[#667085]" />,  onClick: onAddRole  },
                { label: "Add staff", icon: <UserPlus01 className="w-4 h-4 text-[#667085]" />, onClick: onAddStaff },
            ];

    return (
        <div ref={ref} className="relative">
            <Button variant="primary" size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setOpen(p => !p)}>
                Add new
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[200px]">
                    {items.map(it => (
                        <button key={it.label} type="button" onClick={() => { setOpen(false); it.onClick(); }}
                            className="flex items-center gap-2.5 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {it.icon}{it.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Pill tab switcher ─────────────────────────────────────────────────────
//
// Visual spec mirrors /admin/products (membership/packages):
//   • Padding         px-4 py-[6px]  (NOT py-2 — 2px shorter than default)
//   • Radius          rounded-[8px]
//   • Active shadow   two-stop drop shadow (skeumorphic)
//   • Transition      `transition-all` (not just colors)
//   • Label format    "Roles (7)" — count in parens, same as
//                     "Membership (3)" / "Credit package (5)"
//
// Wrapper bg uses `bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1`
// — Tailwind tokens (resolved via the global Tailwind config) so the staff
// card matches products edge-for-edge.

// Local TabPill removed — uses canonical `<SegmentedTabs>` from
// `@/components/patterns/SegmentedTabs`.

// ─── Status pill (filter side panel) ───────────────────────────────────────


// ─── Filter side panel — handles both tabs ─────────────────────────────────

// Roles are branch-agnostic — the Roles filter no longer has a branch field.
interface RoleFilter   { statuses: RoleStatus[]; }
interface StaffFilter  { roleId: string; branchId: string; statuses: StaffStatus[]; }

const EMPTY_ROLE_FILTER:  RoleFilter  = { statuses: [] };
const EMPTY_STAFF_FILTER: StaffFilter = { roleId: "", branchId: "", statuses: [] };

function FilterPanel({ open, onClose, tab, appliedRole, appliedStaff, onApplyRole, onApplyStaff, roles, branches }: {
    open: boolean; onClose: () => void;
    tab: TabId;
    appliedRole: RoleFilter; appliedStaff: StaffFilter;
    onApplyRole:  (next: RoleFilter)  => void;
    onApplyStaff: (next: StaffFilter) => void;
    roles: Role[];
    branches: Branch[];
}) {
    const [pendingRole,  setPendingRole]  = useState<RoleFilter>(EMPTY_ROLE_FILTER);
    const [pendingStaff, setPendingStaff] = useState<StaffFilter>(EMPTY_STAFF_FILTER);

    // Snapshot on open so the user can cancel edits.
    useEffect(() => {
        if (!open) return;
        setPendingRole({ ...appliedRole, statuses: [...appliedRole.statuses] });
        setPendingStaff({ ...appliedStaff, statuses: [...appliedStaff.statuses] });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggleRoleStatus(s: RoleStatus) {
        setPendingRole(p => ({
            ...p,
            statuses: p.statuses.includes(s) ? p.statuses.filter(x => x !== s) : [...p.statuses, s],
        }));
    }
    function toggleStaffStatus(s: StaffStatus) {
        setPendingStaff(p => ({
            ...p,
            statuses: p.statuses.includes(s) ? p.statuses.filter(x => x !== s) : [...p.statuses, s],
        }));
    }

    const isRoleTab = tab === "roles";
    const hasAny = isRoleTab
        ? pendingRole.statuses.length > 0
        : pendingStaff.branchId !== "" || pendingStaff.statuses.length > 0 || pendingStaff.roleId !== "";

    const branchOptions = branches.filter(b => b.status === "active").map(b => ({
        value: b.id, label: b.name,
        icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
    }));
    const roleOptions = roles
        .filter(r => r.status !== "archive")
        .map(r => ({ value: r.id, label: r.name }));

    function handleApply() {
        if (isRoleTab) onApplyRole(pendingRole);
        else           onApplyStaff(pendingStaff);
        onClose();
    }
    function handleClear() {
        if (isRoleTab) { setPendingRole(EMPTY_ROLE_FILTER);   onApplyRole(EMPTY_ROLE_FILTER); }
        else           { setPendingStaff(EMPTY_STAFF_FILTER); onApplyStaff(EMPTY_STAFF_FILTER); }
        onClose();
    }

    return (
        <SlidePanel open={open} onClose={onClose} width={420}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Staffs tab adds Role name filter */}
                    {!isRoleTab && (
                        <>
                            <div className="flex flex-col gap-2">
                                <p className="text-[14px] font-medium text-[#344054]">Role name</p>
                                <SelectInput
                                    placeholder="Select role"
                                    options={[{ value: "", label: "All roles" }, ...roleOptions]}
                                    value={pendingStaff.roleId}
                                    onChange={v => setPendingStaff(p => ({ ...p, roleId: v }))}
                                    width="w-full"
                                />
                            </div>
                            <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                        </>
                    )}

                    {/* Branch filter — Staffs tab only. Roles are
                        branch-agnostic, so there's no branch to filter on. */}
                    {!isRoleTab && (
                        <>
                            <div className="flex flex-col gap-2">
                                <p className="text-[14px] font-medium text-[#344054]">Branch location</p>
                                <SelectInput
                                    triggerIcon={<MarkerPin01 className="w-4 h-4 text-[#667085]" />}
                                    placeholder="Select location"
                                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                                    value={pendingStaff.branchId}
                                    onChange={v => setPendingStaff(p => ({ ...p, branchId: v }))}
                                    width="w-full"
                                />
                            </div>

                            <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                        </>
                    )}

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {isRoleTab
                                ? (["active", "inactive", "archive"] as RoleStatus[]).map(s => (
                                    <FilterPill key={s} label={ROLE_STATUS_LABEL[s]}
                                        selected={pendingRole.statuses.includes(s)}
                                        onClick={() => toggleRoleStatus(s)} />
                                ))
                                : (["active", "pending", "inactive", "archive"] as StaffStatus[]).map(s => (
                                    <FilterPill key={s} label={STAFF_STATUS_LABEL[s]}
                                        selected={pendingStaff.statuses.includes(s)}
                                        onClick={() => toggleStaffStatus(s)} />
                                ))
                            }
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny} onClick={handleClear}>Clear filter</Button>
                    <Button variant="primary" size="md" onClick={handleApply}>Apply</Button>
                </div>
        </SlidePanel>
    );
}

// ─── Confirm modal (shared for archive / deactivate / recover / delete) ───

type ConfirmKind = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const CONFIRM_CFG: Record<ConfirmKind, {
    iconBg: string; Icon: React.ElementType; iconColor: string;
    title: (subject: string) => string;
    description: (subject: string) => string;
    confirmLabel: string;
    destructive: boolean;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", Icon: Archive, iconColor: "text-[#658774]",
        title: s => `Archive ${s}?`,
        description: s => `${s} will be hidden from default lists. You can recover it any time.`,
        confirmLabel: "Archive", destructive: false,
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", Icon: SlashCircle01, iconColor: "text-[#d92d20]",
        title: s => `Deactivate ${s}?`,
        description: s => `${s} will be temporarily disabled. Historical records remain intact.`,
        confirmLabel: "Deactivate", destructive: true,
    },
    recover: {
        iconBg: "bg-[#e9fff3]", Icon: RefreshCcw01, iconColor: "text-[#658774]",
        title: s => `Recover ${s}?`,
        description: s => `${s} will be restored to Active.`,
        confirmLabel: "Recover", destructive: false,
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", Icon: Check, iconColor: "text-[#658774]",
        title: s => `Reactivate ${s}?`,
        description: s => `${s} will be set back to Active.`,
        confirmLabel: "Reactivate", destructive: false,
    },
    delete: {
        iconBg: "bg-[#fee4e2]", Icon: Trash01, iconColor: "text-[#d92d20]",
        title: s => `Delete ${s}?`,
        description: s => `${s} will be permanently deleted. This can't be undone.`,
        confirmLabel: "Delete", destructive: true,
    },
};

// Local ConfirmModal removed — uses canonical from
// `@/components/modals/ConfirmModal`, driven by CONFIRM_CFG above.

// ─── Role row actions ──────────────────────────────────────────────────────

type RoleRowActionKind = "view" | "add_staff" | "edit_details" | "edit_permissions" | "archive" | "recover" | "delete";

// Thin wrapper around the canonical `<RowActions>` — keeps the role-specific
// items-array logic colocated with the rest of this module, but the kebab
// chrome lives in `@/components/patterns/RowActions`.
function RoleRowActions({ role, staffCount, onAction }: {
    role: Role; staffCount: number; onAction: (kind: RoleRowActionKind) => void;
}) {
    const isActive = role.status === "active";
    const isArchived = role.status === "archive";
    // Per audit: delete only when zero assigned staff AND not locked AND not archived.
    const canDelete = !role.locked && !isArchived && staffCount === 0;
    return (
        <RowActions items={[
            { label: "View details", icon: Eye, onClick: () => onAction("view") },
            { label: "Add staff", icon: UserPlus01, onClick: () => onAction("add_staff"), hidden: !(isActive && !role.locked) },
            { label: "Edit details", icon: Edit02, onClick: () => onAction("edit_details"), hidden: !(isActive && !role.locked) },
            { label: "Edit permissions", icon: UserSquare, onClick: () => onAction("edit_permissions"), hidden: !(isActive && !role.locked) },
            { label: "Archive", icon: Archive, onClick: () => onAction("archive"), hidden: !(!isArchived && !role.locked) },
            { label: "Recover", icon: RefreshCcw01, onClick: () => onAction("recover"), hidden: !(isArchived && !role.locked) },
            { label: "Delete", icon: Trash01, onClick: () => onAction("delete"), danger: true, hidden: !canDelete },
        ]} />
    );
}

// ─── Shift chip cell (Phase 4 — client 2026-07-22) ────────────────────────
//
// One pill per shift assignment, stacked vertically when a staff member
// holds multiple shifts (Liam Chen's Morning + Afternoon Tue/Thu is the
// canonical case from the mockup). Pill shape matches the ROLE and
// STAFF_STATUS pills already used on the same row so the table reads
// with one voice — never a rectangle.
//
// Chip format: "{Shift name} · {Days} · {HH-HH}". Days summary uses the
// same "contiguous run" heuristic the Shift management tab already uses
// (`daysSummary`) so both surfaces speak identically.
//
// Empty state (no assignments) shows an amber warning pill using the
// same tone family as the Understaffed pill on the shift list. This is
// the "gap flag" the mockup called out: "Staff with no shift can't be
// scheduled, so the gap is flagged here."

/** "Mon", "Tue"… labels for the daysSummary output. Sun-first to match
 *  the seed's 7-bit `working_days` array. */
const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Same contiguous-run logic the ShiftManagementTab uses. Duplicated
 *  inline (very small) to avoid a shared-util expansion in this pass —
 *  keep the seed identical. */
function shiftDaysSummary(workingDays: boolean[]): string {
    const picked = workingDays.flatMap((on, i) => on ? [i] : []);
    if (picked.length === 0) return "—";
    if (picked.length === 7) return "Every day";
    const min = picked[0];
    const max = picked[picked.length - 1];
    const contiguous = picked.length === (max - min + 1);
    if (contiguous && picked.length >= 3) return `${DAY_LABELS_SHORT[min]} - ${DAY_LABELS_SHORT[max]}`;
    return picked.map(i => DAY_LABELS_SHORT[i]).join(", ");
}

/** "07:00" → "07". The mockup abbreviates times to hours-only so the chip
 *  never overflows on the directory row. */
function toHour(hhmm: string): string {
    const [h] = hhmm.split(":");
    return h;
}

/** Small pill chip per assignment. Uses the mint tone that already
 *  represents "instructor" / "active" throughout the app so a shift
 *  assignment reads as a positive signal. */
function ShiftAssignmentChip({ label }: { label: string }) {
    // Fit-width pill — no `max-w-full truncate` so the chip hugs its
    // content rather than stretching to the column width. Client
    // 2026-07-22 audit.
    return (
        <span
            className="inline-flex w-fit items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap bg-[#f0faf3] border-1 border-[#c7e5d1] text-[#3b5446]"
            title={label}
        >
            {label}
        </span>
    );
}

/** Empty-state warning — plain amber text with icon (client 2026-07-22
 *  clarified: no badge box, just a flagged line). Same amber tone family
 *  as the Understaffed pill so the "staffing gap" signal still reads. */
function NoShiftWarning() {
    return (
        <span className="inline-flex items-center gap-1 text-[13px] text-[#b54708] whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            No shift yet — can&apos;t be scheduled
        </span>
    );
}

// ─── Shifts / Time off date navigators (Phase 5 + 6 lifted up) ──────────
//
// Client 2026-07-22 audit — the Week and Month date navigators moved out
// of the child view components and up here so they render on the sub-tab
// row alongside the List / Week / Month toggle. Chrome matches the
// /admin/schedule Week + Month navs.

const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** "20 – 26 Jul 2026" / "27 Jul – 2 Aug 2026". */
function weekRangeLabel(start: Date): string {
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const y = end.getFullYear();
    const monthLabelsShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} – ${end.getDate()} ${monthLabelsShort[end.getMonth()]} ${y}`;
    }
    return `${start.getDate()} ${monthLabelsShort[start.getMonth()]} – ${end.getDate()} ${monthLabelsShort[end.getMonth()]} ${y}`;
}

function ShiftsDateNav({ weekStart, setWeekStart }: {
    weekStart: Date;
    setWeekStart: (d: Date) => void;
}) {
    return (
        <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous week"
                onClick={() => {
                    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-surface-secondary hover:bg-[#e4e7ec] transition-colors">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button"
                onClick={() => {
                    const d = new Date(); d.setHours(0,0,0,0);
                    const monIdx = (d.getDay() + 6) % 7;
                    d.setDate(d.getDate() - monIdx);
                    setWeekStart(d);
                }}
                className="px-3 py-[6px] rounded-[8px] bg-surface-secondary text-[14px] font-semibold text-[#344054] min-w-[168px] text-center hover:bg-[#e4e7ec] transition-colors">
                {weekRangeLabel(weekStart)}
            </button>
            <button type="button" aria-label="Next week"
                onClick={() => {
                    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-surface-secondary hover:bg-[#e4e7ec] transition-colors">
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function TimeOffDateNav({ cursor, setCursor }: {
    cursor: { year: number; month: number };
    setCursor: (c: { year: number; month: number }) => void;
}) {
    return (
        <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous month"
                onClick={() => setCursor(cursor.month === 0
                    ? { year: cursor.year - 1, month: 11 }
                    : { year: cursor.year, month: cursor.month - 1 })}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-surface-secondary hover:bg-[#e4e7ec] transition-colors">
                <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button"
                onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }}
                className="px-3 py-[6px] rounded-[8px] bg-surface-secondary text-[14px] font-semibold text-[#344054] min-w-[160px] text-center hover:bg-[#e4e7ec] transition-colors">
                {MONTH_LABELS[cursor.month]} {cursor.year}
            </button>
            <button type="button" aria-label="Next month"
                onClick={() => setCursor(cursor.month === 11
                    ? { year: cursor.year + 1, month: 0 }
                    : { year: cursor.year, month: cursor.month + 1 })}
                className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-surface-secondary hover:bg-[#e4e7ec] transition-colors">
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ─── Staff row actions ─────────────────────────────────────────────────────
//
// Action gating (matches the audited customer-module pattern):
//   • Pending      → View + Resend invite ONLY (no destructive slot — invite
//                    can be rescinded by the admin via the resend flow or
//                    archived later)
//   • Active       → View + Edit + Change role + Archive + ONE destructive
//                    slot (Deactivate XOR Delete based on `hasHistory`)
//   • Inactive     → View + Reactivate + Archive only
//   • Archived     → View + Recover only
//
// "hasHistory" for staff = `firstLoginCompleted` — a staff member who's
// signed in has likely produced records (classes/transactions/etc.) so they
// must be Deactivated rather than Deleted. New-account staff that never
// logged in have no history and qualify for Delete.

type StaffRowActionKind = "view" | "edit_details" | "change_role" | "resend_invite" | "archive" | "deactivate" | "reactivate" | "recover" | "delete";

// Thin wrapper around the canonical `<RowActions>` — items array is
// computed here based on staff status + hasHistory, then delegated.
function StaffRowActions({ staff, hasHistory, onAction }: {
    staff: Staff;
    hasHistory: boolean;
    onAction: (kind: StaffRowActionKind) => void;
}) {
    const isPending  = staff.status === "pending";
    const isActive   = staff.status === "active";
    const isInactive = staff.status === "inactive";
    const isArchive  = staff.status === "archive";
    return (
        <RowActions items={[
            { label: "View details", icon: Eye, onClick: () => onAction("view") },
            { label: "Resend invitation", icon: Send01, onClick: () => onAction("resend_invite"), hidden: !isPending },
            { label: "Edit details", icon: Edit02, onClick: () => onAction("edit_details"), hidden: !isActive },
            { label: "Change role", icon: UserSquare, onClick: () => onAction("change_role"), hidden: !isActive },
            { label: "Archive", icon: Archive, onClick: () => onAction("archive"), hidden: !(isActive || isInactive) },
            { label: "Reactivate", icon: Check, onClick: () => onAction("reactivate"), hidden: !isInactive },
            { label: "Recover", icon: RefreshCcw01, onClick: () => onAction("recover"), hidden: !isArchive },
            { label: "Deactivate", icon: SlashCircle01, onClick: () => onAction("deactivate"), danger: true, hidden: !(isActive && hasHistory) },
            { label: "Delete", icon: Trash01, onClick: () => onAction("delete"), danger: true, hidden: !(isActive && !hasHistory) },
        ]} />
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── CSV export helper ─────────────────────────────────────────────────────

function exportRolesCsv(rows: Role[], staffByRole: Map<string, number>) {
    const header = ["Role name", "Description", "Type", "Staff", "Status"];
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map(r => [
        r.name, r.description, r.type,
        staffByRole.get(r.id) ?? 0, ROLE_STATUS_LABEL[r.status],
    ].map(escape).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `roles-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

function exportStaffCsv(rows: Staff[], rolesById: Map<string, Role>, branches: Branch[]) {
    const header = ["Name", "Email", "Phone", "Role", "Branch location", "Status", "Joined"];
    const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map(s => [
        s.fullName, s.email, s.phone,
        rolesById.get(s.roleId)?.name ?? "—",
        branchName(s.branchId, branches),
        STAFF_STATUS_LABEL[s.status], s.joinedDate,
    ].map(escape).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `staff-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

// ─── Table chrome ──────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Page ──────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { kind: ConfirmKind; entity: "role"; row: Role }
    | { kind: ConfirmKind; entity: "staff"; row: Staff }
    | null;

// Sub-tabs on the Staff & shift route (Figma 7413:239946). Shift management
// + Blocked time designs land in a follow-up; their containers render an
// empty-state for now so the navigation is in place.
type StaffSubTab = "staff" | "shift-management" | "blocked-time";

export interface StaffPermissionsPageProps {
    /** When set, the page renders ONLY the matching tab + adjusts the toolbar:
     *   • "roles" → roles list, "Add role" plain button (Role & permissions menu)
     *   • "staff" → staff list, Add new dropdown w/ Staff + Shift + Blocked time
     *               PLUS the sub-tab pill row (Staff & shift menu)
     *  Undefined → legacy combined view (Roles + Staff tabs side-by-side).
     *  Routes always pass an explicit value now (`/admin/staff` → "staff",
     *  `/admin/staff/roles` → "roles") — the undefined branch only stays for
     *  backwards compat. */
    forceTab?: "roles" | "staff";
}

export function StaffPermissionsPage({ forceTab }: StaffPermissionsPageProps = {}) {
    const router = useRouter();
    const roles            = useAppStore(s => s.roles);
    const staff            = useAppStore(s => s.staff);
    const branches         = useAppStore(s => s.branches);
    // Client 2026-07-22 Phase 4 — staff directory now shows a Shift
    // column. Reads the shifts + assignments slices to compute one
    // chip per assignment or a "No shift yet" warning when a staff
    // member has none.
    const shifts           = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    const setRolesStatus   = useAppStore(s => s.setRolesStatus);
    const deleteRolesAction = useAppStore(s => s.deleteRoles);
    const setStaffStatus   = useAppStore(s => s.setStaffStatus);
    const deleteStaffAction = useAppStore(s => s.deleteStaff);
    const canDeleteStaff   = useAppStore(s => s.canDeleteStaff);
    const resendStaffInvite = useAppStore(s => s.resendStaffInvite);
    const showToast        = useAppStore(s => s.showToast);

    const [tab, setTab] = useState<TabId>(forceTab ?? "roles");
    const searchParams = useSearchParams();
    // Deep-link back to a specific sub-tab (e.g. edit-time-off Back → Time off).
    const initialSubTab = ((): StaffSubTab => {
        const v = searchParams?.get("subtab");
        return v === "shift-management" || v === "blocked-time" || v === "staff" ? v : "staff";
    })();
    const [staffSubTab, setStaffSubTab] = useState<StaffSubTab>(initialSubTab);
    /** Shift management's filter applies the green dot to the toolbar
     *  Filter button. Lifted up so the existing toolbar code path can
     *  read it without re-subscribing inside the table component. */
    const [shiftFilterActive, setShiftFilterActive] = useState(false);
    const [branchId, setBranchId] = useState<string>("");
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    // Client 2026-07-22 audit fix — inner List/Week + List/Month toggle
    // lifted UP to the sub-tab row (was inside the child tab body). One
    // state per sub-tab so switching Shifts→Time off→Shifts remembers the
    // previously picked view.
    const [shiftsViewMode,  setShiftsViewMode]  = useState<"list" | "week">("list");
    const [timeOffViewMode, setTimeOffViewMode] = useState<"list" | "month">("list");
    // Date pointers ALSO lifted up so their prev/next/label buttons can
    // render on the sub-tab row next to the view toggle (client
    // 2026-07-22). Week points at the Monday of the current week; Month
    // is a { year, month } cursor.
    const [shiftsWeekStart, setShiftsWeekStart] = useState<Date>(() => {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        const monIdx = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - monIdx);
        return d;
    });
    const [timeOffMonthCursor, setTimeOffMonthCursor] = useState<{ year: number; month: number }>(() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    });
    const [roleFilter,  setRoleFilter]  = useState<RoleFilter>(EMPTY_ROLE_FILTER);
    const [staffFilter, setStaffFilter] = useState<StaffFilter>(EMPTY_STAFF_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
    // The Change role modal lives outside the confirm-modal flow because it
    // captures a form value (new role) rather than running a single action.
    const [changingRoleFor, setChangingRoleFor] = useState<Staff | null>(null);
    // Bulk selection — separate sets per tab so switching tabs preserves work.
    const [selectedRoleIds,  setSelectedRoleIds]  = useState<Set<string>>(new Set());
    const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
    // Bulk confirmation — fires after the floating-bar action is clicked.
    const [pendingBulk, setPendingBulk] = useState<{ entity: "role" | "staff"; kind: ConfirmKind } | null>(null);

    useEffect(() => { setPage(1); }, [tab, branchId, search, roleFilter, staffFilter]);
    // Clear the OTHER tab's selection when switching — keeps the bulk bar
    // scoped to the tab the user is looking at.
    useEffect(() => {
        if (tab === "roles") setSelectedStaffIds(new Set());
        else                 setSelectedRoleIds(new Set());
    }, [tab]);

    const rolesById = useMemo(() => new Map(roles.map(r => [r.id, r] as const)), [roles]);
    // Roles are branch-agnostic — the "staffs" column + delete-gate count
    // every staffer on a role, across all branches.
    const staffByRole = useMemo(() => {
        const m = new Map<string, number>();
        for (const s of staff) {
            if (!rolesById.has(s.roleId)) continue;
            m.set(s.roleId, (m.get(s.roleId) ?? 0) + 1);
        }
        return m;
    }, [staff, rolesById]);

    // Client 2026-07-22 Phase 4 — shift chips on the staff directory.
    // Build the (staffId → assignments[]) map once so each row's chip
    // cell is a simple lookup. Assignments are sorted by shift start
    // time so multi-shift rows read chronologically (Morning above
    // Afternoon above Evening).
    const shiftsById = useMemo(() => new Map(shifts.map(sh => [sh.id, sh] as const)), [shifts]);
    const assignmentsByStaff = useMemo(() => {
        const m = new Map<string, typeof shiftAssignments>();
        for (const a of shiftAssignments) {
            const list = m.get(a.staff_id) ?? [];
            list.push(a);
            m.set(a.staff_id, list);
        }
        // Sort each list in-place (using `.forEach` avoids the
        // downlevelIteration target-flag issue that the `for..of` on a
        // Map entries iterator raised on tsconfig target=es5).
        m.forEach(list => {
            list.sort((x, y) => {
                const xs = shiftsById.get(x.shift_id)?.start_time ?? "";
                const ys = shiftsById.get(y.shift_id)?.start_time ?? "";
                return xs.localeCompare(ys);
            });
        });
        return m;
    }, [shiftAssignments, shiftsById]);

    // ─── Filtered roles ────────────────────────────────────────────────────
    const filteredRoles = useMemo(() => {
        const q = search.trim().toLowerCase();
        return roles.filter(r => {
            if (roleFilter.statuses.length > 0 && !roleFilter.statuses.includes(r.status)) return false;
            if (q && !r.name.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [roles, search, roleFilter]);

    // ─── Filtered staff ────────────────────────────────────────────────────
    const filteredStaff = useMemo(() => {
        const q = search.trim().toLowerCase();
        return staff.filter(s => {
            if (branchId && s.branchId !== null && s.branchId !== branchId) return false;
            if (staffFilter.branchId && s.branchId !== null && s.branchId !== staffFilter.branchId) return false;
            if (staffFilter.roleId && s.roleId !== staffFilter.roleId) return false;
            if (staffFilter.statuses.length > 0 && !staffFilter.statuses.includes(s.status)) return false;
            if (q && !s.fullName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [staff, branchId, search, staffFilter]);

    // ─── Sort ────────────────────────────────────────────────────────────
    const ROLE_STATUS_ORDER: Record<RoleStatus, number> = { active: 0, inactive: 1, archive: 2 };
    const STAFF_STATUS_ORDER: Record<StaffStatus, number> = { active: 0, pending: 1, inactive: 2, archive: 3 };
    function branchSortName(id: string | null): string {
        if (id === null) return "All locations";
        return branches.find(b => b.id === id)?.name ?? "";
    }
    const { sorted: sortedRoles, sortKey: roleSortKey, sortDir: roleSortDir, toggle: toggleRoleSort } = useSort<Role>(filteredRoles, {
        name:    (a, b) => a.name.localeCompare(b.name),
        staffs:  (a, b) => (staffByRole.get(a.id) ?? 0) - (staffByRole.get(b.id) ?? 0),
        status:  (a, b) => ROLE_STATUS_ORDER[a.status] - ROLE_STATUS_ORDER[b.status],
    });
    const { sorted: sortedStaff, sortKey: staffSortKey, sortDir: staffSortDir, toggle: toggleStaffSort } = useSort<Staff>(filteredStaff, {
        name:   (a, b) => a.fullName.localeCompare(b.fullName),
        role:   (a, b) => {
            const an = rolesById.get(a.roleId)?.name ?? "";
            const bn = rolesById.get(b.roleId)?.name ?? "";
            return an.localeCompare(bn);
        },
        branch: (a, b) => branchSortName(a.branchId).localeCompare(branchSortName(b.branchId)),
        // Shift sort — no-assignment rows sink to the BOTTOM (so the
        // gap is easy to spot from the top), then sort by the FIRST
        // assigned shift's name for a stable read.
        shift:  (a, b) => {
            const la = assignmentsByStaff.get(a.id) ?? [];
            const lb = assignmentsByStaff.get(b.id) ?? [];
            if (la.length === 0 && lb.length === 0) return 0;
            if (la.length === 0) return  1;
            if (lb.length === 0) return -1;
            const na = shiftsById.get(la[0].shift_id)?.name ?? "";
            const nb = shiftsById.get(lb[0].shift_id)?.name ?? "";
            return na.localeCompare(nb);
        },
        status: (a, b) => STAFF_STATUS_ORDER[a.status] - STAFF_STATUS_ORDER[b.status],
    });

    // ─── Pagination ───────────────────────────────────────────────────────
    const rolesPages = Math.max(1, Math.ceil(sortedRoles.length / pageSize));
    const staffPages = Math.max(1, Math.ceil(sortedStaff.length / pageSize));
    const clampedPage = tab === "roles"
        ? Math.min(Math.max(1, page), rolesPages)
        : Math.min(Math.max(1, page), staffPages);
    const rolePageRows  = sortedRoles.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
    const staffPageRows = sortedStaff.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Bulk-selection derived values ──────────────────────────────────
    const selectedRoleRows  = useMemo(() => roles.filter(r => selectedRoleIds.has(r.id)),  [roles, selectedRoleIds]);
    const selectedStaffRows = useMemo(() => staff.filter(s => selectedStaffIds.has(s.id)), [staff, selectedStaffIds]);

    // Roles bulk gating — Owner row (locked) is excluded from every bulk
    // operation. Delete only applies to non-locked rows with zero assigned
    // staff (same XOR rule as the row menu).
    const bulkRoleArchivable    = selectedRoleRows.some(r => !r.locked && r.status !== "archive");
    const bulkRoleReactivatable = selectedRoleRows.some(r => !r.locked && r.status === "inactive");
    const bulkRoleRecoverable   = selectedRoleRows.some(r => !r.locked && r.status === "archive");
    const bulkRoleDeletable     = selectedRoleRows.length > 0
        && selectedRoleRows.every(r => !r.locked && r.status !== "archive" && (staffByRole.get(r.id) ?? 0) === 0);

    // Staff bulk gating — Pending rows are never destructively bulkable
    // (Resend invitation is a single-row action). Delete only applies when
    // every selected row has no first-login history.
    const bulkStaffArchivable    = selectedStaffRows.some(s => s.status !== "archive" && s.status !== "pending");
    const bulkStaffReactivatable = selectedStaffRows.some(s => s.status === "inactive");
    const bulkStaffRecoverable   = selectedStaffRows.some(s => s.status === "archive");
    const bulkStaffDeletable     = selectedStaffRows.length > 0
        && selectedStaffRows.every(s => canDeleteStaff(s.id));

    // ─── Branch options (live `branches` slice) ───────────────────────────
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id, label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // ─── Toolbar handlers ─────────────────────────────────────────────────
    // Return path is route-aware so the X-close button on the form lands
    // back on the menu item the admin came from:
    //   • Role & permissions menu (forceTab="roles") → /admin/staff/roles
    //   • Staff & shift menu      (forceTab="staff") → /admin/staff
    //   • Legacy combined view    (undefined)        → /admin/staff
    const returnTo = forceTab === "roles" ? "/admin/staff/roles" : "/admin/staff";
    function handleAddRole()  { router.push(`/staff/roles/new?returnTo=${encodeURIComponent(returnTo)}`); }
    function handleAddStaff() { router.push(`/staff/members/new?returnTo=${encodeURIComponent(returnTo)}`); }
    function handleExport() {
        if (tab === "roles") {
            if (filteredRoles.length === 0) return;
            exportRolesCsv(filteredRoles, staffByRole);
            showToast("Roles exported", `${filteredRoles.length} role${filteredRoles.length === 1 ? "" : "s"} exported to CSV.`, "success", "check");
        } else {
            if (filteredStaff.length === 0) return;
            exportStaffCsv(filteredStaff, rolesById, branches);
            showToast("Staff exported", `${filteredStaff.length} staff member${filteredStaff.length === 1 ? "" : "s"} exported to CSV.`, "success", "check");
        }
    }

    // ─── Role actions ─────────────────────────────────────────────────────
    function handleRoleAction(role: Role, kind: RoleRowActionKind) {
        const rt = encodeURIComponent(returnTo);
        if (kind === "view")             return router.push(`/staff/roles/${role.id}?returnTo=${rt}`);
        if (kind === "edit_details")     return router.push(`/staff/roles/${role.id}/edit?returnTo=${rt}`);
        if (kind === "edit_permissions") return router.push(`/staff/roles/${role.id}/permissions/edit?returnTo=${rt}`);
        if (kind === "add_staff")        return router.push(`/staff/members/new?roleId=${role.id}&returnTo=${rt}`);
        // Confirmable
        const confirmKind: ConfirmKind = kind;
        setPendingConfirm({ kind: confirmKind, entity: "role", row: role });
    }
    function performRoleConfirm(p: NonNullable<PendingConfirm> & { entity: "role" }) {
        const { row, kind } = p;
        const subject = `"${row.name}"`;
        if (kind === "delete") {
            const { deleted, blocked } = deleteRolesAction([row.id]);
            if (deleted.length > 0) {
                showToast("Role deleted", `${subject} permanently removed.`, "success", "trash");
            } else if (blocked.length > 0) {
                showToast("Cannot delete", "Role has assigned staff or is locked — archive instead.", "error");
            }
        } else if (kind === "archive") {
            setRolesStatus([row.id], "archive");
            showToast("Role archived", `${subject} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setRolesStatus([row.id], "active");
            showToast("Role recovered", `${subject} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            setRolesStatus([row.id], "inactive");
            showToast("Role deactivated", `${subject} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setRolesStatus([row.id], "active");
            showToast("Role reactivated", `${subject} restored to Active.`, "success", "check");
        }
        setPendingConfirm(null);
    }

    function handleRoleToggle(role: Role) {
        if (role.locked) return;
        if (role.status === "archive") return; // archived rows can't toggle directly
        // Open the same confirm modal pattern used by row actions —
        // deactivate (destructive) or reactivate (success). The actual
        // status flip happens inside `performRoleConfirm`. The modal will
        // surface a smart description (assigned-staff count) when the
        // toggle is about to deactivate a role that has active staff.
        const kind: ConfirmKind = role.status === "active" ? "deactivate" : "reactivate";
        setPendingConfirm({ kind, entity: "role", row: role });
    }

    /** Smart confirm-modal description for the role row.
     *  When deactivating a role that has active staff, surface the count so
     *  the admin understands the impact before flipping the toggle.
     *  Also used for archive on the same surface. */
    function roleConfirmDescription(role: Role, kind: ConfirmKind): string | undefined {
        if (kind !== "deactivate" && kind !== "archive") return undefined;
        const activeAssigned = staff.filter(s => s.roleId === role.id && s.status === "active").length;
        if (activeAssigned === 0) return undefined;
        const verb = kind === "deactivate" ? "deactivated" : "archived";
        return `"${role.name}" will be ${verb}. ${activeAssigned} active staff member${activeAssigned === 1 ? " is" : "s are"} assigned to this role and will immediately lose its permissions until you reassign them.`;
    }

    // ─── Staff actions ────────────────────────────────────────────────────
    function handleStaffAction(s: Staff, kind: StaffRowActionKind) {
        const rt = encodeURIComponent(returnTo);
        if (kind === "view")          return router.push(`/staff/members/${s.id}?returnTo=${rt}`);
        if (kind === "edit_details")  return router.push(`/staff/members/${s.id}/edit?returnTo=${rt}`);
        if (kind === "change_role") {
            setChangingRoleFor(s);
            return;
        }
        if (kind === "resend_invite") {
            const ok = resendStaffInvite(s.id);
            if (ok) showToast("Invitation sent", `Invite resent to ${s.email}.`, "success", "check");
            else    showToast("Cannot resend", "This staff member has already signed in.", "error");
            return;
        }
        // Confirmable
        const confirmKind: ConfirmKind = kind;
        setPendingConfirm({ kind: confirmKind, entity: "staff", row: s });
    }
    function performStaffConfirm(p: NonNullable<PendingConfirm> & { entity: "staff" }) {
        const { row, kind } = p;
        const subject = `"${row.fullName}"`;
        if (kind === "delete") {
            const { deleted, blocked } = deleteStaffAction([row.id]);
            if (deleted.length > 0) {
                showToast("Staff deleted", `${subject} permanently removed.`, "success", "trash");
            } else if (blocked.length > 0) {
                showToast("Cannot delete", "Staff has historical records — archive instead.", "error");
            }
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
        setPendingConfirm(null);
    }

    // ─── Bulk performers (Roles + Staff tabs) ────────────────────────────

    function performBulkRole(kind: ConfirmKind) {
        const rows = selectedRoleRows.filter(r => !r.locked);
        if (rows.length === 0) { setPendingBulk(null); return; }
        const ids = rows.map(r => r.id);
        if (kind === "archive") {
            setRolesStatus(ids, "archive");
            showToast("Roles archived", `${rows.length} role${rows.length === 1 ? "" : "s"} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setRolesStatus(ids, "active");
            showToast("Roles recovered", `${rows.length} role${rows.length === 1 ? "" : "s"} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            setRolesStatus(ids, "inactive");
            showToast("Roles deactivated", `${rows.length} role${rows.length === 1 ? "" : "s"} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setRolesStatus(ids, "active");
            showToast("Roles reactivated", `${rows.length} role${rows.length === 1 ? "" : "s"} restored to Active.`, "success", "check");
        } else if (kind === "delete") {
            const { deleted, blocked } = deleteRolesAction(ids);
            if (deleted.length > 0) showToast("Roles deleted", `${deleted.length} role${deleted.length === 1 ? "" : "s"} permanently removed.`, "success", "trash");
            if (blocked.length > 0) showToast("Some skipped", `${blocked.length} had assigned staff — archive them instead.`, "error");
        }
        setSelectedRoleIds(new Set());
        setPendingBulk(null);
    }

    function performBulkStaff(kind: ConfirmKind) {
        const rows = selectedStaffRows;
        if (rows.length === 0) { setPendingBulk(null); return; }
        const ids = rows.map(s => s.id);
        if (kind === "archive") {
            setStaffStatus(ids, "archive");
            showToast("Staff archived", `${rows.length} staff moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setStaffStatus(ids, "active");
            showToast("Staff recovered", `${rows.length} staff restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            setStaffStatus(ids, "inactive");
            showToast("Staff deactivated", `${rows.length} staff disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setStaffStatus(ids, "active");
            showToast("Staff reactivated", `${rows.length} staff restored to Active.`, "success", "check");
        } else if (kind === "delete") {
            const { deleted, blocked } = deleteStaffAction(ids);
            if (deleted.length > 0) showToast("Staff deleted", `${deleted.length} staff permanently removed.`, "success", "trash");
            if (blocked.length > 0) showToast("Some skipped", `${blocked.length} had history — archive them instead.`, "error");
        }
        setSelectedStaffIds(new Set());
        setPendingBulk(null);
    }

    // ─── Selection toggles ───────────────────────────────────────────────
    function toggleRoleSelection(id: string) {
        setSelectedRoleIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    function toggleAllRolesOnPage(checked: boolean) {
        const eligibleIds = rolePageRows.filter(r => !r.locked).map(r => r.id);
        setSelectedRoleIds(prev => {
            const next = new Set(prev);
            if (checked) eligibleIds.forEach(id => next.add(id));
            else         eligibleIds.forEach(id => next.delete(id));
            return next;
        });
    }
    function toggleStaffSelection(id: string) {
        setSelectedStaffIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    function toggleAllStaffOnPage(checked: boolean) {
        const ids = staffPageRows.map(s => s.id);
        setSelectedStaffIds(prev => {
            const next = new Set(prev);
            if (checked) ids.forEach(id => next.add(id));
            else         ids.forEach(id => next.delete(id));
            return next;
        });
    }

    // ─── Header checkbox states (current page only) ─────────────────────
    const rolePageEligibleIds = rolePageRows.filter(r => !r.locked).map(r => r.id);
    const rolesAllChecked  = rolePageEligibleIds.length > 0 && rolePageEligibleIds.every(id => selectedRoleIds.has(id));
    const rolesSomeChecked = !rolesAllChecked && rolePageEligibleIds.some(id => selectedRoleIds.has(id));
    const staffPageIds = staffPageRows.map(s => s.id);
    const staffAllChecked  = staffPageIds.length > 0 && staffPageIds.every(id => selectedStaffIds.has(id));
    const staffSomeChecked = !staffAllChecked && staffPageIds.some(id => selectedStaffIds.has(id));

    // ─── Counts for the toolbar total ─────────────────────────────────────
    const totalCount = tab === "roles" ? filteredRoles.length : filteredStaff.length;
    const totalNoun = tab === "roles"
        ? (totalCount === 1 ? "role" : "roles")
        // Pluralization fix — "staff" is the same singular AND plural form;
        // never render "staffs" on any surface.
        : "staff";

    // ─── Active-filter dot for the Filter button ──────────────────────────
    //
    //   • Roles tab  → roleFilter
    //   • Staff tab  → staffFilter
    //   • Shift sub-tab (forceTab="staff" + staffSubTab="shift-management")
    //                 → reported up via `setShiftFilterActive`
    const hasActiveFilter = forceTab === "staff" && staffSubTab === "shift-management"
        ? shiftFilterActive
        : tab === "roles"
            ? roleFilter.statuses.length > 0
            : staffFilter.branchId !== "" || staffFilter.statuses.length > 0 || staffFilter.roleId !== "";

    return (
        <div className={cn(
            "flex flex-col gap-6",
            // Staff & shift module — fill the remaining main-content viewport
            // height so the outer page never scrolls, only the inner table
            // body. Mirrors /admin/schedule's outer wrapper.
            // Roles route keeps its content-height behaviour (it has no view
            // card; the table flows in main's normal scroll).
            forceTab !== "roles" && "flex-1 min-h-0",
        )}>
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {totalCount} {totalNoun}
                    </p>
                </div>
                {/* Location filter — hidden on the Roles tab (roles are
                    branch-agnostic). Still drives Staff / Shifts / Blocked-time. */}
                {tab !== "roles" && (
                    <SelectInput
                        triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                        placeholder="Select location"
                        options={[{ value: "", label: "All locations" }, ...branchOptions]}
                        value={branchId}
                        onChange={setBranchId}
                        width="w-[220px]"
                    />
                )}
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search..." />
                {/* Roles & Permissions route hides the Export button —
                    role definitions aren't something admins export as
                    CSV. Kept for the Staff & shift route (still useful
                    for HR exports). */}
                {forceTab !== "roles" && (
                    <ToolbarExport disabled={totalCount === 0} onExportCsv={handleExport} />
                )}
                {/* Role & permissions route: the only role filter left is
                    Status (roles are branch-agnostic), so it's a direct
                    dropdown in the toolbar rather than a slide-in Filter
                    panel. Drives the same `roleFilter.statuses` state (0 or
                    1 entry) the table reads. */}
                {forceTab === "roles" && (
                    <SelectInput
                        placeholder="All statuses"
                        options={[
                            { value: "", label: "All statuses" },
                            { value: "active",   label: ROLE_STATUS_LABEL.active },
                            { value: "inactive", label: ROLE_STATUS_LABEL.inactive },
                            { value: "archive",  label: ROLE_STATUS_LABEL.archive },
                        ]}
                        value={roleFilter.statuses[0] ?? ""}
                        onChange={v => setRoleFilter(v ? { statuses: [v as RoleStatus] } : { statuses: [] })}
                        width="w-[180px]"
                    />
                )}
                {/* Filter button — lifted from the sub-tab row up here
                    (client 2026-07-22). Hidden on empty/placeholder
                    sub-tabs where filter has no effect. */}
                {forceTab !== "roles" &&
                 (forceTab !== "staff" || staffSubTab === "staff" || staffSubTab === "shift-management") && (
                    <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
                )}
                <AddNewMenu
                    variant={forceTab === "roles" ? "role-only" : forceTab === "staff" ? "staff-only" : "combined"}
                    onAddRole={handleAddRole}
                    onAddStaff={handleAddStaff}
                    onAddShift={() => router.push(`/staff/shifts/new?returnTo=${encodeURIComponent("/admin/staff?subtab=shift-management")}`)}
                    onAddBlockedTime={() => router.push(`/staff/blocked-time/new?returnTo=${encodeURIComponent("/admin/staff?subtab=blocked-time")}`)}
                />
            </div>

            {/* View-card chrome:
                  • Role & permissions route → NO bordered card, NO inner
                    padding (per the brief — Figma 7413:239946 shows the
                    table flush against the page chrome).
                  • Staff & shift route + legacy combined → bordered card
                    that fills the remaining viewport height (was a fixed
                    760px surface before — now `flex-1 min-h-0` so a tall
                    screen uses every pixel and only the inner table body
                    scrolls). Mirrors /admin/schedule's view card. */}
            <div className={cn(
                forceTab === "roles"
                    ? "flex flex-col"
                    : "flex-1 min-h-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden",
            )}>
                {/* Inner tab row — only rendered when there are tabs to
                    show OR a Filter button to host. Hidden entirely on
                    the Role & permissions route since Filter moved to
                    the main toolbar and there are no tabs left. */}
                {forceTab !== "roles" && (
                    <div className="shrink-0 px-6 py-4 flex items-center gap-3 relative">
                        {/* Tab pill strip:
                              • combined view (legacy) → Roles | Staff side-by-side
                              • staff-only view       → Staff sub-tabs (Staff |
                                Shifts | Time off).
                            Client 2026-07-22 rename:
                              "Staff (Ns)"          → "Staff (N)"    (singular)
                              "Shift management"    → "Shifts"
                              "Blocked time"        → "Time off"
                            Internal state keys unchanged
                            (`staff-only`, `shift-management`, `blocked-time`)
                            so URL params, deep-links, and every existing
                            conditional keeps working — only the visible
                            labels changed. Full rename happens in the
                            data-model phase; this pass is copy-only. */}
                        {forceTab === undefined && (
                            <SegmentedTabs
                                tabs={[
                                    { key: "roles", label: `Roles (${roles.length})` },
                                    { key: "staff", label: `Staff (${staff.length})` },
                                ]}
                                activeKey={tab}
                                onChange={(k) => setTab(k as typeof tab)}
                            />
                        )}
                        {forceTab === "staff" && (
                            <SegmentedTabs
                                tabs={[
                                    { key: "staff",            label: "Staff" },
                                    { key: "shift-management", label: "Shifts" },
                                    { key: "blocked-time",     label: "Time off" },
                                ]}
                                activeKey={staffSubTab}
                                onChange={(k) => setStaffSubTab(k as typeof staffSubTab)}
                            />
                        )}
                        <div className="flex-1" />
                        {/* Date navigator — center-aligned via `absolute
                            left-1/2 -translate-x-1/2` inside the relative
                            parent (matches the /admin/schedule Week + Month
                            navigator alignment). Client 2026-07-22 audit
                            round 3. */}
                        {forceTab === "staff" && staffSubTab === "shift-management" && shiftsViewMode === "week" && (
                            <div className="absolute left-1/2 -translate-x-1/2">
                                <ShiftsDateNav weekStart={shiftsWeekStart} setWeekStart={setShiftsWeekStart} />
                            </div>
                        )}
                        {forceTab === "staff" && staffSubTab === "blocked-time" && timeOffViewMode === "month" && (
                            <div className="absolute left-1/2 -translate-x-1/2">
                                <TimeOffDateNav cursor={timeOffMonthCursor} setCursor={setTimeOffMonthCursor} />
                            </div>
                        )}
                        {/* Per-sub-tab view toggle — lifted up here from the
                            child tab body (client 2026-07-22). Shifts gets
                            List / Week; Time off gets List / Month. */}
                        {forceTab === "staff" && staffSubTab === "shift-management" && (
                            <SegmentedTabs
                                tabs={[
                                    { key: "list", label: "List" },
                                    { key: "week", label: "Week" },
                                ]}
                                activeKey={shiftsViewMode}
                                onChange={k => setShiftsViewMode(k as "list" | "week")}
                            />
                        )}
                        {forceTab === "staff" && staffSubTab === "blocked-time" && (
                            <SegmentedTabs
                                tabs={[
                                    { key: "list",  label: "List"  },
                                    { key: "month", label: "Month" },
                                ]}
                                activeKey={timeOffViewMode}
                                onChange={k => setTimeOffViewMode(k as "list" | "month")}
                            />
                        )}
                    </div>
                )}

                <div className={cn(
                    forceTab === "roles"
                        ? "relative"            // flush, no scroll wrapper, no fill
                        : "flex-1 overflow-y-auto scrollbar-hide relative",
                )}>
                {/* Shift management sub-tab — fully wired (Figma 6223:378535).
                    Reads `branchId` + `search` from the parent toolbar so
                    the location filter + search inputs above the card
                    drive this table the same way they drive the Staff
                    table. */}
                {forceTab === "staff" && staffSubTab === "shift-management" && (
                    <ShiftManagementTab
                        returnTo="/admin/staff"
                        branchId={branchId}
                        search={search}
                        filterOpen={filterOpen}
                        onCloseFilter={() => setFilterOpen(false)}
                        onFilterStateChange={setShiftFilterActive}
                        viewMode={shiftsViewMode}
                        weekStart={shiftsWeekStart}
                    />
                )}
                {/* Blocked time sub-tab — fully wired (Figma 7413:239407). Same
                    branchId + search inputs from the toolbar drive this table
                    the way they drive Staff + Shift management. */}
                {forceTab === "staff" && staffSubTab === "blocked-time" && (
                    <BlockedTimeTab
                        branchId={branchId}
                        search={search}
                        viewMode={timeOffViewMode}
                        monthCursor={timeOffMonthCursor}
                    />
                )}
                {/* Table — roles
                    Padding model matches /admin/products (membership/packages):
                    the table is wrapped in a `px-6` container (24px L/R) so
                    the table edges line up with the tab nav row above and
                    the pagination row below. Individual th/td cells use
                    only `px-4` — no per-cell pl-6/pr-6 trick. */}
                {(forceTab !== "staff" || staffSubTab === "staff") && tab === "roles" && (
                    rolePageRows.length === 0 ? (
                        // Give the absolute EmptyState a real box to fill so it
                        // doesn't collapse to 0-height and let the pagination row
                        // overlap it (the roles route has no flex-1 scroll wrapper).
                        <div className="relative min-h-[420px]">
                            <EmptyState
                                title={roles.length === 0 ? "No roles yet" : "No roles found"}
                                subtitle={roles.length === 0
                                    ? "Add your first role to start assigning staff."
                                    : "Try adjusting your search or filters."}
                            />
                        </div>
                    ) : (
                    // Table wrapper padding — flush on the Role &
                    // permissions route, 24px L/R inside the card chrome
                    // elsewhere.
                    <div className={cn(forceTab !== "roles" && "px-6")}>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[44px]")}>
                                            <CheckboxCell
                                                checked={rolesAllChecked}
                                                indeterminate={rolesSomeChecked}
                                                onChange={toggleAllRolesOnPage}
                                                ariaLabel="Select all roles on this page"
                                            />
                                        </th>
                                        <th className={TH}>
                                            <SortableHeader sortKey="name" currentSort={roleSortKey} dir={roleSortDir} onSort={toggleRoleSort}>Role name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[100px]")}>
                                            <SortableHeader sortKey="staffs" currentSort={roleSortKey} dir={roleSortDir} onSort={toggleRoleSort}>Staff</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status" currentSort={roleSortKey} dir={roleSortDir} onSort={toggleRoleSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[100px]")}>Enabled</th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rolePageRows.map(r => {
                                        const staffCount = staffByRole.get(r.id) ?? 0;
                                        const isSelected = selectedRoleIds.has(r.id);
                                        return (
                                            <tr key={r.id}
                                                onClick={() => router.push(`/staff/roles/${r.id}?returnTo=${encodeURIComponent(returnTo)}`)}
                                                className={cn("transition-colors cursor-pointer", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    {/* Owner (locked) cannot be bulk-selected. */}
                                                    <CheckboxCell
                                                        checked={isSelected}
                                                        onChange={() => !r.locked && toggleRoleSelection(r.id)}
                                                        ariaLabel={`Select role ${r.name}`}
                                                    />
                                                </td>
                                                <td className={TD}>
                                                <div className="flex items-center gap-3">
                                                    <RoleAvatar />
                                                    <div className="flex flex-col">
                                                        <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                                        <span className="text-[13px] text-[#667085] line-clamp-1">{r.description}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={TD}>{staffCount}</td>
                                            <td className={TD}>
                                                <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", ROLE_STATUS_BADGE[r.status])}>
                                                    {ROLE_STATUS_LABEL[r.status]}
                                                </span>
                                            </td>
                                            <td className={TD} onClick={e => e.stopPropagation()}>
                                                <ToggleSwitch
                                                    on={r.status === "active"}
                                                    disabled={r.locked || r.status === "archive"}
                                                    onChange={() => handleRoleToggle(r)}
                                                />
                                            </td>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <RoleRowActions role={r} staffCount={staffCount}
                                                        onAction={k => handleRoleAction(r, k)} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )
                )}

                {/* Table — staff (same px-6 wrap as roles) */}
                {(forceTab !== "staff" || staffSubTab === "staff") && tab === "staff" && (
                    staffPageRows.length === 0 ? (
                        <EmptyState
                            title={staff.length === 0 ? "No staff members yet" : "No staff found"}
                            subtitle={staff.length === 0
                                ? "Add your first team member to get started."
                                : "Try adjusting your search or filters."}
                        />
                    ) : (
                    // Table wrapper padding — flush on the Role &
                    // permissions route, 24px L/R inside the card chrome
                    // elsewhere.
                    <div className={cn(forceTab !== "roles" && "px-6")}>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[44px]")}>
                                            <CheckboxCell
                                                checked={staffAllChecked}
                                                indeterminate={staffSomeChecked}
                                                onChange={toggleAllStaffOnPage}
                                                ariaLabel="Select all staff on this page"
                                            />
                                        </th>
                                        {/* Client 2026-07-22 Phase 4: SHIFT column
                                            inserted between Branch and Status.
                                            Column widths tuned so:
                                              checkbox 44 · role 160 · branch 180
                                              · shift 260 · status 120 · actions 52
                                              = 816 px of fixed columns; Name gets
                                              the remaining flex width. On a
                                              1200-1440 px chrome that leaves
                                              384-624 px for Name — plenty for
                                              "Firstname Lastname" + email line
                                              without wrapping either the name
                                              cell OR the shift chips. */}
                                        <th className={TH}>
                                            <SortableHeader sortKey="name" currentSort={staffSortKey} dir={staffSortDir} onSort={toggleStaffSort}>Name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[160px]")}>
                                            <SortableHeader sortKey="role" currentSort={staffSortKey} dir={staffSortDir} onSort={toggleStaffSort}>Role</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[180px]")}>
                                            <SortableHeader sortKey="branch" currentSort={staffSortKey} dir={staffSortDir} onSort={toggleStaffSort}>Branch location</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[260px]")}>
                                            <SortableHeader sortKey="shift" currentSort={staffSortKey} dir={staffSortDir} onSort={toggleStaffSort}>Shift</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status" currentSort={staffSortKey} dir={staffSortDir} onSort={toggleStaffSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffPageRows.map(s => {
                                        const role = rolesById.get(s.roleId);
                                        // "Has history" = store refuses hard-delete. The
                                        // single source of truth for the XOR lives in
                                        // `canDeleteStaff`, which checks payroll / schedule /
                                        // rating references before allowing the Delete branch.
                                        const hasHistory = !canDeleteStaff(s.id);
                                        const isSelected = selectedStaffIds.has(s.id);
                                        return (
                                            <tr key={s.id}
                                                onClick={() => router.push(`/staff/members/${s.id}?returnTo=${encodeURIComponent(returnTo)}`)}
                                                className={cn("transition-colors cursor-pointer", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <CheckboxCell
                                                        checked={isSelected}
                                                        onChange={() => toggleStaffSelection(s.id)}
                                                        ariaLabel={`Select staff ${s.fullName}`}
                                                    />
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar a={{ imageUrl: s.imageUrl, initials: s.initials, color: s.color, name: s.fullName }} />
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-medium text-[#101828]">{s.fullName}</span>
                                                            <span className="text-[13px] text-[#667085]">{s.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    {role && (
                                                        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", ROLE_TYPE_BADGE[role.type])}>
                                                            {role.name}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={cn(TD, "text-[#475467]")}>{branchName(s.branchId, branches)}</td>
                                                {/* Shift column — client 2026-07-22 Phase 4.
                                                    One pill per assignment stacked in a
                                                    column (up to 4 gap); "No shift yet"
                                                    warning when the staff member holds
                                                    zero assignments. Owner has no branch/
                                                    shift concept so we render a dash. */}
                                                <td className={TD}>
                                                    {(() => {
                                                        // Owner + roles that are branch-agnostic → em dash.
                                                        // The mockup shows Alex Owen as "—".
                                                        const role = rolesById.get(s.roleId);
                                                        if (role?.type === "owner") {
                                                            return <span className="text-[#98a2b3]">—</span>;
                                                        }
                                                        const list = assignmentsByStaff.get(s.id) ?? [];
                                                        if (list.length === 0) return <NoShiftWarning />;
                                                        return (
                                                            <div className="flex flex-col items-start gap-1.5">
                                                                {list.map(a => {
                                                                    const sh = shiftsById.get(a.shift_id);
                                                                    if (!sh) return null;
                                                                    // Chip: "{Shift name} · {Days} · {HH-HH}"
                                                                    // Days summary uses the per-assignment
                                                                    // days_of_week (may be narrower than the
                                                                    // parent shift's working_days).
                                                                    const label =
                                                                        `${sh.name.replace(/ shift$/i, "")}` +
                                                                        ` · ${shiftDaysSummary(a.days_of_week)}` +
                                                                        ` · ${toHour(sh.start_time)}-${toHour(sh.end_time)}`;
                                                                    return <ShiftAssignmentChip key={a.id} label={label} />;
                                                                })}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className={TD}>
                                                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", STAFF_STATUS_BADGE[s.status])}>
                                                        {STAFF_STATUS_LABEL[s.status]}
                                                    </span>
                                                </td>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <StaffRowActions staff={s} hasHistory={hasHistory}
                                                        onAction={k => handleStaffAction(s, k)} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )
                )}

                {/* Pagination — rendered INSIDE the scrollable wrapper so
                    it travels with the table on scroll (mirrors Shift
                    management + Blocked time sub-tabs). Hidden on the
                    placeholder sub-tabs since they don't have any rows
                    to paginate yet. */}
                {(forceTab !== "staff" || staffSubTab === "staff") && (
                    // Pagination padding:
                    //   • Role & permissions route → no inner padding so it
                    //     aligns with the flush table above.
                    //   • Other routes → 24px L/R to match the card chrome.
                    <div className={cn(forceTab !== "roles" && "px-6")}>
                        <Pagination
                            page={clampedPage}
                            total={tab === "roles" ? filteredRoles.length : filteredStaff.length}
                            pageSize={pageSize}
                            onPage={setPage}
                            onPageSize={n => { setPageSize(n); setPage(1); }}
                        />
                    </div>
                )}
                </div>
            </div>

            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                tab={tab}
                appliedRole={roleFilter}
                appliedStaff={staffFilter}
                onApplyRole={setRoleFilter}
                onApplyStaff={setStaffFilter}
                roles={roles}
                branches={branches}
            />

            {pendingConfirm && (() => {
                const cfg = CONFIRM_CFG[pendingConfirm.kind];
                const subject = pendingConfirm.entity === "role"
                    ? `"${pendingConfirm.row.name}"`
                    : `"${pendingConfirm.row.fullName}"`;
                const description = pendingConfirm.entity === "role"
                    ? roleConfirmDescription(pendingConfirm.row, pendingConfirm.kind)
                    : cfg.description(subject);
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => pendingConfirm.entity === "role"
                            ? performRoleConfirm(pendingConfirm)
                            : performStaffConfirm(pendingConfirm)}
                    />
                );
            })()}

            {/* Bulk confirm modal */}
            {pendingBulk && (() => {
                const cfg = CONFIRM_CFG[pendingBulk.kind];
                const subject = pendingBulk.entity === "role"
                    ? `${selectedRoleRows.length} role${selectedRoleRows.length === 1 ? "" : "s"}`
                    : `${selectedStaffRows.length} staff`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingBulk(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description(subject)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => pendingBulk.entity === "role"
                            ? performBulkRole(pendingBulk.kind)
                            : performBulkStaff(pendingBulk.kind)}
                    />
                );
            })()}

            {/* Floating bulk-action bar — mirrors the gift-card chrome.
                Visible only when the active tab has at least one selection. */}
            {tab === "roles" && selectedRoleRows.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
                    <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                        <button type="button" onClick={() => setSelectedRoleIds(new Set())}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                            {selectedRoleRows.length} selected
                            <XClose className="w-5 h-5 text-[#667085]" />
                        </button>
                        <div className="flex items-center gap-3">
                            {bulkRoleArchivable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Archive className="w-5 h-5 text-[#667085]" />}
                                    onClick={() => setPendingBulk({ entity: "role", kind: "archive" })}>
                                    Archive
                                </Button>
                            )}
                            {bulkRoleReactivatable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Check className="w-5 h-5 text-[#067647]" />}
                                    onClick={() => setPendingBulk({ entity: "role", kind: "reactivate" })}>
                                    Reactivate
                                </Button>
                            )}
                            {bulkRoleRecoverable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />}
                                    onClick={() => setPendingBulk({ entity: "role", kind: "recover" })}>
                                    Recover
                                </Button>
                            )}
                            {bulkRoleArchivable && (
                                bulkRoleDeletable ? (
                                    <Button variant="secondary-gray" size="sm"
                                        className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                        leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                        onClick={() => setPendingBulk({ entity: "role", kind: "delete" })}>
                                        Delete
                                    </Button>
                                ) : (
                                    <Button variant="secondary-gray" size="sm"
                                        className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                        leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                                        onClick={() => setPendingBulk({ entity: "role", kind: "deactivate" })}>
                                        Deactivate
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === "staff" && selectedStaffRows.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
                    <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                        <button type="button" onClick={() => setSelectedStaffIds(new Set())}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                            {selectedStaffRows.length} selected
                            <XClose className="w-5 h-5 text-[#667085]" />
                        </button>
                        <div className="flex items-center gap-3">
                            {bulkStaffArchivable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Archive className="w-5 h-5 text-[#667085]" />}
                                    onClick={() => setPendingBulk({ entity: "staff", kind: "archive" })}>
                                    Archive
                                </Button>
                            )}
                            {bulkStaffReactivatable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Check className="w-5 h-5 text-[#067647]" />}
                                    onClick={() => setPendingBulk({ entity: "staff", kind: "reactivate" })}>
                                    Reactivate
                                </Button>
                            )}
                            {bulkStaffRecoverable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />}
                                    onClick={() => setPendingBulk({ entity: "staff", kind: "recover" })}>
                                    Recover
                                </Button>
                            )}
                            {bulkStaffArchivable && (
                                bulkStaffDeletable ? (
                                    <Button variant="secondary-gray" size="sm"
                                        className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                        leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                        onClick={() => setPendingBulk({ entity: "staff", kind: "delete" })}>
                                        Delete
                                    </Button>
                                ) : (
                                    <Button variant="secondary-gray" size="sm"
                                        className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                        leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                                        onClick={() => setPendingBulk({ entity: "staff", kind: "deactivate" })}>
                                        Deactivate
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            {changingRoleFor && (
                <ChangeRoleModal
                    staff={changingRoleFor}
                    onCancel={() => setChangingRoleFor(null)}
                    onConfirmed={newRoleName => {
                        showToast(
                            "Role updated",
                            `${changingRoleFor.fullName} is now ${newRoleName}.`,
                            "success",
                            "check",
                        );
                        setChangingRoleFor(null);
                    }}
                />
            )}
        </div>
    );
}

