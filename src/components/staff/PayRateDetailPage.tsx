"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Pay rate detail page (/admin/staff/pay-rate/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references (file nzV4uBZZ4MWQAKNs6lnW0O):
//   • 3714-39825 — "Assigned instructor" tab
//   • 3714-40234 — "Additional settings" tab
//
// Layout (Figma 3714-39825):
//   • Header: × close + "Pay rate details" (h-72)
//   • Body (2-col, gap-8, px-6):
//       LEFT  — w-340 sidebar card (preview-style banner + summary + actions)
//       RIGHT — flex-1 content card with two tabs
//
// Sidebar shows the same banner + status badge + name + price as the form's
// preview, plus a "Pay rate actions" footer. Right tabs:
//   • Assigned instructor  — filtered instructors table, ⋮ row actions
//   • Additional settings  — read-only view of the two pay rate toggles
//
// State sync: all reads come from useAppStore so anything that mutates the
// pay rate (edit, archive, delete) or its assigned instructors elsewhere is
// reflected here immediately, and any action this page triggers propagates
// out the same way.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    XClose, Edit02, Archive, RefreshCcw01, SlashCircle01, Trash01, Check, CoinsHand,
    SearchMd, FilterLines, DotsVertical, Eye, ChevronLeft, MarkerPin01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { SelectInput } from "@/components/ui/select-input";
import { DecorativeBanner, BANNER_TINTS } from "@/components/products/DecorativeBanner";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { DetailPageTabs } from "@/components/patterns/DetailPageTabs";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
    useAppStore, computePayRateDisplay,
    type PayRate, type PayRateType, type Instructor, type InstructorStatus, type Branch,
} from "@/lib/store";

// ─── Badges ─────────────────────────────────────────────────────────────────

const PAY_RATE_STATUS_LABEL = { active: "Active", archive: "Archive" } as const;

function PayRateStatusBadge({ status }: { status: PayRate["status"] }) {
    const styles = status === "active"
        ? "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
        : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]";
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium leading-[20px]", styles)}>
            {PAY_RATE_STATUS_LABEL[status]}
        </span>
    );
}

const TYPE_LABEL: Record<PayRateType, string> = {
    flat: "Flat", tiered: "Tiered", revenue: "% revenue", hybrid: "Hybrid", monthly: "Monthly",
};
const TYPE_BADGE_STYLE: Record<PayRateType, string> = {
    flat:    "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    tiered:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    revenue: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    hybrid:  "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    monthly: "bg-[#f5fffa] border-1 border-[#aad4bd] text-[#3b5446]",
};

function TypeBadge({ type }: { type: PayRateType }) {
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", TYPE_BADGE_STYLE[type])}>
            {TYPE_LABEL[type]}
        </span>
    );
}

const INSTRUCTOR_STATUS_LABEL: Record<InstructorStatus, string> = {
    active: "Active", inactive: "Inactive", archive: "Archive",
};
function InstructorStatusBadge({ status }: { status: InstructorStatus }) {
    const styles: Record<InstructorStatus, string> = {
        active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        inactive: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        archive:  "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {INSTRUCTOR_STATUS_LABEL[status]}
        </span>
    );
}

// ─── Sidebar action button (reuses the products / class-types pattern) ─────

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

// ─── Avatar (image OR initials with brand color) ────────────────────────────

function InstructorAvatar({ instructor }: { instructor: Instructor }) {
    if (instructor.imageUrl) {
        return (
            <img src={instructor.imageUrl} alt={instructor.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
        );
    }
    return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-medium text-white shrink-0"
            style={{ backgroundColor: instructor.color }}>
            {instructor.initials}
        </div>
    );
}

// ─── Checkbox (same sage variant the list uses) ────────────────────────────

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

// ─── Instructor row actions (⋮ menu) ───────────────────────────────────────

type InstructorRowAction = "view" | "edit" | "archive" | "deactivate" | "reactivate" | "recover";

function InstructorRowActions({ status, onAction }: {
    status: InstructorStatus; onAction: (kind: InstructorRowAction) => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    function trigger(kind: InstructorRowAction) { setOpen(false); onAction(kind); }
    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={200}>
                <button type="button" onClick={() => trigger("view")}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View details
                </button>
                {/* Edit + Archive only when Active (parallels the global archive/inactive gates). */}
                {status === "active" && (
                    <button type="button" onClick={() => trigger("edit")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Edit02 className="w-4 h-4 text-[#667085]" />Edit instructor
                    </button>
                )}
                {status !== "archive" && (
                    <button type="button" onClick={() => trigger("archive")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Archive className="w-4 h-4 text-[#667085]" />Archive
                    </button>
                )}
                {status === "inactive" && (
                    <button type="button" onClick={() => trigger("reactivate")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Check className="w-4 h-4 text-[#667085]" />Reactivate
                    </button>
                )}
                {status === "archive" && (
                    <button type="button" onClick={() => trigger("recover")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <RefreshCcw01 className="w-4 h-4 text-[#667085]" />Recover
                    </button>
                )}
                {status === "active" && (
                    <button type="button" onClick={() => trigger("deactivate")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                        <SlashCircle01 className="w-4 h-4 text-[#b42318]" />Deactivate
                    </button>
                )}
            </FixedDropdown>
        </div>
    );
}

// ─── Confirm modal (shared by sidebar + row actions) ───────────────────────

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
        description: s => `${s} will be moved to the archive. You can recover it any time.`,
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

// ─── Sidebar ───────────────────────────────────────────────────────────────

function Sidebar({ payRate, onAction, branches }: {
    payRate: PayRate;
    onAction: (kind: "edit" | ConfirmKind) => void;
    branches: Branch[];
}) {
    const branch = branches.find(b => b.id === payRate.branchId);
    const display = computePayRateDisplay(payRate);
    const isActive   = payRate.status === "active";
    const canDelete  = isActive && payRate.usageCount === 0;

    return (
        <aside className="w-[320px] shrink-0 h-full bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            {/* Banner — same DecorativeBanner pattern as gift-card detail, tinted
                with the pay rate brand-sage palette (BANNER_TINTS.payRate). */}
            <div className="relative shrink-0">
                <DecorativeBanner bannerHeight={156} iconBox={72} icon={CoinsHand} {...BANNER_TINTS.payRate} />
                <div className="absolute top-3 right-3">
                    <PayRateStatusBadge status={payRate.status} />
                </div>
            </div>

            {/* Summary */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{payRate.name}</h2>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Pay rate type</p>
                            <div><TypeBadge type={payRate.type} /></div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Rate</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {display.main} <span className="text-[#667085] font-normal">/ {display.subtitle.replace(/^per /, "")}</span>
                            </p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Branch location</p>
                            <p className="text-[16px] font-medium text-[#101828]">{branch?.name ?? "—"}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Pay rate actions</p>
                    <div className="flex flex-col gap-4">
                        {isActive && (
                            <>
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit pay rate" onClick={() => onAction("edit")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive pay rate" onClick={() => onAction("archive")} />
                                {canDelete && (
                                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete pay rate" danger onClick={() => onAction("delete")} />
                                )}
                            </>
                        )}
                        {!isActive && (
                            <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover pay rate" onClick={() => onAction("recover")} />
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}

// ─── Assigned-instructor filter side panel (Figma 7093-346173) ──────────────
//
// Same chrome as the customer / pay-rate filters: 420px right-slide panel,
// Branch location SelectInput + Status pill checkboxes (multi-select).

interface InstructorFilter {
    branchId: string; // "" = all branches
    statuses: InstructorStatus[];
}
const EMPTY_INSTRUCTOR_FILTER: InstructorFilter = { branchId: "", statuses: [] };


function InstructorFilterPanel({ open, onClose, applied, onApply, branches }: {
    open: boolean; onClose: () => void;
    applied: InstructorFilter;
    onApply: (next: InstructorFilter) => void;
    branches: Branch[];
}) {
    const [pending, setPending] = useState<InstructorFilter>(EMPTY_INSTRUCTOR_FILTER);

    useEffect(() => { if (open) setPending({ ...applied, statuses: [...applied.statuses] }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggleStatus(s: InstructorStatus) {
        setPending(p => ({
            ...p,
            statuses: p.statuses.includes(s) ? p.statuses.filter(x => x !== s) : [...p.statuses, s],
        }));
    }
    const hasAny = pending.branchId !== "" || pending.statuses.length > 0;
    const branchOptions = branches.filter(b => b.status === "active").map(b => ({
        value: b.id, label: b.name,
        icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
    }));

    return (
        <SlidePanel open={open} onClose={onClose} width={420}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Branch location */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Branch location</p>
                        <SelectInput
                            triggerIcon={<MarkerPin01 className="w-4 h-4 text-[#667085]" />}
                            placeholder="Select location"
                            options={[{ value: "", label: "All locations" }, ...branchOptions]}
                            value={pending.branchId}
                            onChange={v => setPending(p => ({ ...p, branchId: v }))}
                            width="w-full"
                        />
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {(["active", "inactive", "archive"] as InstructorStatus[]).map(s => (
                                <FilterPill key={s} label={INSTRUCTOR_STATUS_LABEL[s]} selected={pending.statuses.includes(s)}
                                    onClick={() => toggleStatus(s)} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_INSTRUCTOR_FILTER); onApply(EMPTY_INSTRUCTOR_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Assigned instructor tab ───────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

type InstructorPending =
    | { mode: "row"; row: Instructor; kind: ConfirmKind }
    | null;

function AssignedInstructorTab({ payRateId, payRateName, onPlaceholderAction }: {
    payRateId: string;
    payRateName: string;
    onPlaceholderAction: (kind: "view" | "edit", instructor: Instructor) => void;
}) {
    const router = useRouter();
    const instructors        = useAppStore(s => s.instructors);
    // Broadened source: any staff on this pay rate should appear here, not
    // just instructors. Non-instructor staff (Front Desk / Operator / Admin
    // / Owner) get synthesised into the same Instructor-shaped row so the
    // rest of the tab's rendering stays untouched.
    const staff              = useAppStore(s => s.staff);
    const branches           = useAppStore(s => s.branches);
    const setInstructorStatus = useAppStore(s => s.setInstructorStatus);
    const showToast          = useAppStore(s => s.showToast);

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<InstructorPending>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filter, setFilter] = useState<InstructorFilter>(EMPTY_INSTRUCTOR_FILTER);

    useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, filter, payRateId]);

    // Every staff member (any role) whose pay rate matches. Instructors
    // come from the instructors slice as-is; non-instructor staff are
    // synthesised into the same `Instructor` shape so the downstream
    // rendering/sort/filter code doesn't have to branch.
    const assigned = useMemo<Instructor[]>(() => {
        // Instructor projections first (canonical order + fields).
        const fromInstructors = instructors.filter(i => i.payRateId === payRateId);
        const instructorIds = new Set(fromInstructors.map(i => i.id));
        // Non-instructor staff on this rate — synthesise Instructor shape.
        const fromNonInstructors: Instructor[] = staff
            .filter(s => s.payRateId === payRateId && !instructorIds.has(s.id))
            .map(s => {
                // Instructor status is a subset of Staff status — collapse
                // "pending" to "active" for display so the row shows a
                // recognisable badge.
                const status: InstructorStatus = s.status === "pending"
                    ? "active"
                    : (s.status as InstructorStatus);
                return {
                    id: s.id,
                    name: s.fullName,
                    initials: s.initials,
                    color: s.color,
                    imageUrl: s.imageUrl,
                    email: s.email,
                    phone: s.phone,
                    joinedDate: s.joinedDate,
                    branchId: s.branchId ?? "",
                    payRateId: s.payRateId,
                    status,
                } satisfies Instructor;
            });
        return [...fromInstructors, ...fromNonInstructors];
    }, [instructors, staff, payRateId]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return assigned.filter(i => {
            if (filter.branchId && i.branchId !== filter.branchId) return false;
            if (filter.statuses.length > 0 && !filter.statuses.includes(i.status)) return false;
            if (q && !i.name.toLowerCase().includes(q)
                  && !i.email.toLowerCase().includes(q)
                  && !i.phone.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [assigned, search, filter]);

    const hasActiveFilter = filter.branchId !== "" || filter.statuses.length > 0;

    // ── Assigned instructor sort — Name / Contact (email) / Branch /
    //    Default pay rate (no-op since every row shares this pay rate's
    //    name, kept for visual header consistency) / Status. ──
    const INSTR_STATUS_ORDER: Record<InstructorStatus, number> = {
        active: 0, inactive: 1, archive: 2,
    } as Record<InstructorStatus, number>;
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<Instructor>(filtered, {
        name:    (a, b) => a.name.localeCompare(b.name),
        contact: (a, b) => a.email.localeCompare(b.email),
        branch:  (a, b) => {
            const an = branches.find(x => x.id === a.branchId)?.name ?? "";
            const bn = branches.find(x => x.id === b.branchId)?.name ?? "";
            return an.localeCompare(bn);
        },
        payRate: () => 0,
        status:  (a, b) => (INSTR_STATUS_ORDER[a.status] ?? 99) - (INSTR_STATUS_ORDER[b.status] ?? 99),
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clamped - 1) * pageSize, clamped * pageSize);

    const pageIds = pageRows.map(r => r.id);
    const allChecked = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const someChecked = !allChecked && pageIds.some(id => selectedIds.has(id));

    function toggleAllOnPage() {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allChecked) pageIds.forEach(id => next.delete(id));
            else pageIds.forEach(id => next.add(id));
            return next;
        });
    }
    function toggleOne(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function handleRowAction(row: Instructor, kind: InstructorRowAction) {
        if (kind === "view" || kind === "edit") {
            onPlaceholderAction(kind, row);
            return;
        }
        setPendingConfirm({ mode: "row", row, kind });
    }

    function performAction(p: NonNullable<InstructorPending>) {
        if (p.mode === "row") {
            const { row, kind } = p;
            const subject = row.name;
            const verbPast: Record<ConfirmKind, string> = {
                archive: "archived", recover: "restored to Active",
                reactivate: "reactivated", deactivate: "deactivated",
                delete: "deleted",
            };
            const nextStatus: InstructorStatus | null =
                kind === "archive"    ? "archive"  :
                kind === "deactivate" ? "inactive" :
                kind === "recover"    ? "active"   :
                kind === "reactivate" ? "active"   : null;
            if (nextStatus) setInstructorStatus([row.id], nextStatus);
            const icon = kind === "deactivate" ? "slash" : kind === "archive" ? "archive" : kind === "delete" ? "trash" : "refresh";
            const toneSuccess = kind !== "deactivate" && kind !== "delete";
            showToast(`Instructor ${verbPast[kind]}`, `${subject} has been ${verbPast[kind]}.`, toneSuccess ? "success" : "error", icon);
        }
        setPendingConfirm(null);
    }

    const isEmpty = assigned.length === 0;

    return (
        <div className="flex flex-col gap-6 px-6 pb-6">
            {/* Toolbar */}
            <div className="flex items-center gap-3 w-full">
                <ToolbarTotal count={filtered.length} entitySingular="staff" entityPlural="staff" size="sm" />
                <ToolbarSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search instructor..."
                />
                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
            </div>

            {/* Body */}
            {isEmpty ? (
                <div className="relative" style={{ minHeight: 320 }}>
                    <EmptyState
                        title="No staff assigned"
                        subtitle="No staff member currently uses this pay rate."
                    />
                </div>
            ) : pageRows.length === 0 ? (
                <div className="relative" style={{ minHeight: 320 }}>
                    <EmptyState
                        title="No staff found"
                        subtitle="Try adjusting your search."
                    />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={cn(TH, "w-[44px]")}>
                                    <CheckboxCell
                                        checked={allChecked}
                                        indeterminate={someChecked}
                                        onChange={() => toggleAllOnPage()}
                                        ariaLabel="Select all instructors on this page"
                                    />
                                </th>
                                <th className={cn(TH, "w-[280px]")}>
                                    <SortableHeader sortKey="name"    currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableHeader>
                                </th>
                                <th className={cn(TH, "w-[240px]")}>
                                    <SortableHeader sortKey="contact" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Contact</SortableHeader>
                                </th>
                                <th className={cn(TH, "w-[200px]")}>
                                    <SortableHeader sortKey="branch"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Branch location</SortableHeader>
                                </th>
                                <th className={cn(TH, "w-[160px]")}>
                                    <SortableHeader sortKey="payRate" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Default pay rate</SortableHeader>
                                </th>
                                <th className={cn(TH, "w-[120px]")}>
                                    <SortableHeader sortKey="status"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                </th>
                                <th className={cn(TH, "w-[52px]")} />
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map(r => {
                                const isSelected = selectedIds.has(r.id);
                                const branch = branches.find(b => b.id === r.branchId);
                                return (
                                    <tr key={r.id}
                                        onClick={() => onPlaceholderAction("view", r)}
                                        className={cn(
                                            "transition-colors cursor-pointer",
                                            isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                                        )}>
                                        <td className={TD} onClick={e => e.stopPropagation()}>
                                            <CheckboxCell
                                                checked={isSelected}
                                                onChange={() => toggleOne(r.id)}
                                                ariaLabel={`Select ${r.name}`}
                                            />
                                        </td>
                                        <td className={TD}>
                                            <div className="flex items-center gap-3">
                                                <InstructorAvatar instructor={r} />
                                                <div className="flex flex-col">
                                                    <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                                    <span className="text-[13px] text-[#667085]">Joined {r.joinedDate}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={TD}>
                                            <div className="flex flex-col">
                                                <span className="text-[14px] text-[#101828]">{r.email}</span>
                                                <span className="text-[13px] text-[#667085]">{r.phone}</span>
                                            </div>
                                        </td>
                                        <td className={cn(TD, "text-[#475467]")}>{branch?.name ?? "—"}</td>
                                        <td className={TD}>{payRateName}</td>
                                        <td className={TD}><InstructorStatusBadge status={r.status} /></td>
                                        <td className={TD} onClick={e => e.stopPropagation()}>
                                            <InstructorRowActions
                                                status={r.status}
                                                onAction={kind => handleRowAction(r, kind)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!isEmpty && pageRows.length > 0 && (
                <Pagination
                    page={clamped}
                    total={sortedRows.length}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={s => { setPageSize(s); setPage(1); }}
                />
            )}

            {pendingConfirm && (() => {
                const cfg = CONFIRM_CFG[pendingConfirm.kind];
                const subject = `"${pendingConfirm.row.name}"`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description(subject)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performAction(pendingConfirm)}
                    />
                );
            })()}

            <InstructorFilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={filter}
                onApply={setFilter}
                branches={branches}
            />
        </div>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Additional settings tab ───────────────────────────────────────────────

function SettingRow({ title, subtitle, on }: { title: string; subtitle: string; on: boolean }) {
    return (
        <div className="flex items-start justify-between gap-6 py-5">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
                <p className="text-[16px] font-medium text-[#101828] leading-[24px]">{title}</p>
                <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
            </div>
            <p className={cn(
                "text-[14px] leading-[20px] shrink-0",
                on ? "text-[#067647]" : "text-[#98a2b3]",
            )}>
                {on ? "Active" : "Inactive"}
            </p>
        </div>
    );
}

function AdditionalSettingsTab({ payRate }: { payRate: PayRate }) {
    return (
        <div className="flex flex-col px-6 pb-6 divide-y divide-[#f2f4f7]">
            <SettingRow
                title="Only count checked-in customers"
                subtitle="Excludes booked-but-absent members from pay calculation"
                on={!!payRate.onlyCheckedIn}
            />
            <SettingRow
                title="Include late-cancelled customers"
                subtitle="Counts late-cancel members toward pay"
                on={!!payRate.includeLateCancelled}
            />
        </div>
    );
}

// ─── Top-level component ────────────────────────────────────────────────────

type SidebarConfirm = { kind: ConfirmKind } | null;

export interface PayRateDetailPageProps {
    payRateId: string;
    returnTo?: string;
}

export default function PayRateDetailPage({ payRateId, returnTo = "/admin/staff/pay-rate" }: PayRateDetailPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const payRates           = useAppStore(s => s.payRates);
    const branches           = useAppStore(s => s.branches);
    const setPayRatesStatus  = useAppStore(s => s.setPayRatesStatus);
    const deletePayRatesAction = useAppStore(s => s.deletePayRates);
    const showToast          = useAppStore(s => s.showToast);

    const payRate = useMemo(() => payRates.find(p => p.id === payRateId), [payRates, payRateId]);

    const [tab, setTab] = useState<"instructor" | "settings">("instructor");
    const [sidebarConfirm, setSidebarConfirm] = useState<SidebarConfirm>(null);

    // Missing pay rate (e.g. deleted in another tab) → bounce back to list.
    useEffect(() => {
        if (payRates.length > 0 && !payRate) {
            showToast("Pay rate not found", "Returned to the pay rate list.", "error");
            router.push(returnTo);
        }
    }, [payRate, payRates, router, returnTo, showToast]);

    if (!payRate) return null;

    function handleSidebarAction(kind: "edit" | ConfirmKind) {
        if (!payRate) return;
        if (kind === "edit") {
            router.push(`/staff/pay-rate/${payRate.id}/edit?returnTo=${encodeURIComponent(pathname)}`);
            return;
        }
        setSidebarConfirm({ kind });
    }

    function performSidebarAction(kind: ConfirmKind) {
        if (!payRate) return;
        if (kind === "delete") {
            const { deleted, blocked } = deletePayRatesAction([payRate.id]);
            if (deleted.length > 0) {
                showToast("Pay rate deleted", `"${payRate.name}" permanently removed.`, "success", "trash");
                router.push(returnTo);
            } else if (blocked.length > 0) {
                showToast("Cannot delete", "Pay rate has usage history — archive instead.", "error");
            }
        } else if (kind === "archive") {
            setPayRatesStatus([payRate.id], "archive");
            showToast("Pay rate archived", `"${payRate.name}" moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            setPayRatesStatus([payRate.id], "active");
            showToast("Pay rate recovered", `"${payRate.name}" restored to Active.`, "success", "refresh");
        }
        setSidebarConfirm(null);
    }

    function placeholderInstructorAction(kind: "view" | "edit", instructor: Instructor) {
        // The Staff & Permissions module is now live — wire View / Edit to
        // the real staff detail + edit routes. The instructor id IS the
        // staff id (both modules key off the same `staff_profiles.id`).
        // Carry `returnTo` so the X-close on the staff detail page lands
        // the admin back here on this pay rate's detail tab.
        //
        // ⚠️ The pay-rate DETAIL route is `/staff/pay-rate/[id]`, NOT
        // `/admin/staff/pay-rate/[id]` (that's the LIST). Prefixing with
        // `/admin` produced a 404 when closing the staff detail modal.
        const returnTo = `/staff/pay-rate/${payRate?.id ?? ""}`;
        const base = `/staff/members/${instructor.id}`;
        const href = kind === "view"
            ? `${base}?returnTo=${encodeURIComponent(returnTo)}`
            : `${base}/edit?returnTo=${encodeURIComponent(returnTo)}`;
        router.push(href);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — same 72px chrome as products/[id] + gift-cards/[id] */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Pay rate details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={<Sidebar payRate={payRate} onAction={handleSidebarAction} branches={branches} />}
                main={
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
                        {/* Tabs — same h-[48px] underline pattern as membership/package detail */}
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            {/* "Additional settings" is hidden for Flat
                                rate AND Monthly salary — the two attendance
                                toggles don't apply when pay is a fixed
                                amount regardless of attendance (matches the
                                form, which hides this section for the same
                                two types). */}
                            <DetailPageTabs
                                tabs={[
                                    { key: "instructor", label: "Assigned staff" },
                                    { key: "settings", label: "Additional settings", hidden: payRate.type === "flat" || payRate.type === "monthly" },
                                ]}
                                activeKey={tab}
                                onChange={(k) => setTab(k as typeof tab)}
                            />
                        </div>

                        {/* Tab body */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                            {tab === "instructor" || payRate.type === "flat" || payRate.type === "monthly" ? (
                                <AssignedInstructorTab
                                    payRateId={payRate.id}
                                    payRateName={payRate.name}
                                    onPlaceholderAction={placeholderInstructorAction}
                                />
                            ) : (
                                <AdditionalSettingsTab payRate={payRate} />
                            )}
                        </div>
                    </div>
                }
            />

            {sidebarConfirm && (() => {
                const cfg = CONFIRM_CFG[sidebarConfirm.kind];
                const subject = `"${payRate.name}"`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setSidebarConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description(subject)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performSidebarAction(sidebarConfirm.kind)}
                    />
                );
            })()}

            <Toast />
        </div>
    );
}

// Local TabBtn removed — uses canonical `<DetailPageTabs>` from
// `@/components/patterns/DetailPageTabs`.
