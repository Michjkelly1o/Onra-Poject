"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer list view (/admin/customers)
// ─────────────────────────────────────────────────────────────────────────────
//
// Owner-first build per CLAUDE.md. Figma: 2481:23104 (list) + 2481:23065 (filter).
//
// Patterns reused (no reinvention — Brief rule #2):
//   • Toolbar / view-card chrome / Pagination / CheckboxCell / BulkActionBar /
//     ActionModal / FilterPill / EmptyState — all lifted from /admin/products.
//   • TableAvatar (image-or-initials) from the DS for the Name cell.
//   • Row-action ⋮ menu via FixedDropdown.
//
// State source of truth: useAppStore(s => s.customers). Every action
// (create / edit / deactivate / reactivate / archive / recover / delete)
// goes through the store so dependent surfaces re-render in the same cycle.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, DotsVertical, ChevronLeft,
    Eye, Edit02, Trash01, Trash02, Archive, Check, Download01, Upload01,
    MarkerPin01, AlignLeft, XClose, RefreshCcw01, SlashCircle01, HeartHand,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { TableAvatar } from "@/components/ui/avatar";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { useAppStore, DEFAULT_BRANCH_ID, type Customer } from "@/lib/store";
import { CustomerImportModal } from "@/components/customers/CustomerImportModal";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Types & constants ───────────────────────────────────────────────────────

type CustomerStatus = Customer["status"];     // "active" | "inactive" | "archived"
type PlanType = "membership" | "package" | "none";
type LastVisitBucket = "7d" | "30d" | "60d" | "90d" | "over90" | "never";
type RowActionKind = "deactivate" | "reactivate" | "archive" | "recover" | "delete";

const ALL_STATUSES: CustomerStatus[] = ["active", "inactive", "archived"];
const STATUS_LABEL: Record<CustomerStatus, string> = {
    active: "Active", inactive: "Inactive", archived: "Archived",
};
const STATUS_ORDER: Record<CustomerStatus, number> = { active: 0, inactive: 1, archived: 2 };

const ALL_PLAN_TYPES: PlanType[] = ["membership", "package", "none"];
const PLAN_LABEL: Record<PlanType, string> = {
    membership: "Membership", package: "Credit package", none: "No plan",
};

const LAST_VISIT_OPTIONS: { value: LastVisitBucket; label: string }[] = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "60d", label: "Last 60 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "over90", label: "Over 90 days ago" },
    { value: "never", label: "Never visited" },
];

interface FilterState {
    statuses: CustomerStatus[];
    planTypes: PlanType[];
    lastVisit: LastVisitBucket[];
    branchId: string;          // "" = any branch
    planExpiryStart: string;   // "" = no lower bound
    planExpiryEnd: string;     // "" = no upper bound
}
const EMPTY_FILTER: FilterState = {
    statuses: [], planTypes: [], lastVisit: [], branchId: "", planExpiryStart: "", planExpiryEnd: "",
};

// ─── Display helpers ─────────────────────────────────────────────────────────

/** "Mar 25, 2026" — accepts both date-only ISO and full timestamps; UTC-anchored. */
function fmtDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Whole days between two "YYYY-MM-DD" calendar dates (UTC-anchored). */
function daysBetween(fromISO: string, toISO: string): number {
    const a = new Date(`${fromISO}T00:00:00Z`).getTime();
    const b = new Date(`${toISO}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86_400_000);
}

function planTypeOf(planKind: Customer["planKind"]): PlanType {
    return planKind === "membership" ? "membership" : planKind === "package" ? "package" : "none";
}

// ─── Status + plan badges ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CustomerStatus }) {
    // Matches the /admin/products + /admin/class-types badge palette.
    const styles: Record<CustomerStatus, string> = {
        active: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        archived: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            styles[status],
        )}>
            {STATUS_LABEL[status]}
        </span>
    );
}

function PlanBadge({ type }: { type: PlanType }) {
    if (type === "none") {
        return (
            <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap bg-white border border-dashed border-[#d0d5dd] text-[#667085]">
                No plan
            </span>
        );
    }
    const styles: Record<"membership" | "package", string> = {
        membership: "bg-[#eef4ff] border-1 border-[#c7d7fe] text-[#3538cd]",
        package: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            styles[type],
        )}>
            {PLAN_LABEL[type]}
        </span>
    );
}

// ─── Filter pill (multi-select chip) ─────────────────────────────────────────

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}>
            {label}
        </button>
    );
}

// ─── Row actions (⋮) ─────────────────────────────────────────────────────────

function RowActions({ status, hasHistory, onView, onEdit, onAddCredit, onAction }: {
    status: CustomerStatus;
    /** True when the customer has booking history — gates Delete (archive only). */
    hasHistory: boolean;
    onView: () => void;
    onEdit: () => void;
    onAddCredit: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);

    function trigger(fn: () => void) { setOpen(false); fn(); }

    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)}>
                {/* View profile — opens the customer detail page (all statuses). */}
                <button type="button" onClick={() => trigger(onView)}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View profile
                </button>

                {/* Edit — Active customers only. Inactive must be Reactivated,
                    Archived must be Recovered before they can be edited. */}
                {status === "active" && (
                    <button type="button" onClick={() => trigger(onEdit)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Edit02 className="w-4 h-4 text-[#667085]" />Edit
                    </button>
                )}

                {/* Add complimentary credit — Active customers only. */}
                {status === "active" && (
                    <button type="button" onClick={() => trigger(onAddCredit)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <HeartHand className="w-4 h-4 text-[#667085]" />Add complimentary credit
                    </button>
                )}

                {/* Archive — active + inactive (success-tone modal). */}
                {status !== "archived" && (
                    <button type="button" onClick={() => trigger(() => onAction("archive"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Archive className="w-4 h-4 text-[#667085]" />Archive
                    </button>
                )}

                {/* Reactivate — inactive only. */}
                {status === "inactive" && (
                    <button type="button" onClick={() => trigger(() => onAction("reactivate"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Check className="w-4 h-4 text-[#667085]" />Reactivate
                    </button>
                )}

                {/* Recover — archived only. */}
                {status === "archived" && (
                    <button type="button" onClick={() => trigger(() => onAction("recover"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <RefreshCcw01 className="w-4 h-4 text-[#667085]" />Recover
                    </button>
                )}

                {/* Deactivate ↔ Delete — one destructive slot, Active rows only.
                    No booking history → Delete; otherwise Deactivate.
                    Inactive customers must be Reactivated and archived
                    customers must be Recovered before they can be deleted. */}
                {status === "active" && (
                    hasHistory ? (
                        <button type="button" onClick={() => trigger(() => onAction("deactivate"))}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                            <SlashCircle01 className="w-4 h-4 text-[#b42318]" />Deactivate
                        </button>
                    ) : (
                        <button type="button" onClick={() => trigger(() => onAction("delete"))}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                            <Trash01 className="w-4 h-4 text-[#b42318]" />Delete
                        </button>
                    )
                )}
            </FixedDropdown>
        </div>
    );
}

// ─── Action modal (tone matrix mirrors /admin/products) ──────────────────────

const DESTRUCTIVE_ACTIONS = new Set<RowActionKind>(["deactivate", "delete"]);

const MODAL_CONFIG: Record<RowActionKind, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this customer?",
        titleBulk: n => `Archive ${n} customers?`,
        description: subject => <>{subject} will be hidden from the default customer list. All history is preserved — you can recover archived customers at any time.</>,
        confirmLabel: "Archive",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this customer?",
        titleBulk: n => `Deactivate ${n} customers?`,
        description: (subject, n) => <>{subject} will be suspended — login is disabled and {n === 1 ? "they cannot" : "they cannot"} make new bookings. Existing bookings are not cancelled.</>,
        confirmLabel: "Deactivate",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this customer?",
        titleBulk: n => `Recover ${n} customers?`,
        description: subject => <>{subject} will be restored to Active status and shown in the customer list again.</>,
        confirmLabel: "Recover",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        titleSingle: "Reactivate this customer?",
        titleBulk: n => `Reactivate ${n} customers?`,
        description: subject => <>{subject} will be reactivated — login is re-enabled and they can book classes again.</>,
        confirmLabel: "Reactivate",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        titleSingle: "Delete this customer?",
        titleBulk: n => `Delete ${n} customers?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
    },
};

function ActionModal({ action, count, subject, onConfirm, onCancel }: {
    action: RowActionKind;
    count: number;
    subject: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const cfg = MODAL_CONFIG[action];
    const title = count === 1 ? cfg.titleSingle : cfg.titleBulk(count);
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", cfg.iconBg)}>
                        <cfg.IconComp className={cn("w-6 h-6", cfg.iconColor)} />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description(subject, count)}</p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant={DESTRUCTIVE_ACTIONS.has(action) ? "destructive" : "primary"} size="lg" className="flex-1" onClick={onConfirm}>
                        {cfg.confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[340px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Filter side panel ───────────────────────────────────────────────────────

function FilterPanel({ open, onClose, applied, onApply, branchOptions }: {
    open: boolean; onClose: () => void;
    applied: FilterState;
    onApply: (next: FilterState) => void;
    branchOptions: { value: string; label: string }[];
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggle<T>(arr: T[], val: T): T[] {
        return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    }

    const hasAny =
        pending.statuses.length > 0 ||
        pending.planTypes.length > 0 ||
        pending.lastVisit.length > 0 ||
        pending.branchId !== "" ||
        pending.planExpiryStart !== "" ||
        pending.planExpiryEnd !== "";

    return (
        <SlidePanel open={open} onClose={onClose} width={420}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map(s => (
                                <FilterPill key={s} label={STATUS_LABEL[s]} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Plan expiry date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Plan expiry date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker
                                value={pending.planExpiryStart}
                                onChange={v => setPending(p => ({
                                    ...p,
                                    planExpiryStart: v,
                                    // keep end ≥ start
                                    planExpiryEnd: p.planExpiryEnd && v && p.planExpiryEnd < v ? "" : p.planExpiryEnd,
                                }))}
                                placeholder="Start date"
                            />
                            <DatePicker
                                value={pending.planExpiryEnd}
                                onChange={v => setPending(p => ({ ...p, planExpiryEnd: v }))}
                                placeholder="End date"
                                minDate={pending.planExpiryStart || undefined}
                            />
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Plan type */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Plan type</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_PLAN_TYPES.map(t => (
                                <FilterPill key={t} label={PLAN_LABEL[t]} selected={pending.planTypes.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, planTypes: toggle(p.planTypes, t) }))} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Branch location */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Branch location</p>
                        <SelectInput
                            triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                            placeholder="Select location"
                            options={[{ value: "", label: "All locations" }, ...branchOptions]}
                            value={pending.branchId}
                            onChange={v => setPending(p => ({ ...p, branchId: v }))}
                            width="w-full"
                        />
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Last visit date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Last visit date range</p>
                        <div className="flex flex-wrap gap-2">
                            {LAST_VISIT_OPTIONS.map(o => (
                                <FilterPill key={o.value} label={o.label} selected={pending.lastVisit.includes(o.value)}
                                    onClick={() => setPending(p => ({ ...p, lastVisit: toggle(p.lastVisit, o.value) }))} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

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
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
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

// ─── Checkbox cell ───────────────────────────────────────────────────────────

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
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// ─── Floating bulk action bar ────────────────────────────────────────────────

function BulkActionBar({ count, flags, onClear, onAction }: {
    count: number;
    flags: { archive: boolean; deactivate: boolean; reactivate: boolean; recover: boolean; delete: boolean };
    onClear: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 inline-flex items-center gap-3">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {flags.archive && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Archive className="w-5 h-5 text-[#667085]" />} onClick={() => onAction("archive")}>
                            Archive
                        </Button>
                    )}
                    {flags.reactivate && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Check className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("reactivate")}>
                            Reactivate
                        </Button>
                    )}
                    {flags.recover && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("recover")}>
                            Recover
                        </Button>
                    )}
                    {flags.deactivate && (
                        <Button variant="secondary-gray" size="sm"
                            className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                            leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                            onClick={() => onAction("deactivate")}>
                            Deactivate
                        </Button>
                    )}
                    {flags.delete && (
                        <Button variant="secondary-gray" size="sm"
                            className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                            leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                            onClick={() => onAction("delete")}>
                            Delete
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Export dropdown ─────────────────────────────────────────────────────────

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ExportDropdown({ disabled, onExportCsv }: { disabled: boolean; onExportCsv: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <Button variant="secondary-gray" size="md"
                leftIcon={<Download01 className="w-4 h-4" />}
                disabled={disabled}
                onClick={() => setOpen(p => !p)}>
                Export
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    {EXPORT_FORMATS.map(fmt => (
                        <button key={fmt} type="button"
                            onClick={() => {
                                setOpen(false);
                                // Only CSV is wired today; PDF / Excel come later.
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Table header/cell constants ─────────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Row shape ───────────────────────────────────────────────────────────────

type CustomerRow = {
    id: string;
    name: string;
    initials: string;
    imageUrl?: string;
    email: string;
    phone: string;
    joinedISO: string;
    planType: PlanType;
    status: CustomerStatus;
    lastVisitISO?: string;
    planExpiryISO?: string;
    branchId: string;
    /** True when the customer has booking history — Delete is gated on this. */
    hasHistory: boolean;
};

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportCustomersCsv(rows: CustomerRow[]) {
    const header = ["Name", "Email", "Phone", "Plan", "Status", "Joined", "Last visit"];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const body = rows.map(r => [
        r.name, r.email, r.phone,
        PLAN_LABEL[r.planType], STATUS_LABEL[r.status],
        fmtDate(r.joinedISO), r.lastVisitISO ? fmtDate(r.lastVisitISO) : "Never visited",
    ]);
    const csv = [header, ...body].map(line => line.map(esc).join(",")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row"; row: CustomerRow; kind: RowActionKind }
    | { mode: "bulk"; rows: CustomerRow[]; kind: RowActionKind };

export default function CustomersPage() {
    const router = useRouter();

    // ─── Store subscriptions ────────────────────────────────────────────────
    const customers = useAppStore(s => s.customers);
    const classBookings = useAppStore(s => s.classBookings);
    const branches = useAppStore(s => s.branches);
    const setCustomerStatus = useAppStore(s => s.setCustomerStatus);
    const deleteCustomers = useAppStore(s => s.deleteCustomers);
    const showToast = useAppStore(s => s.showToast);

    // ─── Local UI state ─────────────────────────────────────────────────────
    const [branchId, setBranchId] = useState<string>(DEFAULT_BRANCH_ID);
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<FilterState>(EMPTY_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
    const [importOpen, setImportOpen] = useState(false);

    // Reset to page 1 whenever the result set changes shape.
    useEffect(() => { setPage(1); }, [search, applied, branchId, pageSize]);

    // Branch dropdown — active branches from the live `branches` slice so
    // adds/archives in Business & Locations propagate immediately.
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    // ─── Build rows (history flag derived live from bookings) ───────────────
    const allRows = useMemo<CustomerRow[]>(() => {
        const bookedCustomerIds = new Set(classBookings.map(b => b.customerId));
        // Newest customers first so a just-created customer lands at the top.
        return [...customers]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(c => ({
                id: c.id,
                name: `${c.firstName} ${c.lastName}`.trim(),
                initials: c.initials,
                imageUrl: c.imageUrl,
                email: c.email,
                phone: c.phone ?? "",
                joinedISO: c.createdAt,
                planType: planTypeOf(c.planKind),
                status: c.status,
                lastVisitISO: c.lastVisitISO,
                planExpiryISO: c.planExpiryISO,
                branchId: c.branchId,
                hasHistory: bookedCustomerIds.has(c.id),
            }));
    }, [customers, classBookings]);

    // ─── Apply branch + search + filter ─────────────────────────────────────
    const today = todayISO();
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();

        function matchesLastVisit(r: CustomerRow): boolean {
            if (applied.lastVisit.length === 0) return true;
            return applied.lastVisit.some(bucket => {
                if (bucket === "never") return !r.lastVisitISO;
                if (!r.lastVisitISO) return false;
                const days = daysBetween(r.lastVisitISO, today);
                switch (bucket) {
                    case "7d": return days >= 0 && days <= 7;
                    case "30d": return days >= 0 && days <= 30;
                    case "60d": return days >= 0 && days <= 60;
                    case "90d": return days >= 0 && days <= 90;
                    case "over90": return days > 90;
                }
            });
        }

        return allRows.filter(r => {
            if (branchId && r.branchId !== branchId) return false;
            if (q && !(
                r.name.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q) ||
                r.phone.toLowerCase().includes(q)
            )) return false;
            if (applied.statuses.length > 0 && !applied.statuses.includes(r.status)) return false;
            if (applied.planTypes.length > 0 && !applied.planTypes.includes(r.planType)) return false;
            if (applied.branchId && r.branchId !== applied.branchId) return false;
            if (!matchesLastVisit(r)) return false;
            if (applied.planExpiryStart || applied.planExpiryEnd) {
                // No-plan customers have no expiry — excluded once the range is set.
                if (!r.planExpiryISO) return false;
                if (applied.planExpiryStart && r.planExpiryISO < applied.planExpiryStart) return false;
                if (applied.planExpiryEnd && r.planExpiryISO > applied.planExpiryEnd) return false;
            }
            return true;
        });
    }, [allRows, branchId, search, applied, today]);

    // ─── Pagination slice ───────────────────────────────────────────────────
    // ── Sortable columns — Name / Contact / Plan / Status / Last visit. ──
    const STATUS_ORDER: Record<CustomerStatus, number> = { active: 0, inactive: 1, archived: 2 };
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<CustomerRow>(filteredRows, {
        name:      (a, b) => a.name.localeCompare(b.name),
        contact:   (a, b) => a.email.localeCompare(b.email),
        plan:      (a, b) => a.planType.localeCompare(b.planType),
        status:    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
        lastVisit: (a, b) => {
            // No-visit rows sort to the end regardless of direction by
            // pegging them to a sentinel that's larger than any real ISO.
            const av = a.lastVisitISO ?? "9999-99-99";
            const bv = b.lastVisitISO ?? "9999-99-99";
            return av.localeCompare(bv);
        },
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Selection ──────────────────────────────────────────────────────────
    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    }
    function toggleAllOnPage(check: boolean) {
        const next = new Set(selectedIds);
        if (check) pagedRows.forEach(r => next.add(r.id));
        else pagedRows.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    function clearSelection() { setSelectedIds(new Set()); }

    const allChecked = pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && pagedRows.some(r => selectedIds.has(r.id));

    // Selected rows resolved against the full filtered set (selection survives
    // pagination), and bulk-bar action flags derived from them.
    const selectedRows = useMemo(
        () => filteredRows.filter(r => selectedIds.has(r.id)),
        [filteredRows, selectedIds],
    );
    // Deactivate ↔ Delete is one slot, never both — Delete only when every
    // selected row is Active AND history-free; inactive/archived rows must
    // be reactivated/recovered first.
    const allActiveHistoryFree = selectedRows.length > 0
        && selectedRows.every(r => r.status === "active" && !r.hasHistory);
    const anyActiveSelected = selectedRows.some(r => r.status === "active");
    const bulkFlags = {
        archive: selectedRows.some(r => r.status !== "archived"),
        reactivate: selectedRows.some(r => r.status === "inactive"),
        recover: selectedRows.some(r => r.status === "archived"),
        deactivate: !allActiveHistoryFree && anyActiveSelected,
        delete: allActiveHistoryFree,
    };

    // ─── Active-filter dot ──────────────────────────────────────────────────
    const hasActiveFilter =
        applied.statuses.length > 0 || applied.planTypes.length > 0 ||
        applied.lastVisit.length > 0 || applied.branchId !== "" ||
        applied.planExpiryStart !== "" || applied.planExpiryEnd !== "";

    // ─── Action plumbing ────────────────────────────────────────────────────
    function openRowConfirm(row: CustomerRow, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "archive": return selectedRows.filter(r => r.status !== "archived");
                case "recover": return selectedRows.filter(r => r.status === "archived");
                case "delete": return selectedRows.filter(r => r.status === "active" && !r.hasHistory);
            }
        })();
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const kind = pending.kind;
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;
        const ids = rows.map(r => r.id);
        const single = rows.length === 1;

        if (kind === "delete") {
            const { deleted } = deleteCustomers(ids);
            if (deleted.length > 0) {
                showToast(
                    single ? "Customer deleted" : `${deleted.length} customers deleted`,
                    single
                        ? `${rows[0].name} has been permanently removed.`
                        : "The selected customers have been permanently removed.",
                    "success", "trash",
                );
            }
            clearSelection();
            setPendingConfirm(null);
            return;
        }

        // ─── Status mutations (deactivate / reactivate / archive / recover) ──
        const nextStatus: CustomerStatus =
            kind === "deactivate" ? "inactive" :
            kind === "reactivate" ? "active" :
            kind === "archive" ? "archived" :
            /* recover */ "active";
        setCustomerStatus(ids, nextStatus);

        const verbPast =
            kind === "deactivate" ? "deactivated" :
            kind === "reactivate" ? "reactivated" :
            kind === "archive" ? "archived" :
            "recovered";
        const icon: "slash" | "check" | "archive" | "refresh" =
            kind === "deactivate" ? "slash" :
            kind === "reactivate" ? "check" :
            kind === "archive" ? "archive" :
            "refresh";
        const tone: "success" | "error" = kind === "deactivate" ? "error" : "success";

        if (single) {
            showToast(
                `Customer ${verbPast}`,
                `${rows[0].name} has been ${verbPast}.`,
                tone, icon,
            );
        } else {
            showToast(
                `${rows.length} customers ${verbPast}`,
                `The selected customers have been ${verbPast}.`,
                tone, icon,
            );
        }
        clearSelection();
        setPendingConfirm(null);
    }

    // ─── Modal subject ──────────────────────────────────────────────────────
    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[#344054]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected customers</>,
        };
    }

    const isTrulyEmpty = allRows.length === 0;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {filteredRows.length} {filteredRows.length === 1 ? "customer" : "customers"}
                    </p>
                </div>
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search customer..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <ExportDropdown
                    disabled={filteredRows.length === 0}
                    onExportCsv={() => {
                        exportCustomersCsv(filteredRows);
                        showToast("Customer list exported", `${filteredRows.length} customer${filteredRows.length === 1 ? "" : "s"} exported to CSV.`, "success", "check");
                    }}
                />
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
                {/* Import-only entry from the customers module — direct
                    create flow lives only on POS / class-schedule add-
                    customer paths (`/customers/new?returnTo=...`). */}
                <Button variant="primary" size="md"
                    leftIcon={<Upload01 className="w-4 h-4" />}
                    onClick={() => setImportOpen(true)}>
                    Import data
                </Button>
            </div>

            {/* ── Table area — sits flush on the admin chrome, no outer
                   border / card wrapper (same as the gift-cards list). ── */}
            <div className="h-[760px] flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {pagedRows.length === 0 ? (
                        <EmptyState
                            title={isTrulyEmpty ? "No customers yet" : "No customers found"}
                            subtitle={isTrulyEmpty
                                ? "Add your first customer to get started."
                                : "Try adjusting your search or filters."}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[44px]")}>
                                            <CheckboxCell
                                                checked={allChecked}
                                                indeterminate={someChecked}
                                                onChange={toggleAllOnPage}
                                                ariaLabel="Select all rows on this page"
                                            />
                                        </th>
                                        <th className={cn(TH, "w-[280px]")}>
                                            <SortableHeader sortKey="name"      currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[240px]")}>
                                            <SortableHeader sortKey="contact"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Contact</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[150px]")}>
                                            <SortableHeader sortKey="plan"      currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Plan</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status"    currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="lastVisit" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Last visit</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map(r => {
                                        const isSelected = selectedIds.has(r.id);
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
                                                        <TableAvatar initials={r.initials} imageUrl={r.imageUrl} size={40} />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[14px] font-medium text-[#101828] truncate">{r.name}</span>
                                                            <span className="text-[13px] text-[#667085]">Joined {fmtDate(r.joinedISO)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[14px] text-[#475467] truncate">{r.email}</span>
                                                        <span className="text-[13px] text-[#667085]">{r.phone || "—"}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}><PlanBadge type={r.planType} /></td>
                                                <td className={TD}><StatusBadge status={r.status} /></td>
                                                <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>
                                                    {r.lastVisitISO ? fmtDate(r.lastVisitISO) : "—"}
                                                </td>
                                                <td className={TD}>
                                                    <RowActions
                                                        status={r.status}
                                                        hasHistory={r.hasHistory}
                                                        onView={() => router.push(`/customers/${r.id}`)}
                                                        onEdit={() => router.push(`/customers/${r.id}/edit?returnTo=/admin/customers`)}
                                                        onAddCredit={() => router.push(`/customers/${r.id}/add-credit?returnTo=/admin/customers`)}
                                                        onAction={k => openRowConfirm(r, k)}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Floating bulk action pill */}
                    <BulkActionBar
                        count={selectedIds.size}
                        flags={bulkFlags}
                        onClear={clearSelection}
                        onAction={openBulkConfirm}
                    />
                </div>

                <div className="shrink-0">
                    <Pagination
                        page={clampedPage} total={sortedRows.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={f => { setApplied(f); setPage(1); }}
                branchOptions={branchOptions}
            />

            {pendingConfirm && (() => {
                const { count, subject } = modalSubject(pendingConfirm);
                return (
                    <ActionModal
                        action={pendingConfirm.kind}
                        count={count}
                        subject={subject}
                        onConfirm={() => performAction(pendingConfirm)}
                        onCancel={() => setPendingConfirm(null)}
                    />
                );
            })()}

            <CustomerImportModal open={importOpen} onClose={() => setImportOpen(false)} />

            <Toast />
        </div>
    );
}
