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
import { openStaffFormPanel } from "@/lib/staff-form-panel";
import { AssignShiftModal } from "@/components/staff/AssignShiftModal";
import {
    XClose, Check, Edit02, UserSquare, Archive, RefreshCcw01, SlashCircle01,
    Trash01, Send01, ClockPlus, ArrowUp, ArrowDown, ArrowUpRight,
    Calendar, CoinsHand, BarChartSquare02, Users01, ShoppingCart02, Package,
    Speaker01, Settings01, CreditCard02, User01, ChevronDown, ChevronUp,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { DetailPageTabs } from "@/components/patterns/DetailPageTabs";
import ChangeRoleModal from "@/components/staff/ChangeRoleModal";
import {
    PerformanceLineChart, AttendanceBarChart,
    type LinePoint, type AttendancePoint,
} from "@/components/staff/InstructorCharts";
import {
    useAppStore,
    permissionSectionsFor,
    type Staff, type StaffStatus, type Role, type RoleType,
    type PermissionCell, type PermissionSectionSpec, type Branch, type PayRate, type BusinessHours,
} from "@/lib/store";

// ─── Status badges ─────────────────────────────────────────────────────────

const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
    pending: "Pending", active: "Active", inactive: "Inactive", archived: "Archive",
};
const STAFF_STATUS_BADGE: Record<StaffStatus, string> = {
    pending:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    active:   "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    inactive: "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
    archived:  "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
};
const ROLE_TYPE_BADGE: Record<RoleType, string> = {
    owner:        "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    branch_admin: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    operator:     "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    front_desk:   "bg-[#fdf2fa] border-1 border-[#fcceee] text-[#c11574]",
    instructor:   "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    attendees:    "bg-[#ecfeff] border-1 border-[#a5f0fc] text-[#0e7090]",
};

// ─── Confirm modal ─────────────────────────────────────────────────────────

type ConfirmKind = "archive" | "recover" | "deactivate" | "reactivate" | "delete";
type SidebarActionKind = "edit_details" | "change_role" | "resend_invite" | "assign_shift" | "account_settings" | ConfirmKind;
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
        description: "Archived staff are hidden from the default lists but kept for audit. You can recover later.",
        confirmLabel: "Archive", tone: "success", Icon: Archive,
    },
    recover: {
        title: s => `Recover ${s}?`,
        description: "The staff member returns to Active and login is re-enabled.",
        confirmLabel: "Recover", tone: "success", Icon: RefreshCcw01,
    },
    deactivate: {
        title: s => `Deactivate ${s}?`,
        description: "Login is disabled but all historical data is kept. You can reactivate later.",
        confirmLabel: "Deactivate", tone: "danger", Icon: SlashCircle01,
    },
    reactivate: {
        title: s => `Reactivate ${s}?`,
        description: "Login is re-enabled and the staff member returns to Active.",
        confirmLabel: "Reactivate", tone: "success", Icon: Check,
    },
    delete: {
        title: s => `Delete ${s}?`,
        description: "This permanently removes the staff record. Only allowed when no first login has happened.",
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
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[var(--colors-text-tertiary)] hover:text-[var(--colors-text-secondary)]",
            )}>
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────

function Sidebar({ staff, role, payRateName, onAction, branches, hasHistory, isOwner }: {
    staff: Staff;
    role: Role | undefined;
    payRateName: string;
    onAction: (kind: SidebarActionKind) => void;
    branches: Branch[];
    hasHistory: boolean;
    isOwner: boolean;
}) {
    const isPending  = staff.status === "pending";
    const isActive   = staff.status === "active";
    const isInactive = staff.status === "inactive";
    const isArchive  = staff.status === "archived";
    const branchLabel = staff.branchId === null
        ? "All locations"
        : branches.find(b => b.id === staff.branchId)?.name ?? "—";

    const tempPwMask = staff.tempPassword
        ? "•".repeat(Math.min(12, staff.tempPassword.length))
        : "••••••••••••";

    return (
        <aside className="w-[320px] shrink-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1">
                <div className="flex flex-col gap-5 px-6 pt-6 flex-1">
                    {/* Avatar + status */}
                    <div className="relative">
                        <div className="w-[88px] h-[88px] rounded-full bg-[var(--colors-bg-tertiary)] border-1 border-[var(--colors-border-secondary)] flex items-center justify-center overflow-hidden">
                            {staff.imageUrl
                                ? <img src={staff.imageUrl} alt={staff.fullName} className="w-full h-full object-cover" />
                                : <span className="font-semibold text-[28px] text-[var(--colors-text-tertiary)]">{staff.initials}</span>
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
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">{staff.fullName}</h2>
                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">{staff.email}</p>
                    </div>

                    {/* Metadata stack */}
                    <div className="flex flex-col gap-3">
                        <Metadata label="Joined" value={staff.joinedDate} />
                        <Metadata label="Temporary password" value={<span className="font-mono tracking-wider">{tempPwMask}</span>} />
                        <Metadata label="Phone" value={staff.phone} />
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[var(--colors-text-quaternary)]">Role</p>
                            {role
                                ? <span className={cn("inline-flex items-center self-start px-[10px] py-[2px] rounded-full text-[13px] font-medium", ROLE_TYPE_BADGE[role.type])}>
                                    {role.name}
                                  </span>
                                : <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">—</p>
                            }
                        </div>
                        <Metadata label="Branch location" value={branchLabel} />
                        {/* Default pay rate — shown for ALL roles (client
                            2026-07-24), matching the instructor side menu. */}
                        <Metadata label="Default pay rate" value={payRateName || "—"} />
                    </div>
                </div>

                {/* Actions footer */}
                <div className="px-6 pb-6 pt-6 shrink-0">
                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)] mb-5" />
                    <p className="text-[14px] text-[var(--colors-text-quaternary)] mb-4">Staff actions</p>
                    <div className="flex flex-col gap-4">
                        {/* Owner is the account holder — only Account settings, same
                            as the Staff table's owner row. */}
                        {isOwner ? (
                            <ActionBtn icon={<Settings01 className="w-5 h-5" />} label="Account settings" onClick={() => onAction("account_settings")} />
                        ) : (
                        <>
                        {isPending && (
                            <ActionBtn icon={<Send01 className="w-5 h-5" />} label="Resend invitation" onClick={() => onAction("resend_invite")} />
                        )}
                        {isActive && (
                            <>
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit staff details" onClick={() => onAction("edit_details")} />
                                <ActionBtn icon={<UserSquare className="w-5 h-5" />} label="Change staff role" onClick={() => onAction("change_role")} />
                                <ActionBtn icon={<ClockPlus className="w-5 h-5" />} label="Assign shift" onClick={() => onAction("assign_shift")} />
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
                        </>
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
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">{label}</p>
            <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">{value}</p>
        </div>
    );
}

// ─── Internal link card (instructor only) ─────────────────────────────────

function InternalLinkCard({ staff, payRateId }: { staff: Staff; payRateId?: string }) {
    const router = useRouter();
    function go(path: string) { router.push(path); }
    // self-aligned-start so the card hugs its content height rather than
    // stretching to match the main content card on its left.
    return (
        <aside className="w-[280px] shrink-0 self-start bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-4">
                <p className="font-semibold text-[16px] leading-[24px] text-[var(--colors-text-primary)]">Internal link</p>
            </div>
            <div className="flex flex-col gap-1 px-3 pb-6">
                {/* Earnings → payroll module detail page for THIS instructor.
                    `staff.id` matches the `instructors` slice id 1:1, so the
                    [instructorId] route resolves directly. */}
                <LinkRow icon={<CreditCard02 className="w-5 h-5" />} label="Earnings"
                    onClick={() => go(`/staff/payroll/${staff.id}?returnTo=/staff/members/${staff.id}`)} />
                {/* Pay rate → pay-rate module detail page for the instructor's
                    assigned rate (e.g. "Standard"). Hidden when no rate set. */}
                {payRateId && (
                    <LinkRow icon={<CoinsHand className="w-5 h-5" />} label="Pay rate"
                        onClick={() => go(`/staff/pay-rate/${payRateId}?returnTo=/staff/members/${staff.id}`)} />
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
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-left">
            <span className="text-[var(--colors-text-tertiary)] shrink-0">{icon}</span>
            <span className="flex-1 text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</span>
            <ArrowUpRight className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
        </button>
    );
}

// Local TabBtn removed — uses canonical `<DetailPageTabs>` from
// `@/components/patterns/DetailPageTabs`.

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
        return <span className="text-[14px] text-[var(--colors-fg-quaternary)]" aria-label={`${ariaLabel}: not applicable`}>—</span>;
    }
    return <Check className="w-4 h-4 text-[#164e52] inline-block" aria-label={ariaLabel} />;
}

function PermissionSection({ section, role }: { section: PermissionSectionSpec; role: Role }) {
    const [open, setOpen] = useState(true);
    const Icon = SECTION_ICONS[section.key] ?? Users01;
    const isFlat = section.modules.length === 1 && section.modules[0].label === section.label;

    if (isFlat) {
        const mod = section.modules[0];
        const cellRow = role.permissions[section.key]?.[mod.key] ?? { create: "na", edit: "na", delete: "na", view: "na" };
        return (
            <tr className="hover:bg-[var(--colors-bg-secondary)] transition-colors">
                <td className="px-4 py-3 border-b border-[var(--colors-bg-tertiary)]">
                    <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-[var(--colors-text-tertiary)] shrink-0" />
                        <span className="text-[14px] text-[var(--colors-text-secondary)]">{section.label}</span>
                    </div>
                </td>
                {(["create", "edit", "delete", "view"] as const).map(action => (
                    <td key={action} className="px-4 py-3 border-b border-[var(--colors-bg-tertiary)] text-center">
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
                <td colSpan={5} className="px-4 py-3 border-b border-[var(--colors-bg-tertiary)]">
                    <button type="button" onClick={() => setOpen(p => !p)}
                        className="flex items-center gap-2 w-full text-left">
                        {open
                            ? <ChevronDown className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                            : <ChevronUp   className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0 rotate-180" />
                        }
                        <Icon className="w-5 h-5 text-[var(--colors-text-tertiary)] shrink-0" />
                        <span className="text-[14px] font-semibold text-[var(--colors-text-primary)]">{section.label}</span>
                    </button>
                </td>
            </tr>
            {open && section.modules.map(mod => {
                const cellRow = role.permissions[section.key]?.[mod.key] ?? { create: "na", edit: "na", delete: "na", view: "na" };
                return (
                    <tr key={mod.key} className="hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <td className="px-4 py-3 text-[14px] text-[var(--colors-text-secondary)] border-b border-[var(--colors-bg-tertiary)] pl-[60px]">{mod.label}</td>
                        {(["create", "edit", "delete", "view"] as const).map(action => (
                            <td key={action} className="px-4 py-3 border-b border-[var(--colors-bg-tertiary)] text-center">
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
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">Permissions</p>
            <div className="w-full border-1 border-[var(--colors-border-secondary)] rounded-[12px] overflow-hidden">
                <table className="w-full border-collapse">
                    <thead className="bg-[var(--colors-bg-secondary)]">
                        <tr>
                            <th className="text-left px-4 py-3 text-[12px] font-medium text-[var(--colors-text-tertiary)] border-b border-[var(--colors-border-secondary)]">Module / Action</th>
                            <th className="text-center px-4 py-3 text-[12px] font-medium text-[var(--colors-text-tertiary)] border-b border-[var(--colors-border-secondary)] w-[80px]">Create</th>
                            <th className="text-center px-4 py-3 text-[12px] font-medium text-[var(--colors-text-tertiary)] border-b border-[var(--colors-border-secondary)] w-[80px]">Edit</th>
                            <th className="text-center px-4 py-3 text-[12px] font-medium text-[var(--colors-text-tertiary)] border-b border-[var(--colors-border-secondary)] w-[80px]">Delete</th>
                            <th className="text-center px-4 py-3 text-[12px] font-medium text-[var(--colors-text-tertiary)] border-b border-[var(--colors-border-secondary)] w-[80px]">View</th>
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
    label: string; value: string | number;
    // Optional week-over-week % trend. Omitted here — a reliable comparison
    // period isn't derivable from the demo seed dates, so we show the real
    // metric value without a fabricated trend badge (client "make it real").
    delta?: number;
}) {
    const showDelta = typeof delta === "number" && Number.isFinite(delta);
    const positive = (delta ?? 0) >= 0;
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] px-4 py-3 flex flex-col gap-1">
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">{label}</p>
            <p className="font-semibold text-[28px] leading-[36px] text-[var(--colors-text-primary)]">{value}</p>
            {showDelta && (
                <div className="flex items-center gap-1 text-[13px]">
                    {positive
                        ? <ArrowUp   className="w-3.5 h-3.5 text-[#164e52]" />
                        : <ArrowDown className="w-3.5 h-3.5 text-[#b42318]" />
                    }
                    <span className={positive ? "text-[#164e52] font-medium" : "text-[#b42318] font-medium"}>
                        {Math.abs(delta as number)}%
                    </span>
                    <span className="text-[var(--colors-text-quaternary)]">vs last week</span>
                </div>
            )}
        </div>
    );
}

function ChartEmptyCard({ title, emptyTitle, emptyBody }: {
    title: string; emptyTitle: string; emptyBody: string;
}) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">{title}</p>
            <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] h-[260px] relative flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-center px-6">
                    <BarChartSquare02 className="w-10 h-10 text-[var(--colors-fg-quaternary)]" />
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{emptyTitle}</p>
                    <p className="text-[14px] text-[var(--colors-text-quaternary)]">{emptyBody}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Overview chart series ───────────────────────────────────────────────────
//
// The three Overview charts are derived LIVE from this instructor's real
// class_schedule + class_bookings, bucketed by day (see `perfSeries` in the
// Overview tab). No hardcoded sample data — a "Feb 22" label short-formats the
// class date, "Attendance rate" is present/roster, "Class bookings" sums the
// booked count, and the Attendance bars split present / cancellations / no-show.

/** "2026-02-22" → "Feb 22" for the chart X-axis. */
function shortDayLabel(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Personal information helpers ──────────────────────────────────────────

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function WorkingDaysStrip({ workingDays }: { workingDays: boolean[] }) {
    // Strip mirrors Figma 7449:161921: 7 single-letter slots [Sun..Sat],
    // working days in dark ink, off-days in muted grey per client Jul 2026
    // (red read as an error state on non-working days).
    return (
        <div className="flex items-center gap-3 text-[16px] font-medium">
            {DAY_LETTERS.map((d, i) => (
                <span key={i} className={workingDays[i] ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-fg-quaternary)]"}>{d}</span>
            ))}
        </div>
    );
}

/** "07:00" → "07:00 AM"; "17:00" → "05:00 PM". Shared by both overview tabs. */
function fmtShift12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    const mm = Number.isNaN(m) ? 0 : m;
    return mm === 0 ? `${hh} ${ampm}` : `${hh}.${String(mm).padStart(2, "0")} ${ampm}`;
}

/** Working-hours fallback for staff with no assigned shift (client 2026-07-24):
 *  the branch's operating window — earliest open → latest close across the
 *  branch's open days — so the Working hours field is never empty. Returns null
 *  when the branch has no hours on file. */
function branchOperatingHoursLabel(businessHours: BusinessHours[], branchId: string | null): string | null {
    if (!branchId) return null;
    const openRows = businessHours.filter(h => h.branch_id === branchId && !h.is_closed);
    if (openRows.length === 0) return null;
    const open  = openRows.reduce((a, r) => (r.open_time  < a ? r.open_time  : a), openRows[0].open_time);
    const close = openRows.reduce((a, r) => (r.close_time > a ? r.close_time : a), openRows[0].close_time);
    return `Branch hours (${fmtShift12(open)} – ${fmtShift12(close)})`;
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">{label}</p>
            <div className="text-[16px] font-medium text-[var(--colors-text-primary)]">{value || "—"}</div>
        </div>
    );
}

// ─── Introduction section (with See more toggle) ───────────────────────────

function IntroductionSection({ intro }: { intro: string }) {
    const [expanded, setExpanded] = useState(false);
    if (!intro) return null;
    const long = intro.length > 180;
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-5 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">Introduction</p>
            <p className={cn(
                "text-[16px] text-[var(--colors-text-primary)] leading-[24px] break-words whitespace-normal",
                !expanded && long && "line-clamp-2",
            )}>
                {intro}
            </p>
            {long && (
                <button type="button" onClick={() => setExpanded(p => !p)}
                    className="self-start text-[14px] font-medium text-[var(--colors-secondary-600)] hover:text-[#10373a] transition-colors mt-1">
                    {expanded ? "See less" : "See more"}
                </button>
            )}
        </div>
    );
}

function InstructorOverviewTab({ staff }: { staff: Staff }) {
    const classSchedule = useAppStore(s => s.classSchedules);
    const classRatings  = useAppStore(s => s.classRatings);
    const classBookings = useAppStore(s => s.classBookings);
    const shifts        = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    const classCategories = useAppStore(s => s.classCategories);
    const businessHours = useAppStore(s => s.businessHours);

    // Resolve shift + categories for the Personal information section.
    // Audit fix 2026-07-22 — blend M2M assignments with the legacy
    // shiftId so multi-shift staff show every one of their shifts,
    // not just the primary. Preserves single-shift visual when there's
    // only one binding.
    const assignedShifts = useMemo(() => {
        const seen = new Set<string>();
        const out: typeof shifts = [];
        for (const a of shiftAssignments) {
            if (a.staff_id !== staff.id) continue;
            const sh = shifts.find(x => x.id === a.shift_id);
            if (sh && !seen.has(sh.id)) { seen.add(sh.id); out.push(sh); }
        }
        if (out.length === 0 && staff.shiftId) {
            const sh = shifts.find(x => x.id === staff.shiftId);
            if (sh) out.push(sh);
        }
        return out;
    }, [shiftAssignments, shifts, staff.id, staff.shiftId]);
    // Union of working_days across every shift so the "Working days" strip
    // shows every day the staff might be on the floor.
    const combinedWorkingDays = useMemo(() => {
        // Honor each ASSIGNMENT's days_of_week (∩ the shift's working_days) so a
        // staffer narrowed to e.g. "Afternoon, Thu only" shows just Thursday —
        // not the shift's full day range (client 2026-07-24 audit).
        const mine = shiftAssignments.filter(a => a.staff_id === staff.id);
        const out = [false, false, false, false, false, false, false];
        let any = false;
        for (const a of mine) {
            const sh = shifts.find(x => x.id === a.shift_id);
            if (!sh) continue;
            for (let i = 0; i < 7; i++) if (a.days_of_week[i] && sh.working_days[i]) { out[i] = true; any = true; }
        }
        if (!any && staff.shiftId) {
            const sh = shifts.find(x => x.id === staff.shiftId);
            if (sh) for (let i = 0; i < 7; i++) if (sh.working_days[i]) { out[i] = true; any = true; }
        }
        return any ? out : null;
    }, [shiftAssignments, shifts, staff.id, staff.shiftId]);
    const assignedCategoryNames = (staff.categoryIds ?? [])
        .map(id => classCategories.find(c => c.id === id)?.name)
        .filter((n): n is string => !!n);

    // 12-hour formatter for the Shift hours line — matches Figma's
    // "Morning shift (07:00 AM – 12:00 AM)" copy.
    function fmtShiftTime(t: string): string {
        const [h, m] = t.split(":").map(Number);
        const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const ampm = h < 12 ? "AM" : "PM";
        const mm = Number.isNaN(m) ? 0 : m;
        return mm === 0 ? `${hh} ${ampm}` : `${hh}.${String(mm).padStart(2, "0")} ${ampm}`;
    }

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

    // Real per-day chart series — bucket this instructor's COMPLETED classes by
    // date, then join their bookings for present / no-show / cancellation splits.
    // Replaces the old hardcoded sample data (client "make it real", 2026-08).
    const perfSeries = useMemo(() => {
        const done = myClasses.filter(c => c.status === "Completed");
        const dayByClassId = new Map<string, string>();
        const byDay = new Map<string, { booked: number; present: number; noShow: number; cancels: number; roster: number }>();
        for (const c of done) {
            dayByClassId.set(c.id, c.dateISO);
            const cur = byDay.get(c.dateISO) ?? { booked: 0, present: 0, noShow: 0, cancels: 0, roster: 0 };
            cur.booked += c.booked;
            byDay.set(c.dateISO, cur);
        }
        for (const b of classBookings) {
            const day = dayByClassId.get(b.classScheduleId);
            if (!day) continue;
            const cur = byDay.get(day)!;
            cur.roster += 1;
            if (b.attendanceStatus === "present") cur.present += 1;
            else if (b.attendanceStatus === "no_show") cur.noShow += 1;
            else if (b.attendanceStatus === "late_cancel") cur.cancels += 1;
        }
        // Most recent up to 8 active days, chronological.
        const days = Array.from(byDay.keys()).sort().slice(-8);
        const performance: LinePoint[] = days.map(d => {
            const v = byDay.get(d)!;
            return { date: shortDayLabel(d), value: v.roster > 0 ? Math.round((v.present / v.roster) * 100) : 0 };
        });
        const bookings: LinePoint[] = days.map(d => ({ date: shortDayLabel(d), value: byDay.get(d)!.booked }));
        const attendance: AttendancePoint[] = days.map(d => {
            const v = byDay.get(d)!;
            return { date: shortDayLabel(d), visits: v.present, cancellations: v.cancels, noShow: v.noShow };
        });
        return { performance, bookings, attendance };
    }, [myClasses, classBookings]);

    const hasAnyActivity = myClasses.length > 0 || totalAttended > 0 || ratingCount > 0;

    return (
        <div className="px-6 pb-6 flex flex-col gap-6">
            {/* Personal information — Figma 7449:161921. Flush 2-column
                grid (no card border / padding) so the section reads as
                pure content above the Overall performance block. */}
            <div className="flex flex-col gap-3">
                <p className="text-[14px] text-[var(--colors-text-quaternary)]">Personal information</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <InfoField label="Full name"   value={staff.fullName} />
                    <InfoField label="Joined date" value={staff.joinedDate} />
                    <InfoField label="Email"       value={staff.email} />
                    <InfoField label="Phone"       value={staff.phone} />
                    <InfoField label="Work experience"
                        value={staff.workingExperienceYears != null && staff.workingExperienceYears > 0
                            ? `${staff.workingExperienceYears} year${staff.workingExperienceYears === 1 ? "" : "s"}`
                            : "—"} />
                    <InfoField label="Categories"
                        value={assignedCategoryNames.length > 0 ? assignedCategoryNames.join(", ") : "—"} />
                    <InfoField label="Working days"
                        value={combinedWorkingDays ? <WorkingDaysStrip workingDays={combinedWorkingDays} /> : "—"} />
                    <InfoField label="Working hours"
                        value={assignedShifts.length > 0
                            ? assignedShifts
                                  .map(sh => `${sh.name} (${fmtShiftTime(sh.start_time)} – ${fmtShiftTime(sh.end_time)})`)
                                  .join(", ")
                            : (branchOperatingHoursLabel(businessHours, staff.branchId) ?? "—")} />
                </div>
            </div>

            {/* Introduction — long-form short intro with See more toggle.
                Hidden entirely when the instructor hasn't filled it. (Work
                experience stays removed, client 2026-08-19.) */}
            <IntroductionSection intro={staff.shortIntro ?? ""} />

            {/* Overall performance — 4 metric cards in horizontal row */}
            <div className="flex flex-col gap-3">
                <p className="text-[14px] text-[var(--colors-text-quaternary)]">Overall performance</p>
                <div className="grid grid-cols-4 gap-3">
                    <PerformanceMetricCard label="Classes"        value={completedClasses.length} />
                    <PerformanceMetricCard label="Attendance rate" value={`${attendanceRate}%`} />
                    <PerformanceMetricCard label="Clients taught"  value={totalAttended} />
                    <PerformanceMetricCard label="Cancellations"   value={cancelledClasses.length} />
                </div>
            </div>

            {hasAnyActivity ? (
                <>
                    <PerformanceLineChart
                        title="Overall performance"
                        data={perfSeries.performance}
                        color="#92d1de"
                        valueLabel="Attendance rate"
                        valueSuffix="%"
                    />
                    <PerformanceLineChart
                        title="Class bookings"
                        data={perfSeries.bookings}
                        color="#90a099"
                        valueLabel="Total booking"
                    />
                    <AttendanceBarChart
                        title="Attendance overview"
                        data={perfSeries.attendance}
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

// ─── Overview tab (non-instructor) ────────────────────────────────────────
//
// Front Desk / Operator / Branch admin / Owner get their own Overview that
// mirrors the instructor "Personal information" section (minus the
// instructor-only fields).
//
// Sales commission moved to the Payroll detail page (commission refactor
// Phase 3 — client wants it in payroll, not on the staff profile). This tab no
// longer renders it.

function NonInstructorOverviewTab({ staff }: { staff: Staff }) {
    // Client 2026-07-24 — non-instructor staff can now hold shifts too, so their
    // Working days + Shift hours derive from their assigned shifts (M2M + legacy
    // primary), exactly like instructors. When they have no shift, Working days
    // falls back to the BRANCH's operating days.
    const businessHours = useAppStore(s => s.businessHours);
    const shifts        = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);

    // Assigned shifts — M2M assignments blended with the legacy primary.
    const assignedShifts = useMemo(() => {
        const seen = new Set<string>();
        const out: typeof shifts = [];
        for (const a of shiftAssignments) {
            if (a.staff_id !== staff.id) continue;
            const sh = shifts.find(x => x.id === a.shift_id);
            if (sh && !seen.has(sh.id)) { seen.add(sh.id); out.push(sh); }
        }
        if (out.length === 0 && staff.shiftId) {
            const sh = shifts.find(x => x.id === staff.shiftId);
            if (sh) out.push(sh);
        }
        return out;
    }, [shiftAssignments, shifts, staff.id, staff.shiftId]);

    // Branch operating days (fallback when no shift). [Sun..Sat], 0=Sun … 6=Sat.
    const branchWorkingDays = useMemo<boolean[]>(() => {
        const branchRows = staff.branchId
            ? businessHours.filter(h => h.branch_id === staff.branchId)
            : [];
        return Array.from({ length: 7 }, (_, dow) => {
            const row = branchRows.find(h => h.day_of_week === dow);
            return row ? !row.is_closed : false;
        });
    }, [businessHours, staff.branchId]);
    // Union of assigned-shift working days.
    const shiftWorkingDays = useMemo<boolean[] | null>(() => {
        // Per-assignment days_of_week ∩ shift working_days (client 2026-07-24
        // audit) — a narrowed assignment shows only the days actually worked.
        const mine = shiftAssignments.filter(a => a.staff_id === staff.id);
        const out = [false, false, false, false, false, false, false];
        let any = false;
        for (const a of mine) {
            const sh = shifts.find(x => x.id === a.shift_id);
            if (!sh) continue;
            for (let i = 0; i < 7; i++) if (a.days_of_week[i] && sh.working_days[i]) { out[i] = true; any = true; }
        }
        if (!any && staff.shiftId) {
            const sh = shifts.find(x => x.id === staff.shiftId);
            if (sh) for (let i = 0; i < 7; i++) if (sh.working_days[i]) { out[i] = true; any = true; }
        }
        return any ? out : null;
    }, [shiftAssignments, shifts, staff.id, staff.shiftId]);
    const hasBranchHours = staff.branchId != null && businessHours.some(h => h.branch_id === staff.branchId);
    const workingDays = shiftWorkingDays ?? branchWorkingDays;
    const showWorkingDays = shiftWorkingDays != null || hasBranchHours;

    return (
        <div className="px-6 pb-6 flex flex-col gap-6">
            {/* Personal information — flush 2-col grid, now including Working
                days + Shift hours for every role (client 2026-07-24). */}
            <div className="flex flex-col gap-3">
                <p className="text-[14px] text-[var(--colors-text-quaternary)]">Personal information</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <InfoField label="Full name"   value={staff.fullName} />
                    <InfoField label="Joined date" value={staff.joinedDate} />
                    <InfoField label="Email"       value={staff.email} />
                    <InfoField label="Phone"       value={staff.phone} />
                    <InfoField label="Working days"
                        value={showWorkingDays ? <WorkingDaysStrip workingDays={workingDays} /> : "—"} />
                    <InfoField label="Working hours"
                        value={assignedShifts.length > 0
                            ? assignedShifts
                                  .map(sh => `${sh.name} (${fmtShift12(sh.start_time)} – ${fmtShift12(sh.end_time)})`)
                                  .join(", ")
                            : (branchOperatingHoursLabel(businessHours, staff.branchId) ?? "—")} />
                </div>
            </div>
        </div>
    );
}

// ─── Top-level page ───────────────────────────────────────────────────────

export interface StaffDetailPageProps {
    staffId: string;
    returnTo?: string;
}

// ─── Pay rate tab (instructor-only) — client 2026-07-24 ─────────────────────
// Shows the instructor's multi-track pay configuration. Only enabled tracks
// render, resolved to pay-rate names. Mirrors the sidebar Metadata styling.
function PayRateTab({ staff, payRates }: { staff: Staff; payRates: PayRate[] }) {
    const cfg = staff.payConfig;
    const nameOf = (id?: string) => (id ? payRates.find(p => p.id === id)?.name : undefined) ?? "—";
    const rows: { label: string; value: string }[] = [];
    if (cfg) {
        if (cfg.default.enabled) rows.push({ label: "Default pay rate", value: nameOf(cfg.default.payRateId) });
        if (cfg.perClass.enabled) {
            rows.push({ label: "Pay per class", value: nameOf(cfg.perClass.payRateId) });
            rows.push({ label: "Substitute pay rate", value: nameOf(cfg.perClass.substitutePayRateId) });
            rows.push({ label: "Substitutions amount", value: cfg.perClass.substitutionAmountAed != null ? `AED ${cfg.perClass.substitutionAmountAed}` : "—" });
        }
        if (cfg.perAppointment.enabled) rows.push({ label: "Pay per Private", value: nameOf(cfg.perAppointment.payRateId) });
    } else {
        // Legacy row with no payConfig — fall back to the single default rate.
        rows.push({ label: "Default pay rate", value: nameOf(staff.payRateId) });
    }
    return (
        <div className="px-6 pb-6">
            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-[24px] mb-5">Pay rate</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 max-w-[640px]">
                {rows.map(r => (
                    <div key={r.label} className="flex flex-col gap-1">
                        <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{r.label}</p>
                        <p className="text-[16px] font-medium text-[var(--colors-text-primary)] leading-[24px]">{r.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

type TabId = "overview" | "permissions" | "payrate";

export default function StaffDetailPage({ staffId, returnTo = "/admin/staff" }: StaffDetailPageProps) {
    const router = useRouter();
    const allStaff           = useAppStore(s => s.staff);
    const allRoles           = useAppStore(s => s.roles);
    const payRates           = useAppStore(s => s.payRates);
    const branches           = useAppStore(s => s.branches);
    const setStaffStatus     = useAppStore(s => s.setStaffStatus);
    const deleteStaffAction  = useAppStore(s => s.deleteStaff);
    const canDeleteStaff     = useAppStore(s => s.canDeleteStaff);
    const resendStaffInvite  = useAppStore(s => s.resendStaffInvite);
    const showToast          = useAppStore(s => s.showToast);

    const staff = allStaff.find(s => s.id === staffId);
    const role  = staff ? allRoles.find(r => r.id === staff.roleId) : undefined;
    const isInstructor = role?.type === "instructor";

    const [tab, setTab] = useState<TabId>("permissions");
    const [pendingConfirm, setPendingConfirm] = useState<ConfirmKind | null>(null);
    const [changeRoleOpen, setChangeRoleOpen] = useState(false);
    const [assignShiftOpen, setAssignShiftOpen] = useState(false);
    const isOwnerRole = role?.type === "owner";

    useEffect(() => {
        if (!staff && allStaff.length > 0) {
            showToast("Staff not found", "Returned to the staff list.", "error");
            router.push(returnTo);
        }
    }, [staff, allStaff.length, router, returnTo, showToast]);

    useEffect(() => {
        // Overview tab is available to every role now — instructors see class
        // metrics, non-instructors see a Sales commission section (when their
        // pay rate is Monthly with commission %).
        setTab("overview");
    }, [isInstructor]);

    if (!staff) {
        return (
            <div className="h-screen bg-white flex flex-col">
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button type="button" onClick={() => router.push(returnTo)}
                        aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">Staff details</h1>
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
            setStaffStatus([staff.id], "archived");
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
    function handleSidebarAction(kind: SidebarActionKind) {
        if (kind === "edit_details") {
            return openStaffFormPanel({ kind: "staff", mode: "edit", id: staff!.id });
        }
        if (kind === "change_role")   return setChangeRoleOpen(true);
        if (kind === "resend_invite") return handleResend();
        if (kind === "assign_shift")  return setAssignShiftOpen(true);
        if (kind === "account_settings") return router.push("/admin/settings/account");
        setPendingConfirm(kind);
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
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">Staff details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            <DetailPageShell
                sidebar={
                    <Sidebar
                        staff={staff}
                        role={role}
                        payRateName={payRateName}
                        onAction={handleSidebarAction}
                        branches={branches}
                        hasHistory={!canDeleteStaff(staff.id)}
                        isOwner={isOwnerRole}
                    />
                }
                main={
                    <>
                        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[var(--colors-border-secondary)] rounded-[20px]">
                            <div className="shrink-0 border-b border-[var(--colors-border-secondary)] px-6 pt-6">
                                <DetailPageTabs
                                    tabs={[
                                        { key: "overview", label: "Overview" },
                                        { key: "permissions", label: "Permissions" },
                                        // Pay rate tab — instructor-only (client 2026-07-24).
                                        ...(isInstructor ? [{ key: "payrate", label: "Pay rate" }] : []),
                                    ]}
                                    activeKey={tab}
                                    onChange={(k) => setTab(k as typeof tab)}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                                {!role ? (
                                    <div className="px-6 pb-6 relative" style={{ minHeight: 320 }}>
                                        <EmptyState title="Role missing" subtitle="The role assigned to this staff member is no longer available." />
                                    </div>
                                ) : tab === "payrate" && isInstructor ? (
                                    <PayRateTab staff={staff} payRates={payRates} />
                                ) : tab === "overview" && isInstructor ? (
                                    <InstructorOverviewTab staff={staff} />
                                ) : tab === "overview" ? (
                                    <NonInstructorOverviewTab staff={staff} />
                                ) : (
                                    <PermissionsTab role={role} />
                                )}
                            </div>
                        </div>

                        {/* Optional third flex child — renders alongside the
                            main panel when the staff member is an instructor. */}
                        {isInstructor && (
                            <InternalLinkCard staff={staff} payRateId={staff.payRateId} />
                        )}
                    </>
                }
            />

            {pendingConfirm && (() => {
                const cfg = CONFIRM_CFG[pendingConfirm];
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.tone}
                        title={cfg.title(`"${staff.fullName}"`)}
                        description={cfg.description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performConfirm(pendingConfirm)}
                    />
                );
            })()}

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

            {assignShiftOpen && (
                <AssignShiftModal staff={staff} onClose={() => setAssignShiftOpen(false)} />
            )}

            <Toast />
        </div>
    );
}
