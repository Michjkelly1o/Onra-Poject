"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff details (/staff/members/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references (file nzV4uBZZ4MWQAKNs6lnW0O):
//   • 6237-68806  — Branch admin / Operator / Front desk / Owner (active)
//   • 6236-397199 — Branch admin / Operator / Front desk / Owner (pending)
//   • 6711-186175 — Instructor (tab 1 — Overview)
//   • 6711-186381 — Instructor (tab 2 — Permissions)
//   • 6718-175431 — Instructor empty state (no activity)
//
// Mirrors the same chrome convention as RoleDetailPage / PayRateDetailPage:
//   • Header — h-[72px], × close + "Staff details"
//   • Body — px-6 py-6, h-[832px] flex row
//       LEFT  — w-[320px] sidebar card (avatar + metadata + actions footer)
//       MAIN  — flex-1 content card with underline tabs
//       RIGHT — w-[280px] "Internal link" card (instructor only)
//
// Pending status: sidebar actions footer ONLY shows "Resend invitation".

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, Edit02, UserSquare, Archive, RefreshCcw01, SlashCircle01,
    Trash01, Send01, ArrowUp, ArrowDown, ArrowUpRight,
    Calendar, CoinsHand, BarChartSquare02, Users01, ShoppingCart02, Package,
    Speaker01, Settings01, CreditCard02, User01, ChevronDown, ChevronUp,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import ChangeRoleModal from "@/components/staff/ChangeRoleModal";
import {
    PerformanceLineChart, AttendanceBarChart,
    type LinePoint, type AttendancePoint,
} from "@/components/staff/InstructorCharts";
import {
    useAppStore, BRANCHES,
    permissionSectionsFor,
    type Staff, type StaffStatus, type Role, type RoleType,
    type PermissionCell, type PermissionSectionSpec,
} from "@/lib/store";

// ─── Status badges ─────────────────────────────────────────────────────────

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

// ─── Confirm modal ─────────────────────────────────────────────────────────

type ConfirmKind = "archive" | "recover" | "deactivate" | "reactivate" | "delete";

const CONFIRM_CFG: Record<ConfirmKind, {
    title: (s: string) => string;
    description: () => string;
    confirmLabel: string;
    destructive: boolean;
    Icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
}> = {
    archive: {
        title: s => `Archive ${s}?`,
        description: () => "Archived staff are hidden from the default lists but kept for audit. You can recover later.",
        confirmLabel: "Archive", destructive: true,
        Icon: Archive, iconBg: "bg-[#fef3f2]", iconColor: "text-[#b42318]",
    },
    recover: {
        title: s => `Recover ${s}?`,
        description: () => "The staff member returns to Active and login is re-enabled.",
        confirmLabel: "Recover", destructive: false,
        Icon: RefreshCcw01, iconBg: "bg-[#ecfdf3]", iconColor: "text-[#067647]",
    },
    deactivate: {
        title: s => `Deactivate ${s}?`,
        description: () => "Login is disabled but all historical data is kept. You can reactivate later.",
        confirmLabel: "Deactivate", destructive: true,
        Icon: SlashCircle01, iconBg: "bg-[#fef3f2]", iconColor: "text-[#b42318]",
    },
    reactivate: {
        title: s => `Reactivate ${s}?`,
        description: () => "Login is re-enabled and the staff member returns to Active.",
        confirmLabel: "Reactivate", destructive: false,
        Icon: Check, iconBg: "bg-[#ecfdf3]", iconColor: "text-[#067647]",
    },
    delete: {
        title: s => `Delete ${s}?`,
        description: () => "This permanently removes the staff record. Only allowed when no first login has happened.",
        confirmLabel: "Delete", destructive: true,
        Icon: Trash01, iconBg: "bg-[#fef3f2]", iconColor: "text-[#b42318]",
    },
};

function ConfirmModal({ kind, subject, onCancel, onConfirm }: {
    kind: ConfirmKind; subject: string; onCancel: () => void; onConfirm: () => void;
}) {
    const cfg = CONFIRM_CFG[kind];
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", cfg.iconBg)}>
                        <cfg.Icon className={cn("w-6 h-6", cfg.iconColor)} />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{cfg.title(subject)}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description()}</p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant={cfg.destructive ? "destructive" : "primary"} size="lg" className="flex-1" onClick={onConfirm}>
                        {cfg.confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

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

// ─── Sidebar ───────────────────────────────────────────────────────────────

function Sidebar({ staff, role, payRateName, onAction }: {
    staff: Staff;
    role: Role | undefined;
    payRateName: string;
    onAction: (kind: "edit_details" | "change_role" | "resend_invite" | ConfirmKind) => void;
}) {
    const isPending  = staff.status === "pending";
    const isActive   = staff.status === "active";
    const isInactive = staff.status === "inactive";
    const isArchive  = staff.status === "archive";
    const hasHistory = staff.firstLoginCompleted;
    const branchLabel = staff.branchId === null
        ? "All locations"
        : BRANCHES.find(b => b.id === staff.branchId)?.name ?? "—";

    const tempPwMask = staff.tempPassword
        ? "•".repeat(Math.min(12, staff.tempPassword.length))
        : "••••••••••••";

    return (
        <aside className="w-[320px] shrink-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-6 flex-1">
                    {/* Avatar + status */}
                    <div className="relative">
                        <div className="w-[88px] h-[88px] rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center overflow-hidden">
                            {staff.imageUrl
                                ? <img src={staff.imageUrl} alt={staff.fullName} className="w-full h-full object-cover" />
                                : <span className="font-semibold text-[28px] text-[#475467]">{staff.initials}</span>
                            }
                        </div>
                        <div className="absolute top-0 right-0">
                            <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", STAFF_STATUS_BADGE[staff.status])}>
                                {STAFF_STATUS_LABEL[staff.status]}
                            </span>
                        </div>
                    </div>

                    {/* Name + email */}
                    <div className="flex flex-col gap-1">
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{staff.fullName}</h2>
                        <p className="text-[14px] text-[#667085]">{staff.email}</p>
                    </div>

                    {/* Metadata stack */}
                    <div className="flex flex-col gap-3">
                        <Metadata label="Joined" value={staff.joinedDate} />
                        <Metadata label="Temporary password" value={<span className="font-mono tracking-wider">{tempPwMask}</span>} />
                        <Metadata label="Phone" value={staff.phone} />
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Role</p>
                            {role
                                ? <span className={cn("inline-flex items-center self-start px-[10px] py-[2px] rounded-full text-[13px] font-medium", ROLE_TYPE_BADGE[role.type])}>
                                    {role.name}
                                  </span>
                                : <p className="text-[16px] font-medium text-[#101828]">—</p>
                            }
                        </div>
                        <Metadata label="Branch location" value={branchLabel} />
                        {role?.type === "instructor" && (
                            <Metadata label="Default pay rate" value={payRateName || "—"} />
                        )}
                    </div>
                </div>

                {/* Actions footer */}
                <div className="px-6 pb-6 pt-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Staff actions</p>
                    <div className="flex flex-col gap-4">
                        {isPending && (
                            <ActionBtn icon={<Send01 className="w-5 h-5" />} label="Resend invitation" onClick={() => onAction("resend_invite")} />
                        )}
                        {isActive && (
                            <>
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit staff details" onClick={() => onAction("edit_details")} />
                                <ActionBtn icon={<UserSquare className="w-5 h-5" />} label="Change staff role" onClick={() => onAction("change_role")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive staff" onClick={() => onAction("archive")} />
                                {hasHistory
                                    ? <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate staff" danger onClick={() => onAction("deactivate")} />
                                    : <ActionBtn icon={<Trash01 className="w-5 h-5" />}       label="Delete staff"     danger onClick={() => onAction("delete")} />
                                }
                            </>
                        )}
                        {isInactive && (
                            <>
                                <ActionBtn icon={<Check className="w-5 h-5" />} label="Reactivate staff" onClick={() => onAction("reactivate")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive staff" onClick={() => onAction("archive")} />
                                {!hasHistory && (
                                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete staff" danger onClick={() => onAction("delete")} />
                                )}
                            </>
                        )}
                        {isArchive && (
                            <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover staff" onClick={() => onAction("recover")} />
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}

function Metadata({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-medium text-[#101828]">{value}</p>
        </div>
    );
}

// ─── Internal link card (instructor only) ─────────────────────────────────

function InternalLinkCard({ staff, payRateId }: { staff: Staff; payRateId?: string }) {
    const router = useRouter();
    function go(path: string) { router.push(path); }
    return (
        <aside className="w-[280px] shrink-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-4">
                <p className="font-semibold text-[16px] leading-[24px] text-[#101828]">Internal link</p>
            </div>
            <div className="flex flex-col gap-1 px-3 pb-6">
                <LinkRow icon={<CreditCard02 className="w-5 h-5" />} label="Earnings"
                    onClick={() => go(`/admin/staff/compensation`)} />
                {payRateId && (
                    <LinkRow icon={<CoinsHand className="w-5 h-5" />} label="Pay rate"
                        onClick={() => go(`/admin/staff/pay-rate/${payRateId}`)} />
                )}
                <LinkRow icon={<Calendar className="w-5 h-5" />} label="Schedule"
                    onClick={() => go(`/admin/schedule?instructorId=${staff.id}`)} />
            </div>
        </aside>
    );
}

function LinkRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[8px] hover:bg-[#f9fafb] transition-colors text-left">
            <span className="text-[#475467] shrink-0">{icon}</span>
            <span className="flex-1 text-[14px] font-medium text-[#344054]">{label}</span>
            <ArrowUpRight className="w-4 h-4 text-[#667085] shrink-0" />
        </button>
    );
}

// ─── Tab underline button ────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                active
                    ? "border-b-2 border-[#101828] text-[#101828]"
                    : "text-[#667085] hover:text-[#344054]",
            )}>
            {label}
        </button>
    );
}

// ─── Permissions tab (same shape as RoleDetailPage) ──────────────────────

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

function PermissionSection({ section, role }: { section: PermissionSectionSpec; role: Role }) {
    const [open, setOpen] = useState(true);
    const Icon = SECTION_ICONS[section.key] ?? Users01;
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
    return (
        <div className="px-6 pb-6 flex flex-col gap-3">
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
    );
}

// ─── Overview tab (instructor) ────────────────────────────────────────────

function PerformanceMetricCard({ label, value, delta }: {
    label: string; value: string | number; delta: number; // delta as integer %
}) {
    const positive = delta >= 0;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3 flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="font-semibold text-[28px] leading-[36px] text-[#101828]">{value}</p>
            <div className="flex items-center gap-1 text-[13px]">
                {positive
                    ? <ArrowUp   className="w-3.5 h-3.5 text-[#067647]" />
                    : <ArrowDown className="w-3.5 h-3.5 text-[#b42318]" />
                }
                <span className={positive ? "text-[#067647] font-medium" : "text-[#b42318] font-medium"}>
                    {Math.abs(delta)}%
                </span>
                <span className="text-[#667085]">vs last week</span>
            </div>
        </div>
    );
}

function ChartEmptyCard({ title, emptyTitle, emptyBody }: {
    title: string; emptyTitle: string; emptyBody: string;
}) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-[14px] text-[#667085]">{title}</p>
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] h-[260px] relative flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-center px-6">
                    <BarChartSquare02 className="w-10 h-10 text-[#98a2b3]" />
                    <p className="text-[16px] font-semibold text-[#101828]">{emptyTitle}</p>
                    <p className="text-[14px] text-[#667085]">{emptyBody}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Sample chart series (Figma 7127-147606 / 147672 / 147673) ───────────
//
// Until the instructor analytics pipeline ships, the Overview tab renders
// representative weekly data — same shape the dashboard cards use. The
// labels mirror the Figma's "Feb 22 → Feb 28" range so the demo looks
// consistent across modules.

const SAMPLE_DATES = ["Feb 22", "Feb 23", "Feb 24", "Feb 25", "Feb 26", "Feb 27", "Feb 28"];

function buildRetentionSeries(): LinePoint[] {
    const values = [68, 70, 72, 75, 76, 80, 84];
    return SAMPLE_DATES.map((date, i) => ({ date, value: values[i] }));
}
function buildBookingsSeries(): LinePoint[] {
    const values = [33, 34, 35, 38, 37, 39, 42];
    return SAMPLE_DATES.map((date, i) => ({ date, value: values[i] }));
}
function buildAttendanceSeries(): AttendancePoint[] {
    const visits        = [24, 30, 15, 35, 28, 22, 24];
    const cancellations = [15, 7,  3,  5,  20, 7,  15];
    const noShow        = [4,  4,  3,  2,  10, 4,  4];
    return SAMPLE_DATES.map((date, i) => ({
        date,
        visits: visits[i],
        cancellations: cancellations[i],
        noShow: noShow[i],
    }));
}

function InstructorOverviewTab({ staff }: { staff: Staff }) {
    const classSchedule = useAppStore(s => s.classSchedules);
    const classRatings  = useAppStore(s => s.classRatings);
    const classBookings = useAppStore(s => s.classBookings);

    // Derive metrics live from the existing slices — the staff seed only
    // carries identity + role + branch, so schedule + ratings + bookings
    // are the ground truth for activity stats.
    const todayISO = new Date().toISOString().slice(0, 10);
    const myClasses = useMemo(
        () => classSchedule.filter(c => c.instructorId === staff.id),
        [classSchedule, staff.id],
    );
    const completedClasses = useMemo(() => myClasses.filter(c => c.dateISO < todayISO), [myClasses, todayISO]);
    const cancelledClasses = useMemo(() => myClasses.filter(c => c.status === "Cancelled"), [myClasses]);

    // Total students taught = sum of bookings on this instructor's classes
    // with attendanceStatus "present".
    const totalAttended = useMemo(() => {
        const myClassIds = new Set(myClasses.map(c => c.id));
        return classBookings.filter(b => myClassIds.has(b.classScheduleId) && b.attendanceStatus === "present").length;
    }, [classBookings, myClasses]);

    const attendanceRate = useMemo(() => {
        const myClassIds = new Set(completedClasses.map(c => c.id));
        const myBookings = classBookings.filter(b => myClassIds.has(b.classScheduleId));
        if (myBookings.length === 0) return 0;
        const attended = myBookings.filter(b => b.attendanceStatus === "present").length;
        return Math.round((attended / myBookings.length) * 100);
    }, [completedClasses, classBookings]);

    const ratingCount = useMemo(
        () => classRatings.filter(r => r.instructorId === staff.id).length,
        [classRatings, staff.id],
    );

    const hasAnyActivity = myClasses.length > 0 || totalAttended > 0 || ratingCount > 0;

    return (
        <div className="px-6 pb-6 flex flex-col gap-6">
            {/* Overall performance — 4 metric cards in horizontal row */}
            <div className="flex flex-col gap-3">
                <p className="text-[14px] text-[#667085]">Overall performance</p>
                <div className="grid grid-cols-4 gap-3">
                    <PerformanceMetricCard label="Classes"        value={completedClasses.length} delta={hasAnyActivity ?  3 : 0} />
                    <PerformanceMetricCard label="Attendance rate" value={`${attendanceRate}%`}    delta={hasAnyActivity ?  3 : 0} />
                    <PerformanceMetricCard label="Clients taught"  value={totalAttended}            delta={hasAnyActivity ? -2 : 0} />
                    <PerformanceMetricCard label="Cancellations"   value={cancelledClasses.length}  delta={hasAnyActivity ? -1 : 0} />
                </div>
            </div>

            {hasAnyActivity ? (
                <>
                    <PerformanceLineChart
                        title="Overall performance"
                        data={buildRetentionSeries()}
                        color="#92d1de"
                        valueLabel="Retention rate"
                        valueSuffix="%"
                    />
                    <PerformanceLineChart
                        title="Class bookings"
                        data={buildBookingsSeries()}
                        color="#92baa4"
                        valueLabel="Total booking"
                    />
                    <AttendanceBarChart
                        title="Attendance overview"
                        data={buildAttendanceSeries()}
                    />
                </>
            ) : (
                <>
                    <ChartEmptyCard
                        title="Overall performance"
                        emptyTitle="No performance found"
                        emptyBody="This instructor doesn't have any performance overview"
                    />
                    <ChartEmptyCard
                        title="Class bookings"
                        emptyTitle="No class bookings found"
                        emptyBody="This instructor doesn't have any class bookings"
                    />
                </>
            )}
        </div>
    );
}

// ─── Top-level page ───────────────────────────────────────────────────────

export interface StaffDetailPageProps {
    staffId: string;
    returnTo?: string;
}

type TabId = "overview" | "permissions";

export default function StaffDetailPage({ staffId, returnTo = "/admin/staff" }: StaffDetailPageProps) {
    const router = useRouter();
    const allStaff           = useAppStore(s => s.staff);
    const allRoles           = useAppStore(s => s.roles);
    const payRates           = useAppStore(s => s.payRates);
    const setStaffStatus     = useAppStore(s => s.setStaffStatus);
    const deleteStaffAction  = useAppStore(s => s.deleteStaff);
    const resendStaffInvite  = useAppStore(s => s.resendStaffInvite);
    const showToast          = useAppStore(s => s.showToast);

    const staff = allStaff.find(s => s.id === staffId);
    const role  = staff ? allRoles.find(r => r.id === staff.roleId) : undefined;
    const isInstructor = role?.type === "instructor";

    const [tab, setTab] = useState<TabId>("permissions");
    const [pendingConfirm, setPendingConfirm] = useState<ConfirmKind | null>(null);
    const [changeRoleOpen, setChangeRoleOpen] = useState(false);

    useEffect(() => {
        if (!staff && allStaff.length > 0) {
            showToast("Staff not found", "Returned to the staff list.", "error");
            router.push(returnTo);
        }
    }, [staff, allStaff.length, router, returnTo, showToast]);

    useEffect(() => {
        if (isInstructor) setTab("overview");
        else              setTab("permissions");
    }, [isInstructor]);

    if (!staff) {
        return (
            <div className="h-screen bg-white flex flex-col">
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button type="button" onClick={() => router.push(returnTo)}
                        aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Staff details</h1>
                </div>
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="relative w-full max-w-[480px]" style={{ minHeight: 320 }}>
                        <EmptyState title="Loading…" subtitle="Fetching staff details." />
                    </div>
                </div>
                <Toast />
            </div>
        );
    }

    const payRate = staff.payRateId ? payRates.find(p => p.id === staff.payRateId) : undefined;
    const payRateName = payRate?.name ?? "";

    function handleResend() {
        const ok = resendStaffInvite(staff!.id);
        if (ok) showToast("Invitation sent", `Invite resent to ${staff!.email}.`, "success", "check");
        else    showToast("Cannot resend", "This staff member has already signed in.", "error");
    }
    function performConfirm(kind: ConfirmKind) {
        if (!staff) return;
        const subject = `"${staff.fullName}"`;
        if (kind === "archive") {
            setStaffStatus([staff.id], "archive");
            showToast("Staff archived", `${subject} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setStaffStatus([staff.id], "active");
            showToast("Staff recovered", `${subject} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            setStaffStatus([staff.id], "inactive");
            showToast("Staff deactivated", `${subject} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            setStaffStatus([staff.id], "active");
            showToast("Staff reactivated", `${subject} restored to Active.`, "success", "check");
        } else if (kind === "delete") {
            const { deleted, blocked } = deleteStaffAction([staff.id]);
            if (deleted.length > 0) {
                showToast("Staff deleted", `${subject} permanently removed.`, "success", "trash");
                setPendingConfirm(null);
                router.push(returnTo);
                return;
            }
            if (blocked.length > 0) {
                showToast("Cannot delete", "Staff has historical records — archive instead.", "error");
            }
        }
        setPendingConfirm(null);
    }
    function handleSidebarAction(kind: "edit_details" | "change_role" | "resend_invite" | ConfirmKind) {
        if (kind === "edit_details")  return router.push(`/staff/members/${staff!.id}/edit?returnTo=/staff/members/${staff!.id}`);
        if (kind === "change_role")   return setChangeRoleOpen(true);
        if (kind === "resend_invite") return handleResend();
        setPendingConfirm(kind);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Staff details</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    <Sidebar
                        staff={staff}
                        role={role}
                        payRateName={payRateName}
                        onAction={handleSidebarAction}
                    />

                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px]">
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <div className="flex gap-1">
                                {isInstructor && (
                                    <TabBtn label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
                                )}
                                <TabBtn label="Permissions" active={tab === "permissions"} onClick={() => setTab("permissions")} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                            {!role ? (
                                <div className="px-6 pb-6 relative" style={{ minHeight: 320 }}>
                                    <EmptyState title="Role missing" subtitle="The role assigned to this staff member is no longer available." />
                                </div>
                            ) : tab === "overview" && isInstructor ? (
                                <InstructorOverviewTab staff={staff} />
                            ) : (
                                <PermissionsTab role={role} />
                            )}
                        </div>
                    </div>

                    {isInstructor && (
                        <InternalLinkCard staff={staff} payRateId={staff.payRateId} />
                    )}
                </div>
            </div>

            {pendingConfirm && (
                <ConfirmModal
                    kind={pendingConfirm}
                    subject={`"${staff.fullName}"`}
                    onCancel={() => setPendingConfirm(null)}
                    onConfirm={() => performConfirm(pendingConfirm)}
                />
            )}

            {changeRoleOpen && (
                <ChangeRoleModal
                    staff={staff}
                    onCancel={() => setChangeRoleOpen(false)}
                    onConfirmed={newRoleName => {
                        showToast("Role updated", `${staff.fullName} is now ${newRoleName}.`, "success", "check");
                        setChangeRoleOpen(false);
                    }}
                />
            )}

            <Toast />
        </div>
    );
}
