"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — User role details (/staff/roles/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references (file nzV4uBZZ4MWQAKNs6lnW0O):
//   • 6224-328812 — Permissions tab
//   • 6223-391871 — Staff list tab
//
// Mirrors the chrome of [PayRateDetailPage](PayRateDetailPage.tsx):
//   • Header — h-[72px], × close + "User role details"
//   • Body  — px-6 py-6, two-column flex w/ h-[832px]
//   • Sidebar — w-[320px] single card: DecorativeBanner + status badge top-
//               right, then scrollable name/description/metadata, then
//               divider + "Role actions" footer
//   • Right card — flex-1 white card with underline tabs (Permissions |
//                  Staff list)

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    XClose, ChevronLeft, ChevronDown, ChevronUp, User01, Check,
    Edit02, UserSquare, Archive, RefreshCcw01, SlashCircle01, Trash01, Trash02,
    UserPlus01, SearchMd, DotsVertical, Eye, Send01,
    BarChartSquare02, Calendar, ShoppingCart02, Package, Speaker01,
    Users01, Settings01, CreditCard02, CoinsHand,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { NeutralAvatar } from "@/components/patterns/NeutralAvatar";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { DetailPageTabs } from "@/components/patterns/DetailPageTabs";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DecorativeBanner, BANNER_TINTS } from "@/components/products/DecorativeBanner";
import ChangeRoleModal from "@/components/staff/ChangeRoleModal";
import {
    useAppStore,
    permissionSectionsFor,
    type Role, type RoleStatus, type RoleType,
    type Staff, type StaffStatus,
    type PermissionCell, type PermissionSectionSpec, type Branch,
} from "@/lib/store";
import { Sliders } from "@/components/icons/Sliders";

// ─── Tokens — status badges + role-type badge colors ──────────────────────

const ROLE_STATUS_LABEL: Record<RoleStatus, string> = {
    active: "Active", inactive: "Inactive", archive: "Archive",
};
const ROLE_STATUS_BADGE: Record<RoleStatus, string> = {
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

const ROLE_TYPE_BADGE: Record<RoleType, string> = {
    owner:        "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    branch_admin: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    operator:     "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    front_desk:   "bg-[#fdf2fa] border-1 border-[#fcceee] text-[#c11574]",
    instructor:   "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
};

// ─── Confirm modal (shared with PayRateDetailPage chrome) ─────────────────

type ConfirmKind = "archive" | "recover" | "deactivate" | "reactivate" | "delete";

const CONFIRM_CFG: Record<ConfirmKind, {
    title: (s: string) => string;
    description: (s: string) => string;
    confirmLabel: string;
    destructive: boolean;
    Icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
}> = {
    archive: {
        title: s => `Archive ${s}?`,
        description: () => "Archived records are hidden from the default lists but kept for audit. You can recover later.",
        confirmLabel: "Archive", destructive: false,
        Icon: Archive, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
    recover: {
        title: s => `Recover ${s}?`,
        description: () => "The record returns to Active and becomes assignable again.",
        confirmLabel: "Recover", destructive: false,
        Icon: RefreshCcw01, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
    deactivate: {
        title: s => `Deactivate ${s}?`,
        description: () => "The record is disabled but kept for historical reference. You can reactivate later.",
        confirmLabel: "Deactivate", destructive: true,
        Icon: SlashCircle01, iconBg: "bg-[#fee4e2]", iconColor: "text-[#d92d20]",
    },
    reactivate: {
        title: s => `Reactivate ${s}?`,
        description: () => "The record returns to Active and becomes assignable again.",
        confirmLabel: "Reactivate", destructive: false,
        Icon: Check, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
    delete: {
        title: s => `Delete ${s}?`,
        description: () => "This permanently removes the record. Only allowed when no history is attached.",
        confirmLabel: "Delete", destructive: true,
        Icon: Trash01, iconBg: "bg-[#fee4e2]", iconColor: "text-[#d92d20]",
    },
};

// Local ConfirmModal removed — call sites use the canonical
// `<ConfirmModal>` from `@/components/modals/ConfirmModal`, driven by
// the CONFIRM_CFG lookup above.

// ─── Sidebar action button (matches PayRateDetailPage) ────────────────────

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

// ─── Sidebar ───────────────────────────────────────────────────────────────

function Sidebar({ role, totalStaffs, onAction }: {
    role: Role;
    totalStaffs: number;
    onAction: (kind: "add_staff" | "edit_details" | "edit_permissions" | ConfirmKind) => void;
}) {
    const isActive  = role.status === "active";
    const isInactive = role.status === "inactive";
    const isArchive = role.status === "archive";
    const isLocked  = role.locked;
    const canDelete = !isLocked && !isArchive && totalStaffs === 0;

    return (
        <aside className="w-[320px] shrink-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            {/* Banner — sage tint matches the role avatar chrome used everywhere
                else in this module (form preview, list cells). */}
            <div className="relative shrink-0">
                <DecorativeBanner bannerHeight={156} iconBox={72} icon={User01} {...BANNER_TINTS.package} />
                <div className="absolute top-3 right-3">
                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", ROLE_STATUS_BADGE[role.status])}>
                        {ROLE_STATUS_LABEL[role.status]}
                    </span>
                </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <div className="flex flex-col gap-1">
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{role.name}</h2>
                        <p className="text-[14px] text-[#667085] leading-[20px]">{role.description || "—"}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Total staffs</p>
                            <p className="text-[16px] font-medium text-[#101828]">{totalStaffs} {totalStaffs === 1 ? "staff" : "staff"}</p>
                        </div>
                        {isLocked && (
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Access</p>
                                <p className="text-[16px] font-medium text-[#101828]">System-managed</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions footer */}
                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Role actions</p>
                    <div className="flex flex-col gap-4">
                        {/* Active non-locked → full action set */}
                        {isActive && !isLocked && (
                            <>
                                <ActionBtn icon={<UserPlus01 className="w-5 h-5" />} label="Add staff" onClick={() => onAction("add_staff")} />
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit details" onClick={() => onAction("edit_details")} />
                                <ActionBtn icon={<UserSquare className="w-5 h-5" />} label="Edit permissions" onClick={() => onAction("edit_permissions")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive role" onClick={() => onAction("archive")} />
                                {canDelete
                                    ? <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete role" danger onClick={() => onAction("delete")} />
                                    : <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate role" danger onClick={() => onAction("deactivate")} />
                                }
                            </>
                        )}
                        {/* Inactive non-locked → reactivate + archive (+ delete if 0 staff) */}
                        {isInactive && !isLocked && (
                            <>
                                <ActionBtn icon={<Check className="w-5 h-5" />} label="Reactivate role" onClick={() => onAction("reactivate")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive role" onClick={() => onAction("archive")} />
                                {canDelete && (
                                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete role" danger onClick={() => onAction("delete")} />
                                )}
                            </>
                        )}
                        {/* Archived → recover only */}
                        {isArchive && (
                            <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover role" onClick={() => onAction("recover")} />
                        )}
                        {/* Locked Owner → note */}
                        {isLocked && (
                            <p className="text-[14px] text-[#667085] leading-[20px]">
                                The Owner role is system-managed and cannot be edited, archived, or deleted.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}

// Local TabBtn removed — uses canonical `<DetailPageTabs>` from
// `@/components/patterns/DetailPageTabs`.

// ─── Permissions tab — Grant limits + collapsible matrix ─────────────────

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    dashboard:    BarChartSquare02,
    classes:      Calendar,
    bookings:     Users01,
    pos:          ShoppingCart02,
    products:     Package,
    marketing:    Speaker01,
    customers:    Users01,
    reports:      BarChartSquare02,
    staff:        Users01,
    settings:     Settings01,
    schedule:     Calendar,
    earnings:     CreditCard02,
    notification: CoinsHand,
    profile:      User01,
};

function PermissionCellView({ value, ariaLabel }: { value: PermissionCell; ariaLabel: string }) {
    if (value === "na" || value === false) {
        return <span className="text-[14px] text-[#98a2b3]" aria-label={`${ariaLabel}: not applicable`}>—</span>;
    }
    return <Check className="w-4 h-4 text-[#067647] inline-block" aria-label={ariaLabel} />;
}

function PermissionSection({ section, role, defaultOpen = true }: {
    section: PermissionSectionSpec; role: Role; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const Icon = SECTION_ICONS[section.key] ?? Users01;
    // Top-level rows in Figma (Dashboard) have no chevron — only multi-row
    // sections are collapsible. Heuristic: a section with 1 row + the same
    // label as its single module renders flat.
    const isFlat = section.modules.length === 1 && section.modules[0].label === section.label;

    if (isFlat) {
        const mod = section.modules[0];
        const cellRow = role.permissions[section.key]?.[mod.key] ?? { create: "na", edit: "na", delete: "na", view: "na" };
        return (
            <tr className="hover:bg-[#f9fafb] transition-colors">
                <td className="px-4 py-3 border-b border-[#f2f4f7]">
                    <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-[#475467] shrink-0" />
                        <span className="text-[14px] text-[#344054]">{section.label}</span>
                    </div>
                </td>
                {(["create", "edit", "delete", "view"] as const).map(action => (
                    <td key={action} className="px-4 py-3 border-b border-[#f2f4f7] text-center">
                        <div className="flex items-center justify-center">
                            <PermissionCellView value={cellRow[action]} ariaLabel={`${section.label} / ${action}`} />
                        </div>
                    </td>
                ))}
            </tr>
        );
    }

    return (
        <>
            <tr className="bg-white">
                <td colSpan={5} className="px-4 py-3 border-b border-[#f2f4f7]">
                    <button type="button" onClick={() => setOpen(p => !p)}
                        className="flex items-center gap-2 w-full text-left">
                        {open
                            ? <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />
                            : <ChevronUp   className="w-4 h-4 text-[#667085] shrink-0 rotate-180" />
                        }
                        <Icon className="w-5 h-5 text-[#475467] shrink-0" />
                        <span className="text-[14px] font-semibold text-[#101828]">{section.label}</span>
                    </button>
                </td>
            </tr>
            {open && section.modules.map(mod => {
                const cellRow = role.permissions[section.key]?.[mod.key] ?? { create: "na", edit: "na", delete: "na", view: "na" };
                return (
                    <tr key={mod.key} className="hover:bg-[#f9fafb] transition-colors">
                        <td className="px-4 py-3 text-[14px] text-[#344054] border-b border-[#f2f4f7] pl-[60px]">{mod.label}</td>
                        {(["create", "edit", "delete", "view"] as const).map(action => (
                            <td key={action} className="px-4 py-3 border-b border-[#f2f4f7] text-center">
                                <div className="flex items-center justify-center">
                                    <PermissionCellView value={cellRow[action]} ariaLabel={`${section.label} / ${mod.label} / ${action}`} />
                                </div>
                            </td>
                        ))}
                    </tr>
                );
            })}
        </>
    );
}

function PermissionsTab({ role }: { role: Role }) {
    const sections = permissionSectionsFor(role.type);
    const gl = role.grantLimits;
    return (
        <div className="px-6 pb-6 flex flex-col gap-6">
            {gl.enabled && (
                <div className="flex flex-col gap-3">
                    <p className="text-[14px] text-[#667085]">Grant limits</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] px-5 py-4 flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Total spent</p>
                            <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">
                                {gl.unlimited ? "Unlimited" : (gl.grants_per_month ?? 0)}
                            </p>
                        </div>
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] px-5 py-4 flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Max value per grant</p>
                            <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">
                                {gl.unlimited ? "Unlimited" : `AED ${(gl.max_grant_value_aed ?? 0).toLocaleString("en-US")}`}
                            </p>
                        </div>
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] px-5 py-4 flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Remove unused grants</p>
                            <p className="font-semibold text-[24px] leading-[32px] text-[#101828]">
                                {gl.allow_remove_unused ? "Yes" : "No"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <p className="text-[14px] text-[#667085]">Permissions</p>
                <div className="w-full border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead className="bg-[#f9fafb]">
                            <tr>
                                <th className="text-left px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]">Module / Action</th>
                                <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">Create</th>
                                <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">Edit</th>
                                <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">Delete</th>
                                <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">View</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sections.map(section => (
                                <PermissionSection key={section.key} section={section} role={role} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Staff list tab — gift-card bulk-action pattern ──────────────────────

type StaffStatusFilter = StaffStatus | null;
const STATUS_FILTER_OPTIONS: { value: StaffStatus; label: string }[] = [
    { value: "active",   label: "Active"   },
    { value: "pending",  label: "Pending"  },
    { value: "inactive", label: "Inactive" },
    { value: "archive",  label: "Archive"  },
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
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[160px]">
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
                "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]"
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" /> : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// Thin wrapper around the canonical `<NeutralAvatar>` — kept so the
// existing call sites that pass `staff` don't change.
function StaffAvatar({ staff }: { staff: Staff }) {
    return <NeutralAvatar initials={staff.initials} imageUrl={staff.imageUrl} />;
}

type StaffRowAction = "view" | "edit_details" | "change_role" | "resend_invite" | "archive" | "recover" | "deactivate" | "reactivate" | "delete";

// Local StaffRowMenu removed — uses canonical `<RowActions>` from
// `@/components/patterns/RowActions`.

// Local PaginationFooter removed — uses canonical `@/components/ui/Pagination`
// with `variant="compact"` + `pageSizeOptions={[10, 20, 50]}`.

type BulkKind = "archive" | "deactivate" | "reactivate" | "recover" | "delete";

function StaffListTab({ role, onChangeRoleFor }: {
    role: Role;
    onChangeRoleFor: (s: Staff) => void;
}) {
    const router = useRouter();
    const allStaff           = useAppStore(s => s.staff);
    const branches           = useAppStore(s => s.branches);
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

    // Roles are branch-agnostic — this role's staff span every branch (each
    // row shows its own branch in the table). Filter purely by role.
    const scoped = useMemo(
        () => allStaff.filter(s => s.roleId === role.id),
        [allStaff, role.id],
    );
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

    // Sort state — clickable column headers cycle desc → asc → off.
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

    useEffect(() => { setPage(1); }, [search, statusFilter, role.id]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = filtered.slice((clamped - 1) * pageSize, clamped * pageSize);
    const pageIds  = pageRows.map(r => r.id);
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

    function hasHistory(s: Staff): boolean { return !canDeleteStaff(s.id); }

    function handleAction(s: Staff, kind: StaffRowAction) {
        if (kind === "view")          return router.push(`/staff/members/${s.id}?returnTo=/staff/roles/${role.id}`);
        if (kind === "edit_details")  return router.push(`/staff/members/${s.id}/edit?returnTo=/staff/roles/${role.id}`);
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
        }
        setPending(null);
    }

    // Selected rows that actually exist in the live scoped list — guards
    // against stale ids after a status flip removes them from the page.
    const selectedRows = useMemo(
        () => scoped.filter(s => selectedIds.has(s.id)),
        [scoped, selectedIds],
    );
    const selectionCount = selectedRows.length;
    const hasArchivable    = selectedRows.some(s => s.status !== "archive");
    const hasReactivatable = selectedRows.some(s => s.status === "inactive");
    const hasRecoverable   = selectedRows.some(s => s.status === "archive");
    // Delete is offered when every selected staff has no history. Otherwise
    // the secondary destructive becomes Deactivate (same XOR rule as the
    // /admin/staff list and the gift-card module).
    const allDeletable = selectionCount > 0 && selectedRows.every(s => !hasHistory(s) && s.status !== "archive");

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

    function clearSelection() { setSelectedIds(new Set()); }

    return (
        <div className="px-6 pb-6 flex flex-col gap-4">
            {/* Toolbar — "Total / N staffs" left, search + filter right */}
            <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="flex flex-col">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">{scoped.length} {scoped.length === 1 ? "staff" : "staff"}</p>
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
                        subtitle="Add staff to this role from the role actions panel on the left."
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
                    {/* No outer border — divider lines only, mirroring the
                        gift-card list. The wrapper just gives the table a
                        horizontal scroll affordance on narrow viewports. */}
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
                                    const branch = s.branchId === null ? "All locations" : branches.find(b => b.id === s.branchId)?.name ?? "—";
                                    return (
                                        <tr key={s.id}
                                            onClick={() => handleAction(s, "view")}
                                            className={cn(
                                                "transition-colors cursor-pointer",
                                                isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                                            )}>
                                            <td className={TD} onClick={e => e.stopPropagation()}>
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
                                                <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", ROLE_TYPE_BADGE[role.type])}>
                                                    {role.name}
                                                </span>
                                            </td>
                                            <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{branch}</td>
                                            <td className={TD}>
                                                <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", STAFF_STATUS_BADGE[s.status])}>
                                                    {STAFF_STATUS_LABEL[s.status]}
                                                </span>
                                            </td>
                                            <td className={TD} onClick={e => e.stopPropagation()}>
                                                <RowActions
                                                    items={[
                                                        { label: "View details",      icon: Eye,           onClick: () => handleAction(s, "view") },
                                                        { label: "Resend invitation", icon: Send01,        onClick: () => handleAction(s, "resend_invite"), hidden: s.status !== "pending" },
                                                        { label: "Edit details",      icon: Edit02,        onClick: () => handleAction(s, "edit_details"),  hidden: s.status !== "active" },
                                                        { label: "Change role",       icon: UserSquare,    onClick: () => handleAction(s, "change_role"),   hidden: s.status !== "active" },
                                                        { label: "Archive",           icon: Archive,       onClick: () => handleAction(s, "archive"),       hidden: !(s.status === "active" || s.status === "inactive") },
                                                        { label: "Reactivate",        icon: Check,         onClick: () => handleAction(s, "reactivate"),    hidden: s.status !== "inactive" },
                                                        { label: "Recover",           icon: RefreshCcw01,  onClick: () => handleAction(s, "recover"),       hidden: s.status !== "archive" },
                                                        { label: "Deactivate",        icon: SlashCircle01, onClick: () => handleAction(s, "deactivate"),    danger: true, hidden: !(s.status === "active" && hasHistory(s)) },
                                                        { label: "Delete",            icon: Trash01,       onClick: () => handleAction(s, "delete"),        danger: true, hidden: !(s.status === "active" && !hasHistory(s)) },
                                                        { label: "Delete",            icon: Trash01,       onClick: () => handleAction(s, "delete"),        danger: true, hidden: !(s.status === "inactive" && !hasHistory(s)) },
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

            {/* Per-row confirm */}
            {pending && (() => {
                const cfg = CONFIRM_CFG[pending.kind];
                const subject = `"${pending.row.fullName}"`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPending(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description(subject)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performConfirm(pending)}
                    />
                );
            })()}

            {/* Bulk confirm */}
            {bulkPending && (() => {
                const cfg = CONFIRM_CFG[bulkPending];
                const subject = `${selectionCount} ${selectionCount === 1 ? "staff" : "staff"}`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setBulkPending(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description(subject)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performBulk(bulkPending)}
                    />
                );
            })()}

            {/* Floating bulk-action bar — same chrome as the gift-card list */}
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

// ─── Top-level page ───────────────────────────────────────────────────────

export interface RoleDetailPageProps {
    roleId: string;
    returnTo?: string;
}

type TabId = "permissions" | "staff";

export default function RoleDetailPage({ roleId, returnTo = "/admin/staff" }: RoleDetailPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const roles            = useAppStore(s => s.roles);
    const staff            = useAppStore(s => s.staff);
    const branches         = useAppStore(s => s.branches);
    const setRolesStatus   = useAppStore(s => s.setRolesStatus);
    const deleteRolesAction = useAppStore(s => s.deleteRoles);
    const showToast        = useAppStore(s => s.showToast);

    const role = roles.find(r => r.id === roleId);
    const [tab, setTab] = useState<TabId>("permissions");
    const [sidebarConfirm, setSidebarConfirm] = useState<ConfirmKind | null>(null);
    const [changingRoleFor, setChangingRoleFor] = useState<Staff | null>(null);

    useEffect(() => {
        if (!role && roles.length > 0) {
            showToast("Role not found", "Returned to the staff list.", "error");
            router.push(returnTo);
        }
    }, [role, roles.length, router, returnTo, showToast]);

    // Roles are branch-agnostic — count every staffer on this role (across
    // all branches) for the sidebar total + delete-gate.
    const staffOnRole = useMemo(
        () => role ? staff.filter(s => s.roleId === role.id) : [],
        [staff, role],
    );

    if (!role) {
        return (
            <div className="h-screen bg-white flex flex-col">
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button type="button" onClick={() => router.push(returnTo)}
                        aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">User role details</h1>
                </div>
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="relative w-full max-w-[480px]" style={{ minHeight: 320 }}>
                        <EmptyState title="Loading…" subtitle="Fetching role details." />
                    </div>
                </div>
                <Toast />
            </div>
        );
    }

    function handleSidebarAction(kind: "add_staff" | "edit_details" | "edit_permissions" | ConfirmKind) {
        if (!role) return;
        if (kind === "add_staff")        return router.push(`/staff/members/new?roleId=${role.id}&returnTo=/staff/roles/${role.id}`);
        if (kind === "edit_details")     return router.push(`/staff/roles/${role.id}/edit?returnTo=${encodeURIComponent(pathname)}`);
        if (kind === "edit_permissions") return router.push(`/staff/roles/${role.id}/permissions/edit?returnTo=${encodeURIComponent(pathname)}`);
        setSidebarConfirm(kind);
    }
    function performSidebarConfirm(kind: ConfirmKind) {
        if (!role) return;
        const subject = `"${role.name}"`;
        if (kind === "archive") {
            setRolesStatus([role.id], "archive");
            showToast("Role archived", `${subject} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setRolesStatus([role.id], "active");
            showToast("Role recovered", `${subject} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            setRolesStatus([role.id], "inactive");
            showToast("Role deactivated", `${subject} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setRolesStatus([role.id], "active");
            showToast("Role reactivated", `${subject} restored to Active.`, "success", "check");
        } else if (kind === "delete") {
            const { deleted, blocked } = deleteRolesAction([role.id]);
            if (deleted.length > 0) {
                showToast("Role deleted", `${subject} permanently removed.`, "success", "trash");
                setSidebarConfirm(null);
                router.push(returnTo);
                return;
            }
            if (blocked.length > 0) {
                showToast("Cannot delete", "Role has assigned staff — reassign first.", "error");
            }
        }
        setSidebarConfirm(null);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">User role details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body — canonical DetailPageShell wraps the px-6 py-6 outer +
                h-[832px] two-column frame. Content card chrome is per-page
                and stays inline here. */}
            <DetailPageShell
                sidebar={<Sidebar role={role} totalStaffs={staffOnRole.length} onAction={handleSidebarAction} />}
                main={
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px]">
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <DetailPageTabs
                                tabs={[
                                    { key: "permissions", label: "Permissions" },
                                    { key: "staff", label: "Staff list" },
                                ]}
                                activeKey={tab}
                                onChange={(k) => setTab(k as typeof tab)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                            {tab === "permissions"
                                ? <PermissionsTab role={role} />
                                : <StaffListTab role={role} onChangeRoleFor={setChangingRoleFor} />
                            }
                        </div>
                    </div>
                }
            />

            {sidebarConfirm && (() => {
                const cfg = CONFIRM_CFG[sidebarConfirm];
                const subject = `"${role.name}"`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setSidebarConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description(subject)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performSidebarConfirm(sidebarConfirm)}
                    />
                );
            })()}

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
