"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Pay rate list view (/admin/staff/pay-rate)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 3714:36216.
//
// Phase 1 — module view only:
//   • Toolbar (branch selector / search / status filter / + Add pay rate)
//   • Table with bulk select
//   • Row actions: View details · Edit · Archive ⇄ Recover · Delete (zero-usage)
//   • Bulk actions: Archive · Recover · Delete (only when all selected zero-usage)
//   • Confirmation modal for every state change · Toast for every action
//
// Status model — only `active | archive` (no `deactivate` for this module).
//
// Mock data lives inline as a phase-1 placeholder and is migrated to a
// centralized seed in phase 4. Mutations run through local component state
// for now; the `useAppStore` swap is a one-call substitution when the seed
// + store slice land.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, ChevronLeft,
    Eye, Edit02, Trash01, Trash02, Archive, RefreshCcw01, MarkerPin01, XClose, AlignLeft, Check,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { RowActions } from "@/components/patterns/RowActions";
import {
    useAppStore,
    type PayRate, type PayRateStatus, type PayRateType,
    computePayRateDisplay,
} from "@/lib/store";

// ─── Display config ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<PayRateStatus, string> = {
    active: "Active",
    archive: "Archive",
};

const STATUS_BADGE_STYLE: Record<PayRateStatus, string> = {
    active:  "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    archive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};

const TYPE_LABEL: Record<PayRateType, string> = {
    flat:    "Flat",
    tiered:  "Tiered",
    revenue: "% of revenue",
    hybrid:  "Hybrid",
    monthly: "Monthly",
};

// Per brief: flat = blue, tiered = warning, revenue = green, hybrid = purple,
// monthly = brand (sage). Brand badge uses the same palette as the active
// status pill so the chip reads as a "house"-tagged item.
const TYPE_BADGE_STYLE: Record<PayRateType, string> = {
    flat:    "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    tiered:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    revenue: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    hybrid:  "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    monthly: "bg-[#f5fffa] border-1 border-[#aad4bd] text-[#3b5446]",
};

// ─── Filter state ────────────────────────────────────────────────────────────
//
// Single-status dropdown — same simpler shape as the gift-cards filter.
// `null` = "show all".

type StatusFilter = PayRateStatus | null;

// ─── Row actions ─────────────────────────────────────────────────────────────

type RowActionKind = "view" | "edit" | "archive" | "recover" | "delete";

// Local RowActions removed — uses canonical `@/components/patterns/RowActions`.
// Conditional items are pre-built in the call site via `hidden` flags so the
// menu only renders the items applicable to the row's status/usage.

// ─── Confirmation modal ──────────────────────────────────────────────────────

type ConfirmKind = "archive" | "recover" | "delete";

const CONFIRM_CFG: Record<ConfirmKind, {
    title: (subject: string) => string;
    description: (subject: string) => string;
    confirmLabel: string;
    destructive: boolean;
    Icon: React.ElementType;
    iconBg: string;
    iconColor: string;
}> = {
    archive: {
        title: s => `Archive ${s}?`,
        description: s => `${s} will be moved to the archive. You can recover it any time — staff already on this rate keep it until reassigned.`,
        confirmLabel: "Archive",
        destructive: false,
        Icon: Archive, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
    recover: {
        title: s => `Recover ${s}?`,
        description: s => `${s} will be restored to Active and available again in the pay-rate list.`,
        confirmLabel: "Recover",
        destructive: false,
        Icon: RefreshCcw01, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
    delete: {
        title: s => `Delete ${s}?`,
        description: s => `${s} will be permanently deleted. This can't be undone.`,
        confirmLabel: "Delete",
        destructive: true,
        Icon: Trash01, iconBg: "bg-[#fee4e2]", iconColor: "text-[#d92d20]",
    },
};

// Local ConfirmModal removed — uses canonical from
// `@/components/modals/ConfirmModal`, driven by CONFIRM_CFG above.

// ─── Status filter dropdown (single-select — mirrors gift-cards) ─────────────

function StatusFilterDropdown({ value, onChange }: {
    value: StatusFilter; onChange: (next: StatusFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const OPTIONS: { value: PayRateStatus; label: string }[] = [
        { value: "active",  label: "Active"  },
        { value: "archive", label: "Archive" },
    ];

    return (
        <div ref={ref} className="relative">
            <Button variant="secondary-gray" size="md"
                leftIcon={
                    <div className="relative">
                        <FilterLines className="w-4 h-4" />
                        {value !== null && (
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                        )}
                    </div>
                }
                onClick={() => setOpen(p => !p)}>
                Filter
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[160px]">
                    {OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => {
                                // Click the same option twice → clear the filter.
                                onChange(value === opt.value ? null : opt.value);
                                setOpen(false);
                            }}
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

// ─── Bulk action bar — floating bottom pill (matches gift-cards / customers) ─

interface BulkFlags { hasActive: boolean; hasArchive: boolean; allZeroUsage: boolean }

function BulkActionBar({ count, flags, onClear, onAction }: {
    count: number;
    flags: BulkFlags;
    onClear: () => void;
    onAction: (kind: "archive" | "recover" | "delete") => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {flags.hasActive && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Archive className="w-5 h-5 text-[#667085]" />} onClick={() => onAction("archive")}>
                            Archive
                        </Button>
                    )}
                    {flags.hasArchive && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("recover")}>
                            Recover
                        </Button>
                    )}
                    {flags.allZeroUsage && (
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

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

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
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Checkbox cell (same sage style as gift-cards / customers) ──────────────

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
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}>
            {indeterminate ? (
                <span className="block w-2 h-[1.5px] bg-white" />
            ) : checked ? (
                <Check className="w-3 h-3" />
            ) : null}
        </button>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { kind: "archive" | "recover" | "delete"; ids: string[] }
    | null;

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

export default function PayRatePage() {
    const router = useRouter();
    const payRates           = useAppStore(s => s.payRates);
    const branches           = useAppStore(s => s.branches);
    const setPayRatesStatus  = useAppStore(s => s.setPayRatesStatus);
    const deletePayRatesAction = useAppStore(s => s.deletePayRates);
    const showToast          = useAppStore(s => s.showToast);

    // "" = "All locations" — pay rates default to the aggregate view.
    const [branchId, setBranchId] = useState<string>("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<StatusFilter>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

    useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [branchId, search, filter]);

    // ─── Filtering ─────────────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return payRates.filter(r => {
            // `branchId === ""` means "All locations" — skip the branch
            // filter entirely. Otherwise exact-match.
            if (branchId && r.branchId !== branchId) return false;
            if (filter !== null && r.status !== filter) return false;
            if (q) {
                const display = computePayRateDisplay(r);
                if (!r.name.toLowerCase().includes(q)
                    && !display.main.toLowerCase().includes(q)
                    && !display.subtitle.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [payRates, branchId, search, filter]);

    // ── Sortable columns — Name / Type / Rate (numeric where possible) /
    //    Branch / Status. The Rate comparator falls back to the display
    //    string when an item doesn't have a sortable numeric amount
    //    (e.g. Hybrid rates show a phrase, not a single number). ──
    const STATUS_ORDER: Record<PayRateStatus, number> = { active: 0, inactive: 1, archive: 2 } as Record<PayRateStatus, number>;
    function rateSortValue(r: PayRate): number {
        if (r.type === "flat")    return r.flatAmount ?? 0;
        if (r.type === "monthly") return r.fixedSalary ?? 0;
        if (r.type === "revenue") return r.splitPercent ?? 0;
        if (r.type === "tiered")  return r.tiers?.[0]?.aed ?? 0;
        if (r.type === "hybrid")  return r.baseRate ?? 0;
        return 0;
    }
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<PayRate>(filteredRows, {
        name:   (a, b) => a.name.localeCompare(b.name),
        type:   (a, b) => TYPE_LABEL[a.type].localeCompare(TYPE_LABEL[b.type]),
        rate:   (a, b) => rateSortValue(a) - rateSortValue(b),
        branch: (a, b) => {
            const an = branches.find(x => x.id === a.branchId)?.name ?? "";
            const bn = branches.find(x => x.id === b.branchId)?.name ?? "";
            return an.localeCompare(bn);
        },
        status: (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Bulk select ───────────────────────────────────────────────────────
    const pageIds = useMemo(() => pagedRows.map(r => r.id), [pagedRows]);
    const allChecked = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const someChecked = pageIds.some(id => selectedIds.has(id)) && !allChecked;
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
    function clearSelection() { setSelectedIds(new Set()); }

    // Bulk action availability — derived from the selected rows.
    // Delete is only offered when every selected row is Active AND zero-usage;
    // archived rows must be Recovered before they can be deleted.
    const selectedRows = useMemo(() => payRates.filter(r => selectedIds.has(r.id)), [payRates, selectedIds]);
    const bulkFlags: BulkFlags = useMemo(() => ({
        hasActive:    selectedRows.some(r => r.status === "active"),
        hasArchive:   selectedRows.some(r => r.status === "archive"),
        allZeroUsage: selectedRows.length > 0
            && selectedRows.every(r => r.status === "active" && r.usageCount === 0),
    }), [selectedRows]);

    // ─── Actions (route through Zustand actions + toast) ───────────────────
    function performAction(kind: "archive" | "recover" | "delete", ids: string[]) {
        const subjectOf = (ids: string[]) => ids.length === 1
            ? `"${payRates.find(r => r.id === ids[0])?.name ?? "Pay rate"}"`
            : `${ids.length} pay rates`;

        if (kind === "delete") {
            const subject = subjectOf(ids);
            deletePayRatesAction(ids);
            showToast("Pay rate deleted", `${subject} permanently removed.`, "success", "trash");
        } else {
            const subject = subjectOf(ids);
            const nextStatus: PayRateStatus = kind === "archive" ? "archive" : "active";
            setPayRatesStatus(ids, nextStatus);
            if (kind === "archive") {
                showToast("Pay rate archived", `${subject} moved to archive.`, "success", "archive");
            } else {
                showToast("Pay rate recovered", `${subject} restored to Active.`, "success", "refresh");
            }
        }
        setSelectedIds(new Set());
        setPendingConfirm(null);
    }

    function openConfirm(kind: "archive" | "recover" | "delete", ids: string[]) {
        setPendingConfirm({ kind, ids });
    }

    function openBulkConfirm(kind: "archive" | "recover" | "delete") {
        if (selectedIds.size === 0) return;
        openConfirm(kind, Array.from(selectedIds));
    }

    function handleRowAction(row: PayRate, kind: RowActionKind) {
        if (kind === "view") {
            router.push(`/staff/pay-rate/${row.id}?returnTo=${encodeURIComponent("/admin/staff/pay-rate")}`);
            return;
        }
        if (kind === "edit") {
            router.push(`/staff/pay-rate/${row.id}/edit?returnTo=/admin/staff/pay-rate`);
            return;
        }
        openConfirm(kind, [row.id]);
    }

    // ─── Branch options (live `branches` slice — single source of truth) ───
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // "All locations" mode shows the full table; specific branch filters
    // narrow down. Same predicate used by the main filter chain above.
    const branchScopeRows = payRates.filter(r => !branchId || r.branchId === branchId);
    const isTrulyEmpty = branchScopeRows.length === 0;
    const totalForBranch = branchScopeRows.length;

    // Confirm modal subject + action labelling — uses pendingConfirm payload.
    function modalSubject(p: NonNullable<PendingConfirm>): string {
        if (p.ids.length === 1) {
            return `"${payRates.find(r => r.id === p.ids[0])?.name ?? "this pay rate"}"`;
        }
        return `${p.ids.length} pay rates`;
    }

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={totalForBranch} entitySingular="pay rate" />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search pay rate..." />
                <StatusFilterDropdown value={filter} onChange={setFilter} />
                <Button variant="primary" size="md"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push("/staff/pay-rate/new?returnTo=/admin/staff/pay-rate")}>
                    Add pay rate
                </Button>
            </div>

            {/* Table area — borderless full-bleed (matches the customers list) */}
            <div className="h-[760px] flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {pagedRows.length === 0 ? (
                        <EmptyState
                            title={isTrulyEmpty ? "No pay rates yet" : "No pay rates found"}
                            subtitle={isTrulyEmpty
                                ? "Add your first pay rate to get started."
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
                                                onChange={() => toggleAllOnPage()}
                                                ariaLabel="Select all rows on this page"
                                            />
                                        </th>
                                        <th className={cn(TH, "w-[260px]")}>
                                            <SortableHeader sortKey="name"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Pay rate name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[160px]")}>
                                            <SortableHeader sortKey="type"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Pay rate type</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[260px]")}>
                                            <SortableHeader sortKey="rate"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Rate</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[220px]")}>
                                            <SortableHeader sortKey="branch" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Branch location</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map(r => {
                                        const isSelected = selectedIds.has(r.id);
                                        return (
                                            <tr key={r.id}
                                                onClick={() => router.push(`/staff/pay-rate/${r.id}?returnTo=${encodeURIComponent("/admin/staff/pay-rate")}`)}
                                                className={cn("transition-colors cursor-pointer", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <CheckboxCell
                                                        checked={isSelected}
                                                        onChange={() => toggleOne(r.id)}
                                                        ariaLabel={`Select ${r.name}`}
                                                    />
                                                </td>
                                                <td className={TD}>
                                                    <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                                </td>
                                                <td className={TD}>
                                                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", TYPE_BADGE_STYLE[r.type])}>
                                                        {TYPE_LABEL[r.type]}
                                                    </span>
                                                </td>
                                                <td className={TD}>
                                                    {(() => {
                                                        const d = computePayRateDisplay(r);
                                                        return (
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] text-[#101828]">{d.main}</span>
                                                                <span className="text-[13px] text-[#667085]">{d.subtitle}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className={cn(TD, "text-[#475467]")}>
                                                    {branches.find(b => b.id === r.branchId)?.name ?? "—"}
                                                </td>
                                                <td className={TD}>
                                                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", STATUS_BADGE_STYLE[r.status])}>
                                                        {STATUS_LABEL[r.status]}
                                                    </span>
                                                </td>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <RowActions
                                                        items={[
                                                            { label: "View details", icon: Eye, onClick: () => handleRowAction(r, "view") },
                                                            { label: "Edit", icon: Edit02, onClick: () => handleRowAction(r, "edit"), hidden: r.status !== "active" },
                                                            { label: "Archive", icon: Archive, onClick: () => handleRowAction(r, "archive"), hidden: r.status !== "active" },
                                                            { label: "Recover", icon: RefreshCcw01, onClick: () => handleRowAction(r, "recover"), hidden: r.status === "active" },
                                                            { label: "Delete", icon: Trash01, onClick: () => handleRowAction(r, "delete"), hidden: !(r.status === "active" && r.usageCount === 0), danger: true },
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="shrink-0">
                    <Pagination
                        page={clampedPage} total={sortedRows.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            {/* Bulk action bar — floats above the page (fixed bottom) */}
            <BulkActionBar
                count={selectedIds.size}
                flags={bulkFlags}
                onClear={clearSelection}
                onAction={openBulkConfirm}
            />

            {pendingConfirm && (() => {
                const cfg = CONFIRM_CFG[pendingConfirm.kind];
                const subject = modalSubject(pendingConfirm);
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description(subject)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performAction(pendingConfirm.kind, pendingConfirm.ids)}
                    />
                );
            })()}

            <Toast />
        </div>
    );
}
