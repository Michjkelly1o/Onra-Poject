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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBulkSelectionSignal } from "@/lib/hooks/useBulkSelectionSignal";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SearchMd, Download01, Plus, DotsVertical, ChevronLeft, ChevronRight, ChevronDown,
    MarkerPin01, FilterLines, XClose, Eye, Edit02, Archive, Trash01,
    Trash02, RefreshCcw01, SlashCircle01, Check, User01, Send01, UserPlus01,
    UserSquare, ClockPlus, AlarmClockOff, Settings01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { registerFilterResetter } from "@/lib/list-ui-cache";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ArchivedSection } from "@/components/patterns/ArchivedSection";
import { useArchiveView } from "@/lib/hooks/useArchiveView";
import { FilterPill } from "@/components/ui/FilterPill";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { NeutralAvatar } from "@/components/patterns/NeutralAvatar";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { staffExportData, rolesExportData, shiftsExportData } from "@/lib/export/specs/staff";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { ToolbarImportButton } from "@/components/patterns/ToolbarImportButton";
import ChangeRoleModal from "@/components/staff/ChangeRoleModal";
import { AssignShiftModal } from "@/components/staff/AssignShiftModal";
import { ShiftManagementTab } from "@/components/staff/ShiftManagementTab";
import { AddShiftPanel } from "@/components/schedule/AddShiftPanel";
import { BlockedTimeTab } from "@/components/staff/BlockedTimeTab";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { openStaffFormPanel } from "@/lib/staff-form-panel";
import {
    useAppStore, type Branch,
    type Role, type RoleStatus, type RoleType,
    type Staff, type StaffStatus, type Shift,
} from "@/lib/store";

// ─── Tabs config ───────────────────────────────────────────────────────────

type TabId = "roles" | "staff";

// ─── Role status labels & badge styles ─────────────────────────────────────

const ROLE_STATUS_LABEL: Record<RoleStatus, string> = {
    active: "Active", inactive: "Inactive", archived: "Archive",
};
const ROLE_STATUS_BADGE: Record<RoleStatus, string> = {
    active:   "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    archived:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

// ─── Staff status labels & badge styles ────────────────────────────────────

const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
    pending: "Pending", active: "Active", inactive: "Inactive", archived: "Archive",
};
const STAFF_STATUS_BADGE: Record<StaffStatus, string> = {
    pending:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    active:   "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    archived:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

// ─── Role-type badge palette (per Figma staff tab) ─────────────────────────

const ROLE_TYPE_BADGE: Record<RoleType, string> = {
    owner:        "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    branch_admin: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    operator:     "bg-[#eff4ff] border-1 border-[#c7d7fe] text-[#3538cd]",
    front_desk:   "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    instructor:   "bg-[#fff4ed] border-1 border-[#f9dbaf] text-[#b93815]",
    attendees:    "bg-[#ecfeff] border-1 border-[#a5f0fc] text-[#0e7090]",
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
                on ? "bg-[#164e52] justify-end" : "bg-[#f2f4f7] justify-start",
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
                    ? "bg-[#164e52] border-[#164e52] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#457175]",
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

type AddNewVariant = "combined" | "role-only" | "staff-only" | "staff-add-only" | "shift-only";

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

    // Single primary button, no dropdown:
    //   • Roles page → Add role (Figma 7413:239946).
    //   • Staff section → Add staff (Staff and Shift are separate menus now, so
    //     the Staff Add opens Add staff directly — client 2026-08-06).
    if (variant === "role-only" || variant === "staff-add-only") {
        return (
            <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={variant === "role-only" ? onAddRole : onAddStaff}
            >
                Add
            </Button>
        );
    }

    const items: { label: string; icon: React.ReactNode; onClick: () => void }[] =
        // Shift section → Add shift + Add time off only (no Add staff — that
        // lives in the Staff menu now). Client 2026-08-06.
        variant === "shift-only"
            ? [
                { label: "Add shift",         icon: <ClockPlus className="w-4 h-4 text-[#667085]" />,     onClick: () => onAddShift?.() },
                { label: "Add time off",  icon: <AlarmClockOff className="w-4 h-4 text-[#667085]" />, onClick: () => onAddBlockedTime?.() },
            ]
            : variant === "staff-only"
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
                Add
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
//                     "Membership (3)" / "Package (5)"
//
// Wrapper bg uses `bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1`
// — Tailwind tokens (resolved via the global Tailwind config) so the staff
// card matches products edge-for-edge.

// Local TabPill removed — uses canonical `<SegmentedTabs>` from
// `@/components/patterns/SegmentedTabs`.

// ─── Status pill (filter side panel) ───────────────────────────────────────


// ─── Filter side panel — handles both tabs ─────────────────────────────────

// Roles are branch-agnostic — the Roles filter no longer has a branch field.
// Staff filter (client 2026-07-24): Role is now MULTI-select; the Branch
// field was removed — the module's global branch selector already scopes by
// location, so filtering by branch twice was redundant.
interface RoleFilter   { statuses: RoleStatus[]; }
interface StaffFilter  { roleIds: string[]; statuses: StaffStatus[]; }

const EMPTY_ROLE_FILTER:  RoleFilter  = { statuses: [] };
const EMPTY_STAFF_FILTER: StaffFilter = { roleIds: [], statuses: [] };

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
    function toggleStaffRole(id: string) {
        setPendingStaff(p => ({
            ...p,
            roleIds: p.roleIds.includes(id) ? p.roleIds.filter(x => x !== id) : [...p.roleIds, id],
        }));
    }

    const isRoleTab = tab === "roles";
    const hasAny = isRoleTab
        ? pendingRole.statuses.length > 0
        : pendingStaff.statuses.length > 0 || pendingStaff.roleIds.length > 0;

    const roleFilterOptions = roles.filter(r => r.status !== "archived");
    void branches;

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
                    {/* Staffs tab — Role name is a MULTI-select pill group
                        (client 2026-07-24). Branch filter removed: the global
                        branch selector already scopes the module by location. */}
                    {!isRoleTab && (
                        <>
                            <div className="flex flex-col gap-2">
                                <p className="text-[14px] font-medium text-[#344054]">Role</p>
                                <div className="flex flex-wrap gap-2">
                                    {roleFilterOptions.map(r => (
                                        <FilterPill key={r.id} label={r.name}
                                            selected={pendingStaff.roleIds.includes(r.id)}
                                            onClick={() => toggleStaffRole(r.id)} />
                                    ))}
                                </div>
                            </div>
                            <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                        </>
                    )}

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {isRoleTab
                                /* Roles are delete-only — no Archived filter (policy §5, D-4). */
                                ? (["active", "inactive"] as RoleStatus[]).map(s => (
                                    <FilterPill key={s} label={ROLE_STATUS_LABEL[s]}
                                        selected={pendingRole.statuses.includes(s)}
                                        onClick={() => toggleRoleStatus(s)} />
                                ))
                                /* Archived is the Archived section, not a filter value (policy §7). */
                                : (["active", "pending", "inactive"] as StaffStatus[]).map(s => (
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
        iconBg: "bg-[#eff6f3]", Icon: Archive, iconColor: "text-[#164e52]",
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
        iconBg: "bg-[#eff6f3]", Icon: RefreshCcw01, iconColor: "text-[#164e52]",
        title: s => `Recover ${s}?`,
        description: s => `${s} will be restored to Active.`,
        confirmLabel: "Recover", destructive: false,
    },
    reactivate: {
        iconBg: "bg-[#eff6f3]", Icon: Check, iconColor: "text-[#164e52]",
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

type RoleRowActionKind = "view" | "add_staff" | "edit_details" | "edit_permissions" | "archive" | "recover" | "delete" | "deactivate" | "reactivate";

// Thin wrapper around the canonical `<RowActions>` — keeps the role-specific
// items-array logic colocated with the rest of this module, but the kebab
// chrome lives in `@/components/patterns/RowActions`.
function RoleRowActions({ role, staffCount, onAction }: {
    role: Role; staffCount: number; onAction: (kind: RoleRowActionKind) => void;
}) {
    const isActive = role.status === "active";
    const isArchived = role.status === "archived";
    // Per audit: delete only when zero assigned staff AND not locked AND not archived.
    const canDelete = !role.locked && !isArchived && staffCount === 0;
    return (
        <RowActions items={[
            { label: "View details", icon: Eye, onClick: () => onAction("view") },
            { label: "Add staff", icon: UserPlus01, onClick: () => onAction("add_staff"), hidden: !(isActive && !role.locked) },
            { label: "Edit details", icon: Edit02, onClick: () => onAction("edit_details"), hidden: !(isActive && !role.locked) },
            { label: "Edit permissions", icon: UserSquare, onClick: () => onAction("edit_permissions"), hidden: !(isActive && !role.locked) },
            { label: "Deactivate", icon: SlashCircle01, onClick: () => onAction("deactivate"), danger: true, hidden: !(isActive && !role.locked && staffCount > 0) },
            { label: "Reactivate", icon: RefreshCcw01, onClick: () => onAction("reactivate"), hidden: role.status !== "inactive" },
            // Roles are delete-only (policy §5, D-4) — no Archive / Recover.
            { label: "Delete", icon: Trash01, onClick: () => onAction("delete"), danger: true, hidden: !canDelete },
        ]} />
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

type StaffRowActionKind = "view" | "edit_details" | "change_role" | "assign_shift" | "account_settings" | "resend_invite" | "archive" | "deactivate" | "reactivate" | "recover" | "delete";

// Thin wrapper around the canonical `<RowActions>` — items array is
// computed here based on staff status + hasHistory, then delegated.
function StaffRowActions({ staff, hasHistory, isOwner = false, onAction }: {
    staff: Staff;
    hasHistory: boolean;
    /** Owners don't work shifts → no "Assign shift" action. */
    isOwner?: boolean;
    onAction: (kind: StaffRowActionKind) => void;
}) {
    const isPending  = staff.status === "pending";
    const isActive   = staff.status === "active";
    const isInactive = staff.status === "inactive";
    const isArchive  = staff.status === "archived";
    // Owner is the studio account holder — no lifecycle actions. Only view +
    // "Account settings" (edits the owner's details from Settings → Account, the
    // single source of truth). Client 2026-08.
    if (isOwner) {
        return (
            <RowActions items={[
                { label: "View details", icon: Eye, onClick: () => onAction("view") },
                { label: "Account settings", icon: Settings01, onClick: () => onAction("account_settings") },
            ]} />
        );
    }
    return (
        <RowActions items={[
            { label: "View details", icon: Eye, onClick: () => onAction("view") },
            { label: "Resend invitation", icon: Send01, onClick: () => onAction("resend_invite"), hidden: !isPending },
            { label: "Edit details", icon: Edit02, onClick: () => onAction("edit_details"), hidden: !isActive },
            { label: "Change role", icon: UserSquare, onClick: () => onAction("change_role"), hidden: !isActive },
            { label: "Assign shift", icon: ClockPlus, onClick: () => onAction("assign_shift"), hidden: !isActive },
            { label: "Archive", icon: Archive, onClick: () => onAction("archive"), hidden: !(isActive || isInactive) },
            { label: "Reactivate", icon: Check, onClick: () => onAction("reactivate"), hidden: !isInactive },
            { label: "Recover", icon: RefreshCcw01, onClick: () => onAction("recover"), hidden: !isArchive },
            { label: "Deactivate", icon: SlashCircle01, onClick: () => onAction("deactivate"), danger: true, hidden: !(isActive && hasHistory) },
            // Delete a history-free staff from active OR inactive (matches the
            // detail-page sidebar). Archived rows Recover first.
            { label: "Delete", icon: Trash01, onClick: () => onAction("delete"), danger: true, hidden: !((isActive || isInactive) && !hasHistory) },
        ]} />
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Table chrome ──────────────────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] sticky top-0 z-[5] bg-[var(--colors-bg-primary)] shadow-[inset_0_-1px_0_0_var(--colors-border-secondary)]";
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

// ── Cross-navigation UI cache ────────────────────────────────────────────────
// Persists the Staff & permissions toolbar/view state (tab, sub-tab, branch,
// search, role/staff filters, page, view modes) across a round-trip into a
// staff/role/shift detail and back — the page component remounts on return, so
// without this every filter would reset. Mirrors the Schedule module's
// `scheduleUi`. `?subtab` deep-links still win on arrival; the FilterPanel's
// "Clear" is the only thing that empties the filters. Client 2026-07-24.
//
// KEYED PER ROUTE — the Roles page (`forceTab="roles"`) and the Staff page
// (`forceTab="staff"`) both render this component, so a single shared cache
// would leak one route's search/filters into the other. Each route gets its own
// slot.
interface StaffUiState {
    tab: TabId;
    staffSubTab: StaffSubTab;
    branchId: string;
    search: string;
    roleFilter: RoleFilter;
    staffFilter: StaffFilter;
    page: number;
    shiftsViewMode: "list" | "week";
    timeOffViewMode: "list" | "month";
}
function defaultStaffUi(): StaffUiState {
    return {
        tab: "roles", staffSubTab: "staff", branchId: "", search: "",
        roleFilter: EMPTY_ROLE_FILTER, staffFilter: EMPTY_STAFF_FILTER,
        page: 1, shiftsViewMode: "list", timeOffViewMode: "list",
    };
}
const staffUiByRoute: Record<string, StaffUiState> = {};
function getStaffUi(key: string): StaffUiState {
    return (staffUiByRoute[key] ??= defaultStaffUi());
}
// Opening a module from the sidebar wipes the Staff toolbar caches so every
// sub-tab (Staff / Shift / Time off) reopens with fresh filters (client 2026-08).
registerFilterResetter(() => { for (const k of Object.keys(staffUiByRoute)) delete staffUiByRoute[k]; });

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
    const setRolesStatus   = useAppStore(s => s.setRolesStatus);
    const deleteRolesAction = useAppStore(s => s.deleteRoles);
    const setStaffStatus   = useAppStore(s => s.setStaffStatus);
    const deleteStaffAction = useAppStore(s => s.deleteStaff);
    const canDeleteStaff   = useAppStore(s => s.canDeleteStaff);
    // "Today's schedule" column data.
    const classSchedules   = useAppStore(s => s.classSchedules);
    const appointmentsAll  = useAppStore(s => s.appointments);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    const shifts           = useAppStore(s => s.shifts);
    const blockedTimes     = useAppStore(s => s.blockedTimes);
    // Account profile — the single source of truth for the OWNER's identity, so
    // the owner row mirrors Settings → Account (edited via the row's Account
    // settings action) instead of its stale seed record. Client 2026-08.
    const currentUser      = useAppStore(s => s.currentUser);
    const todayNow = new Date();
    const todayISO = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, "0")}-${String(todayNow.getDate()).padStart(2, "0")}`;
    const todayDow = todayNow.getDay();
    const resendStaffInvite = useAppStore(s => s.resendStaffInvite);
    const showToast        = useAppStore(s => s.showToast);

    // Per-route cache slot — Roles and Staff pages never share state.
    const staffUi = getStaffUi(forceTab ?? "combined");
    // Initial values resolve forceTab / deep-link first, then the cross-nav
    // cache, then the default — so returning from a detail restores the exact
    // view the admin left, while a fresh deep-link still wins.
    const [tab, setTab] = useState<TabId>(forceTab ?? staffUi.tab);
    const searchParams = useSearchParams();
    // Deep-link back to a specific sub-tab (e.g. edit-time-off Back → Time off).
    const initialSubTab = ((): StaffSubTab => {
        const v = searchParams?.get("subtab");
        if (v === "shift-management" || v === "blocked-time" || v === "staff") return v;
        return staffUi.staffSubTab;
    })();
    const [staffSubTab, setStaffSubTab] = useState<StaffSubTab>(initialSubTab);
    /** Shift management's filter applies the green dot to the toolbar
     *  Filter button. Lifted up so the existing toolbar code path can
     *  read it without re-subscribing inside the table component. */
    const [shiftFilterActive, setShiftFilterActive] = useState(false);
    // Per-sub-tab toolbar total, reported up by the Shift / Time-off child tabs
    // so the "Total" reads "N shifts" / "N staff" / "N time off" (client 2026-08-12).
    const [subCount, setSubCount] = useState<{ count: number; noun: string } | null>(null);
    // STABLE + idempotent — the child effects depend on this reference, and it
    // no-ops when the count/noun are unchanged. Without both, a fresh inline
    // callback each render + a new-object setState would loop forever (Maximum
    // update depth) and freeze the page. (client 2026-08-12 regression fix)
    const handleSubCount = useCallback((count: number, noun: string) => {
        setSubCount(prev => (prev && prev.count === count && prev.noun === noun) ? prev : { count, noun });
    }, []);
    const [branchId, setBranchId] = useState<string>(staffUi.branchId);
    const [search, setSearch] = useState(staffUi.search);
    const [filterOpen, setFilterOpen] = useState(false);
    // Client 2026-07-22 audit fix — inner List/Week + List/Month toggle
    // lifted UP to the sub-tab row (was inside the child tab body). One
    // state per sub-tab so switching Shifts→Time off→Shifts remembers the
    // previously picked view.
    const [shiftsViewMode,  setShiftsViewMode]  = useState<"list" | "week">(() => {
        const v = searchParams?.get("view");
        return v === "week" || v === "list" ? v : staffUi.shiftsViewMode;
    });
    const [timeOffViewMode, setTimeOffViewMode] = useState<"list" | "month">(staffUi.timeOffViewMode);
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
    // Filtered shift set pushed up from ShiftManagementTab (list view) so the
    // shared toolbar's Export emits exactly the shifts on screen.
    const [shiftExportRows, setShiftExportRows] = useState<Shift[]>([]);
    // Staff-schedule "Add shift" panel — ports the day-view flow. `assignToStaff`
    // set → the panel opens in "pick a shift for {name}" mode from a row 3-dot.
    const [staffSchedPanel, setStaffSchedPanel] = useState<{ open: boolean; assignToStaff?: { id: string; name: string } }>({ open: false });
    const [timeOffMonthCursor, setTimeOffMonthCursor] = useState<{ year: number; month: number }>(() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    });
    const [roleFilter,  setRoleFilter]  = useState<RoleFilter>(staffUi.roleFilter);
    const [staffFilter, setStaffFilter] = useState<StaffFilter>(staffUi.staffFilter);
    const [page, setPage] = useState(staffUi.page);
    const [archStaffPage, setArchStaffPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Sync the sub-tab + shift view with the sidebar deep-link (?subtab / ?view)
    // when navigating between the Staff and Shift menus on the SAME route (the
    // page stays mounted, so the initial useState above doesn't re-run).
    useEffect(() => {
        const sub = searchParams?.get("subtab");
        const view = searchParams?.get("view");
        if (sub === "staff" || sub === "shift-management" || sub === "blocked-time") setStaffSubTab(sub);
        if (view === "week" || view === "list") setShiftsViewMode(view);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
    // The Change role modal lives outside the confirm-modal flow because it
    // captures a form value (new role) rather than running a single action.
    const [changingRoleFor, setChangingRoleFor] = useState<Staff | null>(null);
    const [assignShiftStaff, setAssignShiftStaff] = useState<Staff | null>(null);
    // Bulk selection — separate sets per tab so switching tabs preserves work.
    const [selectedRoleIds,  setSelectedRoleIds]  = useState<Set<string>>(new Set());
    const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
    useBulkSelectionSignal(selectedRoleIds.size > 0 || selectedStaffIds.size > 0);
    // Bulk confirmation — fires after the floating-bar action is clicked.
    const [pendingBulk, setPendingBulk] = useState<{ entity: "role" | "staff"; kind: ConfirmKind } | null>(null);

    // Reset to page 1 when the filter/tab set changes — but NOT on the initial
    // mount, so a page restored from the cross-nav cache survives the remount.
    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) { didMountRef.current = true; return; }
        setPage(1);
    }, [tab, branchId, search, roleFilter, staffFilter]);

    // Persist the toolbar/view state to the module cache on every change so a
    // detail round-trip returns the admin to the same filtered view.
    useEffect(() => {
        staffUi.tab = tab;
        staffUi.staffSubTab = staffSubTab;
        staffUi.branchId = branchId;
        staffUi.search = search;
        staffUi.roleFilter = roleFilter;
        staffUi.staffFilter = staffFilter;
        staffUi.page = page;
        staffUi.shiftsViewMode = shiftsViewMode;
        staffUi.timeOffViewMode = timeOffViewMode;
    }, [tab, staffSubTab, branchId, search, roleFilter, staffFilter, page, shiftsViewMode, timeOffViewMode]);
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
            if (staffFilter.roleIds.length > 0 && !staffFilter.roleIds.includes(s.roleId)) return false;
            // Status pill filters only the active table; archived staff are exempt
            // — they always render in the Archived section below (policy §7).
            if (s.status !== "archived" && staffFilter.statuses.length > 0 && !staffFilter.statuses.includes(s.status)) return false;
            if (q && !s.fullName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [staff, branchId, search, staffFilter]);
    // Archived staff leave the active table → the shared Archived section (policy
    // §7). Staff keep archive; Deactivate (temporary leave) is unchanged.
    const { active: activeStaff, archived: archivedStaff } = useArchiveView(filteredStaff);

    // ─── Sort ────────────────────────────────────────────────────────────
    const ROLE_STATUS_ORDER: Record<RoleStatus, number> = { active: 0, inactive: 1, archived: 2 };
    const STAFF_STATUS_ORDER: Record<StaffStatus, number> = { active: 0, pending: 1, inactive: 2, archived: 3 };
    function branchSortName(id: string | null): string {
        if (id === null) return "All locations";
        return branches.find(b => b.id === id)?.name ?? "";
    }
    const { sorted: sortedRoles, sortKey: roleSortKey, sortDir: roleSortDir, toggle: toggleRoleSort } = useSort<Role>(filteredRoles, {
        name:    (a, b) => a.name.localeCompare(b.name),
        staffs:  (a, b) => (staffByRole.get(a.id) ?? 0) - (staffByRole.get(b.id) ?? 0),
        status:  (a, b) => ROLE_STATUS_ORDER[a.status] - ROLE_STATUS_ORDER[b.status],
    });
    const STAFF_COMPARATORS: Record<string, (a: Staff, b: Staff) => number> = {
        name:   (a, b) => a.fullName.localeCompare(b.fullName),
        role:   (a, b) => {
            const an = rolesById.get(a.roleId)?.name ?? "";
            const bn = rolesById.get(b.roleId)?.name ?? "";
            return an.localeCompare(bn);
        },
        branch: (a, b) => branchSortName(a.branchId).localeCompare(branchSortName(b.branchId)),
        status: (a, b) => STAFF_STATUS_ORDER[a.status] - STAFF_STATUS_ORDER[b.status],
    };
    const { sorted: sortedStaff, sortKey: staffSortKey, sortDir: staffSortDir, toggle: toggleStaffSort } = useSort<Staff>(activeStaff, STAFF_COMPARATORS);
    const { sorted: archSortedStaff, sortKey: archStaffSortKey, sortDir: archStaffSortDir, toggle: toggleArchStaffSort } = useSort<Staff>(archivedStaff, STAFF_COMPARATORS);

    // ─── Pagination ───────────────────────────────────────────────────────
    const rolesPages = Math.max(1, Math.ceil(sortedRoles.length / pageSize));
    const staffPages = Math.max(1, Math.ceil(sortedStaff.length / pageSize));
    const clampedPage = tab === "roles"
        ? Math.min(Math.max(1, page), rolesPages)
        : Math.min(Math.max(1, page), staffPages);
    const rolePageRows  = sortedRoles.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
    const staffPageRows = sortedStaff.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // Archived staff paginate independently of the shared roles/staff paginator.
    const archStaffPages     = Math.max(1, Math.ceil(archSortedStaff.length / pageSize));
    const clampedArchStaffPg = Math.min(Math.max(1, archStaffPage), archStaffPages);
    const pagedArchivedStaff = archSortedStaff.slice((clampedArchStaffPg - 1) * pageSize, clampedArchStaffPg * pageSize);

    // ─── Bulk-selection derived values ──────────────────────────────────
    const selectedRoleRows  = useMemo(() => roles.filter(r => selectedRoleIds.has(r.id)),  [roles, selectedRoleIds]);
    const selectedStaffRows = useMemo(() => staff.filter(s => selectedStaffIds.has(s.id)), [staff, selectedStaffIds]);

    // Roles bulk gating — Owner row (locked) is excluded from every bulk
    // operation. Delete only applies to non-locked rows with zero assigned
    // staff (same XOR rule as the row menu).
    const bulkRoleArchivable    = selectedRoleRows.some(r => !r.locked && r.status !== "archived");
    const bulkRoleReactivatable = selectedRoleRows.some(r => !r.locked && r.status === "inactive");
    const bulkRoleRecoverable   = selectedRoleRows.some(r => !r.locked && r.status === "archived");
    const bulkRoleDeletable     = selectedRoleRows.length > 0
        && selectedRoleRows.every(r => !r.locked && r.status !== "archived" && (staffByRole.get(r.id) ?? 0) === 0);

    // Staff bulk gating — Pending rows are never destructively bulkable
    // (Resend invitation is a single-row action). Delete only applies when
    // every selected row has no first-login history.
    const bulkStaffArchivable    = selectedStaffRows.some(s => s.status !== "archived" && s.status !== "pending");
    const bulkStaffReactivatable = selectedStaffRows.some(s => s.status === "inactive");
    const bulkStaffRecoverable   = selectedStaffRows.some(s => s.status === "archived");
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
    function handleAddStaff() { openStaffFormPanel({ kind: "staff", mode: "create" }); }
    // Shift export is offered ONLY on the shift-management LIST view (the Week
    // view is a staff-schedule calendar, not a shift list). `shiftExportRows` is
    // pushed up from ShiftManagementTab so it's the EXACT on-screen filtered set
    // (search + status + working-day panel), keeping export == count == toast.
    const onShiftListView = forceTab === "staff" && staffSubTab === "shift-management" && shiftsViewMode === "list";

    function buildExportData() {
        if (tab === "roles") {
            if (filteredRoles.length === 0) return null;
            return rolesExportData(filteredRoles, staffByRole);
        }
        if (onShiftListView) {
            if (shiftExportRows.length === 0) return null;
            const assignedCount = (shiftId: string) => shiftAssignments.filter(a => a.shift_id === shiftId).length;
            return shiftsExportData(shiftExportRows, id => branchName(id, branches), assignedCount);
        }
        if (filteredStaff.length === 0) return null;
        return staffExportData(filteredStaff, {
            roleName: id => rolesById.get(id)?.name ?? "",
            branchName: id => branchName(id, branches),
        });
    }
    function handleExported(fmt: "csv" | "xlsx") {
        const F = fmt.toUpperCase();
        if (tab === "roles") {
            showToast("Roles exported", `${filteredRoles.length} role${filteredRoles.length === 1 ? "" : "s"} exported to ${F}.`, "success", "check");
        } else if (onShiftListView) {
            const n = shiftExportRows.length;
            showToast("Shifts exported", `${n} shift${n === 1 ? "" : "s"} exported to ${F}.`, "success", "check");
        } else {
            showToast("Staff exported", `${filteredStaff.length} staff member${filteredStaff.length === 1 ? "" : "s"} exported to ${F}.`, "success", "check");
        }
    }

    // ─── Role actions ─────────────────────────────────────────────────────
    function handleRoleAction(role: Role, kind: RoleRowActionKind) {
        const rt = encodeURIComponent(returnTo);
        if (kind === "view")             return router.push(`/staff/roles/${role.id}?returnTo=${rt}`);
        if (kind === "edit_details")     return router.push(`/staff/roles/${role.id}/edit?returnTo=${rt}`);
        if (kind === "edit_permissions") return router.push(`/staff/roles/${role.id}/permissions/edit?returnTo=${rt}`);
        if (kind === "add_staff")        return openStaffFormPanel({ kind: "staff", mode: "create", roleId: role.id });
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
                showToast("Cannot delete", "Role has assigned staff or is locked — reassign the staff first.", "error");
            }
        } else if (kind === "archive") {
            setRolesStatus([row.id], "archived");
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
        if (role.status === "archived") return; // archived rows can't toggle directly
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
        if (kind === "edit_details")  return openStaffFormPanel({ kind: "staff", mode: "edit", id: s.id });
        if (kind === "change_role") {
            setChangingRoleFor(s);
            return;
        }
        if (kind === "assign_shift") {
            setAssignShiftStaff(s);
            return;
        }
        if (kind === "account_settings") {
            return router.push("/admin/settings/account");
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
            setStaffStatus([row.id], "archived");
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
            setRolesStatus(ids, "archived");
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
            if (blocked.length > 0) showToast("Some skipped", `${blocked.length} had assigned staff — reassign the staff first.`, "error");
        }
        setSelectedRoleIds(new Set());
        setPendingBulk(null);
    }

    function performBulkStaff(kind: ConfirmKind) {
        const rows = selectedStaffRows;
        if (rows.length === 0) { setPendingBulk(null); return; }
        const ids = rows.map(s => s.id);
        if (kind === "archive") {
            setStaffStatus(ids, "archived");
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
    function toggleAllStaffRows(rows: Staff[], checked: boolean) {
        const ids = rows.map(s => s.id);
        setSelectedStaffIds(prev => {
            const next = new Set(prev);
            if (checked) ids.forEach(id => next.add(id));
            else         ids.forEach(id => next.delete(id));
            return next;
        });
    }

    // One staff table row — rendered by BOTH the active table and the Archived
    // section (policy §7), so they stay identical from one source.
    function renderStaffRow(s: Staff) {
        const role = rolesById.get(s.roleId);
        // "Has history" = store refuses hard-delete (canDeleteStaff checks
        // payroll / schedule / rating references before allowing Delete).
        const hasHistory = !canDeleteStaff(s.id);
        const isSelected = selectedStaffIds.has(s.id);
        const isOwnerRow = role?.type === "owner";
        const cuName = `${currentUser.first_name ?? ""} ${currentUser.last_name ?? ""}`.trim();
        const disp = isOwnerRow
            ? {
                  fullName: cuName || s.fullName,
                  email: currentUser.email || s.email,
                  imageUrl: currentUser.avatar_url ?? s.imageUrl,
                  initials:
                      `${(currentUser.first_name?.[0] ?? "").toUpperCase()}${(currentUser.last_name?.[0] ?? "").toUpperCase()}` ||
                      s.initials,
                  color: s.color,
              }
            : { fullName: s.fullName, email: s.email, imageUrl: s.imageUrl, initials: s.initials, color: s.color };
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
                        <Avatar a={{ imageUrl: disp.imageUrl, initials: disp.initials, color: disp.color, name: disp.fullName }} />
                        <div className="flex flex-col">
                            <span className="text-[14px] font-medium text-[#101828]">{disp.fullName}</span>
                            <span className="text-[13px] text-[#667085]">{disp.email}</span>
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
                <td className={TD}>
                    {(() => {
                        const seenId = new Set<string>();
                        const ids: string[] = [];
                        for (const a of shiftAssignments) {
                            if (a.staff_id === s.id && !seenId.has(a.shift_id)) { seenId.add(a.shift_id); ids.push(a.shift_id); }
                        }
                        if (s.shiftId && !seenId.has(s.shiftId)) { seenId.add(s.shiftId); ids.push(s.shiftId); }
                        const seenName = new Set<string>();
                        const names: string[] = [];
                        for (const id of ids) {
                            const sh = shifts.find(x => x.id === id);
                            if (sh && sh.status === "active" && !seenName.has(sh.name)) { seenName.add(sh.name); names.push(sh.name); }
                        }
                        return names.length > 0
                            ? <span className="text-[14px] leading-5 text-[#475467]">{names.join(", ")}</span>
                            : <span className="text-[14px] leading-5 text-[#98a2b3]">—</span>;
                    })()}
                </td>
                <td className={TD}>
                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", STAFF_STATUS_BADGE[s.status])}>
                        {STAFF_STATUS_LABEL[s.status]}
                    </span>
                </td>
                <td className={TD} onClick={e => e.stopPropagation()}>
                    <StaffRowActions staff={s} hasHistory={hasHistory}
                        isOwner={role?.type === "owner"}
                        onAction={k => handleStaffAction(s, k)} />
                </td>
            </tr>
        );
    }

    // Staff table thead (checkbox + sortable headers) — shared by both tables.
    function staffThead(allChecked: boolean, someChecked: boolean, onToggleAll: (c: boolean) => void, sk: string | null, sd: typeof staffSortDir, onSort: (k: string) => void) {
        return (
            <thead>
                <tr>
                    <th className={cn(TH, "w-[44px]")}>
                        <CheckboxCell checked={allChecked} indeterminate={someChecked} onChange={onToggleAll} ariaLabel="Select all staff on this page" />
                    </th>
                    <th className={TH}><SortableHeader sortKey="name" currentSort={sk} dir={sd} onSort={onSort}>Name</SortableHeader></th>
                    <th className={cn(TH, "w-[160px]")}><SortableHeader sortKey="role" currentSort={sk} dir={sd} onSort={onSort}>Role</SortableHeader></th>
                    <th className={cn(TH, "w-[180px]")}><SortableHeader sortKey="branch" currentSort={sk} dir={sd} onSort={onSort}>Branch location</SortableHeader></th>
                    <th className={cn(TH, "w-[210px]")}>Assigned shift</th>
                    <th className={cn(TH, "w-[120px]")}><SortableHeader sortKey="status" currentSort={sk} dir={sd} onSort={onSort}>Status</SortableHeader></th>
                    <th className={cn(TH, "w-[52px]")} />
                </tr>
            </thead>
        );
    }

    // ─── Header checkbox states (current page only) ─────────────────────
    const rolePageEligibleIds = rolePageRows.filter(r => !r.locked).map(r => r.id);
    const rolesAllChecked  = rolePageEligibleIds.length > 0 && rolePageEligibleIds.every(id => selectedRoleIds.has(id));
    const rolesSomeChecked = !rolesAllChecked && rolePageEligibleIds.some(id => selectedRoleIds.has(id));
    const staffPageIds = staffPageRows.map(s => s.id);
    const staffAllChecked  = staffPageIds.length > 0 && staffPageIds.every(id => selectedStaffIds.has(id));
    const staffSomeChecked = !staffAllChecked && staffPageIds.some(id => selectedStaffIds.has(id));
    const archStaffAllChecked  = pagedArchivedStaff.length > 0 && pagedArchivedStaff.every(s => selectedStaffIds.has(s.id));
    const archStaffSomeChecked = !archStaffAllChecked && pagedArchivedStaff.some(s => selectedStaffIds.has(s.id));

    // ─── Counts for the toolbar total ─────────────────────────────────────
    // The Shift (list/week) + Time off sub-tabs report their own count/noun via
    // `subCount` — "N shifts" / "N staff" / "N time off". Staff + Roles compute here.
    const usesSubCount = forceTab === "staff"
        && (staffSubTab === "shift-management" || staffSubTab === "blocked-time")
        && subCount !== null;
    const totalCount = usesSubCount
        ? subCount!.count
        : tab === "roles" ? filteredRoles.length : activeStaff.length;
    const totalNoun = usesSubCount
        ? subCount!.noun
        : tab === "roles"
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
            : staffFilter.statuses.length > 0 || staffFilter.roleIds.length > 0;

    // When the Staff sub-tab shows archived staff, wrap the active view card +
    // Archived section in a scroll region and let each fill a viewport (like the
    // Customers module), so the active table isn't squished by the section below.
    const staffArchiveOn = tab === "staff" && (forceTab !== "staff" || staffSubTab === "staff") && archivedStaff.length > 0;

    return (
        // Match /admin/schedule: fill-to-viewport — the view card fills the
        // remaining height (flex-1 min-h-0) so the tab strip pins, the table
        // header stays sticky, and only the inner body scrolls (pagination pinned).
        <div className="flex-1 min-h-0 flex flex-col gap-6">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[14px] text-[#667085] leading-5">Total</p>
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
                    <ToolbarExport disabled={totalCount === 0} exportData={buildExportData} onExported={handleExported} />
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
                            // Roles are delete-only (no archive) — no "Archived" filter value.
                            { value: "", label: "All statuses" },
                            { value: "active",   label: ROLE_STATUS_LABEL.active },
                            { value: "inactive", label: ROLE_STATUS_LABEL.inactive },
                        ]}
                        value={roleFilter.statuses[0] ?? ""}
                        onChange={v => setRoleFilter(v ? { statuses: [v as RoleStatus] } : { statuses: [] })}
                        width="w-[180px]"
                    />
                )}
                {/* Filter button — lifted from the sub-tab row up here
                    (client 2026-07-22). Hidden on empty/placeholder
                    sub-tabs where filter has no effect. The Shift + Time off
                    sub-tabs carry no filter (client 2026-08-12) — only the
                    Staff table keeps it. */}
                {forceTab !== "roles" &&
                 (forceTab !== "staff" || staffSubTab === "staff") && (
                    <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
                )}
                {/* Import — empty-state only (client 2026-07-31). Only
                    surfaces on the STAFF sub-tab of the Staff & shift
                    route, gated on staff-list truly-empty + no active
                    search + no active filter. Skipped on Shifts / Time
                    off / Roles because those don't have a matching AI
                    Agent migration entity (shifts + blocked-time are
                    per-branch operational data, not a bulk import;
                    roles ship pre-seeded). */}
                {forceTab === "staff" && staffSubTab === "staff" && (
                    <ToolbarImportButton visible={totalCount === 0 && !search.trim() && !hasActiveFilter} />
                )}
                <AddNewMenu
                    variant={
                        forceTab === "roles"
                            ? "role-only"
                            : forceTab === "staff"
                                ? staffSubTab === "staff" || (staffSubTab === "shift-management" && shiftsViewMode === "week")
                                    ? "staff-add-only"
                                    : "shift-only"
                                : "combined"
                    }
                    onAddRole={handleAddRole}
                    onAddStaff={handleAddStaff}
                    onAddShift={() => openStaffFormPanel({ kind: "shift", mode: "create" })}
                    onAddBlockedTime={() => openStaffFormPanel({ kind: "blocked", mode: "create" })}
                />
            </div>

            {/* View-card chrome:
                  • Role & permissions route → NO bordered card, NO inner
                    padding (per the brief — Figma 7413:239946 shows the
                    table flush against the page chrome).
                  • Staff & shift route + legacy combined → bordered card with a
                    FIXED h-[760px] surface (matches /admin/schedule's view card),
                    so the tab strip pins and only the inner body scrolls while
                    the outer <main> canvas scrolls the page. */}
            {/* Scroll region — active card + Archived section each fill a viewport
                and scroll between them (Customers pattern). Only wraps when the
                Staff sub-tab has archived staff; otherwise it's a passthrough. */}
            <div className={cn(staffArchiveOn ? "flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-6" : "contents")}>
            <div className={cn(
                "relative",
                forceTab === "roles"
                    ? "flex-1 min-h-0 flex flex-col overflow-hidden"
                    : staffArchiveOn
                        ? "shrink-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden"
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
                        {forceTab === "staff" && (() => {
                            // Two sidebar menus, two in-page sections:
                            //   • Staff  → Staff · Staff Schedule (shift-management WEEK)
                            //   • Shift  → Shift (shift-management LIST) · Time off
                            const inStaffSection =
                                staffSubTab === "staff" ||
                                (staffSubTab === "shift-management" && shiftsViewMode === "week");
                            const activeKey =
                                staffSubTab === "staff"
                                    ? "staff"
                                    : staffSubTab === "blocked-time"
                                      ? "blocked-time"
                                      : shiftsViewMode === "week"
                                        ? "schedule"
                                        : "shifts";
                            const tabs = inStaffSection
                                ? [
                                      { key: "staff", label: "Staff" },
                                      { key: "schedule", label: "Staff schedule" },
                                  ]
                                : [
                                      { key: "shifts", label: "Shift" },
                                      { key: "blocked-time", label: "Time off" },
                                  ];
                            return (
                                <SegmentedTabs
                                    tabs={tabs}
                                    activeKey={activeKey}
                                    onChange={(k) => {
                                        if (k === "staff") setStaffSubTab("staff");
                                        else if (k === "schedule") {
                                            setStaffSubTab("shift-management");
                                            setShiftsViewMode("week");
                                        } else if (k === "shifts") {
                                            setStaffSubTab("shift-management");
                                            setShiftsViewMode("list");
                                        } else if (k === "blocked-time") setStaffSubTab("blocked-time");
                                    }}
                                />
                            );
                        })()}
                        <div className="flex-1" />
                        {/* Staff-schedule "+ Add shift" — day-view secondary
                            button, top-right, aligned with the tabs. */}
                        {forceTab === "staff" && staffSubTab === "shift-management" && shiftsViewMode === "week" && (
                            <Button variant="secondary" size="sm" className="relative z-10 shrink-0"
                                leftIcon={<Plus className="w-4 h-4" />}
                                onClick={() => setStaffSchedPanel({ open: true })}>
                                Add shift
                            </Button>
                        )}
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
                        {/* View toggles removed — Staff Schedule is always the Week
                            calendar, Shift is the List, and Time off is the List
                            (the month calendar now lives under Staff Schedule). */}
                    </div>
                )}

                {/* Staff-schedule (week) view keeps the scrolling container it
                    relies on — DO NOT change its behaviour. Every other sub-tab
                    (Staff table, Shift list, Time off) is a flex column so its
                    table self-scrolls with a pinned shrink-0 pagination footer at
                    the card bottom, exactly like /admin/schedule. */}
                <div className={cn(
                    forceTab === "roles"
                        ? "flex-auto min-h-0 flex flex-col relative"            // fills the card
                        : (staffSubTab === "shift-management" && shiftsViewMode === "week")
                            ? "flex-auto min-h-0 overflow-y-auto scrollbar-hide relative"
                            : "flex-auto min-h-0 flex flex-col relative",
                )}>
                {/* Shift management sub-tab — fully wired (Figma 6223:378535).
                    Reads `branchId` + `search` from the parent toolbar so
                    the location filter + search inputs above the card
                    drive this table the same way they drive the Staff
                    table. */}
                {forceTab === "staff" && staffSubTab === "shift-management" && (
                    <ShiftManagementTab
                        returnTo="/admin/staff?subtab=shift-management"
                        branchId={branchId}
                        search={search}
                        filterOpen={filterOpen}
                        onCloseFilter={() => setFilterOpen(false)}
                        onFilterStateChange={setShiftFilterActive}
                        onCountChange={handleSubCount}
                        onListChange={setShiftExportRows}
                        viewMode={shiftsViewMode}
                        weekStart={shiftsWeekStart}
                        onFlyoutOpen={() => setStaffSchedPanel({ open: false })}
                        mainPanelOpen={staffSchedPanel.open}
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
                        onCountChange={handleSubCount}
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
                    <div className={cn("flex-auto min-h-0 overflow-y-auto scrollbar-hide", forceTab !== "roles" && "px-6")}>
                        <div>
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
                                                    disabled={r.locked || r.status === "archived"}
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

                {/* Table — staff (same px-6 wrap as roles). Wrapped in a flex-1
                    scroll body so the table scrolls and the pagination below pins
                    (schedule pattern). */}
                {(forceTab !== "staff" || staffSubTab === "staff") && tab === "staff" && (
                    <div className={cn(forceTab !== "roles" && "flex-auto min-h-0 overflow-y-auto scrollbar-hide")}>
                    {staffPageRows.length === 0 ? (
                        <EmptyState
                            absolute={false} className="min-h-[400px]"
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
                        <div>
                            <table className="w-full border-collapse">
                                {staffThead(staffAllChecked, staffSomeChecked, (c) => toggleAllStaffRows(staffPageRows, c), staffSortKey, staffSortDir, toggleStaffSort)}
                                <tbody>
                                    {staffPageRows.map(renderStaffRow)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}
                    </div>
                )}

                {/* Pagination — pinned shrink-0 footer at the card bottom (schedule
                    pattern): the table scrolls above, this stays fixed. Hidden on
                    the placeholder sub-tabs since they have no rows to paginate. */}
                {(forceTab !== "staff" || staffSubTab === "staff") && (
                    // Pagination padding:
                    //   • Role & permissions route → no inner padding so it
                    //     aligns with the flush table above.
                    //   • Other routes → 24px L/R to match the card chrome.
                    <div className={cn(forceTab !== "roles" && "px-6 shrink-0")}>
                        <Pagination
                            page={clampedPage}
                            total={tab === "roles" ? filteredRoles.length : activeStaff.length}
                            pageSize={pageSize}
                            onPage={setPage}
                            onPageSize={n => { setPageSize(n); setPage(1); }}
                        />
                    </div>
                )}
                </div>
                {/* Staff-schedule "Add shift" panel — the day-view AddShiftPanel,
                    floating top-right inside the (relative) view card. */}
                {forceTab === "staff" && staffSubTab === "shift-management" && shiftsViewMode === "week" && (
                    <AddShiftPanel
                        open={staffSchedPanel.open}
                        onClose={() => setStaffSchedPanel({ open: false })}
                        shifts={shifts}
                        branchId={branchId}
                        dateISO={`${shiftsWeekStart.getFullYear()}-${String(shiftsWeekStart.getMonth() + 1).padStart(2, "0")}-${String(shiftsWeekStart.getDate()).padStart(2, "0")}`}
                        assignToStaff={staffSchedPanel.assignToStaff}
                        topClass="top-[72px]"
                    />
                )}
            </div>

            {/* ── Archived staff section (policy §7) — staff keep archive; archived
                   staff move here (Staff sub-tab only). Its own table + pagination;
                   selection shared with the active list. */}
            {tab === "staff" && (forceTab !== "staff" || staffSubTab === "staff") && (
                <ArchivedSection
                    entitySingular="staff"
                    count={archivedStaff.length}
                    pagination={
                        <Pagination
                            page={clampedArchStaffPg} total={archSortedStaff.length} pageSize={pageSize}
                            onPage={setArchStaffPage} onPageSize={n => { setPageSize(n); setArchStaffPage(1); }}
                        />
                    }
                >
                    <div className="px-6">
                        <table className="w-full border-collapse">
                            {staffThead(archStaffAllChecked, archStaffSomeChecked, (c) => toggleAllStaffRows(pagedArchivedStaff, c), archStaffSortKey, archStaffSortDir, toggleArchStaffSort)}
                            <tbody>
                                {pagedArchivedStaff.map(renderStaffRow)}
                            </tbody>
                        </table>
                    </div>
                </ArchivedSection>
            )}
            </div>{/* /scroll region (or contents passthrough) */}

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
                    <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-fit max-w-full">
                        <button type="button" onClick={() => setSelectedRoleIds(new Set())}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                            {selectedRoleRows.length} selected
                            <XClose className="w-5 h-5 text-[#667085]" />
                        </button>
                        <div className="flex items-center gap-3">
                            {/* Roles are delete-only (policy §5, D-4) — no Archive / Recover. */}
                            {bulkRoleReactivatable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<Check className="w-5 h-5 text-[#164e52]" />}
                                    onClick={() => setPendingBulk({ entity: "role", kind: "reactivate" })}>
                                    Reactivate
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
                    <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-fit max-w-full">
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
                                    leftIcon={<Check className="w-5 h-5 text-[#164e52]" />}
                                    onClick={() => setPendingBulk({ entity: "staff", kind: "reactivate" })}>
                                    Reactivate
                                </Button>
                            )}
                            {bulkStaffRecoverable && (
                                <Button variant="secondary-gray" size="sm"
                                    leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#164e52]" />}
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

            {assignShiftStaff && (
                <AssignShiftModal staff={assignShiftStaff} onClose={() => setAssignShiftStaff(null)} />
            )}
        </div>
    );
}

