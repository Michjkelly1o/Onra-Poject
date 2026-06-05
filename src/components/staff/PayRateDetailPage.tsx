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
import { useRouter } from "next/navigation";
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
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description(subject)}</p>
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

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}>
            {label}
        </button>
    );
}

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
    if (!open) return null;

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
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[420px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
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
            </div>
        </div>
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

    // Filter to just this pay rate's instructors.
    const assigned = useMemo(
        () => instructors.filter(i => i.payRateId === payRateId),
        [instructors, payRateId],
    );

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

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = filtered.slice((clamped - 1) * pageSize, clamped * pageSize);

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
                <div className="flex-1">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[14px] font-medium text-[#101828]">
                        {filtered.length} {filtered.length === 1 ? "instructor" : "instructors"}
                    </p>
                </div>
                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search instructor..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <Button variant="secondary-gray" size="md"
                    leftIcon={
                        <div className="relative">
                            <FilterLines className="w-4 h-4" />
                            {hasActiveFilter && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />}
                        </div>
                    }
                    onClick={() => setFilterOpen(true)}>
                    Filter
                </Button>
            </div>

            {/* Body */}
            {isEmpty ? (
                <div className="relative" style={{ minHeight: 320 }}>
                    <EmptyState
                        title="No instructors assigned"
                        subtitle="No staff member currently uses this pay rate."
                    />
                </div>
            ) : pageRows.length === 0 ? (
                <div className="relative" style={{ minHeight: 320 }}>
                    <EmptyState
                        title="No instructors found"
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
                                <th className={cn(TH, "w-[280px]")}>Name</th>
                                <th className={cn(TH, "w-[240px]")}>Contact</th>
                                <th className={cn(TH, "w-[200px]")}>Branch location</th>
                                <th className={cn(TH, "w-[160px]")}>Default pay rate</th>
                                <th className={cn(TH, "w-[120px]")}>Status</th>
                                <th className={cn(TH, "w-[52px]")} />
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map(r => {
                                const isSelected = selectedIds.has(r.id);
                                const branch = branches.find(b => b.id === r.branchId);
                                return (
                                    <tr key={r.id}
                                        className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                        <td className={TD}>
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
                                        <td className={TD}>
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
                    total={filtered.length}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={s => { setPageSize(s); setPage(1); }}
                />
            )}

            {pendingConfirm && (
                <ConfirmModal
                    kind={pendingConfirm.kind}
                    subject={`"${pendingConfirm.row.name}"`}
                    onCancel={() => setPendingConfirm(null)}
                    onConfirm={() => performAction(pendingConfirm)}
                />
            )}

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

// ─── Pagination (same chrome the pay-rate list uses) ────────────────────────

function Pagination({ page, total, pageSize, onPage, onPageSize }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="flex items-center gap-3 pt-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

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
            router.push(`/staff/pay-rate/${payRate.id}/edit?returnTo=/staff/pay-rate/${payRate.id}`);
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
        // Staff module isn't built yet — surface the intent with a toast so
        // the demo doesn't dead-end.
        const verb = kind === "view" ? "View" : "Edit";
        showToast(`${verb} instructor`, `${instructor.name} — coming in the staff module.`, "success", "check");
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
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Pay rate details</h1>
            </div>

            {/* Body — px-6 py-6 outer + h-[832px] two-column frame */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    <Sidebar payRate={payRate} onAction={handleSidebarAction} branches={branches} />

                    {/* Content card */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
                        {/* Tabs — same h-[48px] underline pattern as membership/package detail */}
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <div className="flex gap-1">
                                <TabBtn label="Assigned instructor" active={tab === "instructor"} onClick={() => setTab("instructor")} />
                                <TabBtn label="Additional settings" active={tab === "settings"} onClick={() => setTab("settings")} />
                            </div>
                        </div>

                        {/* Tab body */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                            {tab === "instructor" ? (
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
                </div>
            </div>

            {sidebarConfirm && (
                <ConfirmModal
                    kind={sidebarConfirm.kind}
                    subject={`"${payRate.name}"`}
                    onCancel={() => setSidebarConfirm(null)}
                    onConfirm={() => performSidebarAction(sidebarConfirm.kind)}
                />
            )}

            <Toast />
        </div>
    );
}

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
