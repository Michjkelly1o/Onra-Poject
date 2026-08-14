"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail list view (/admin/products/retail)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase B (2026-07-29) — real store wiring. Reads from retailProducts +
// retailStock + retailCategories, computes stock aggregates on the fly,
// and drives every action through Zustand so downstream surfaces (Phase D
// POS, Phase E reports) stay in agreement.
//
// Chrome mirrors Gift cards exactly so admins move between the two lists
// without re-learning where things are.

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    Plus, Eye, Edit02, Archive, Trash01, Trash02, Image01,
    Check, RefreshCcw01, SlashCircle01, XClose, Package,
    ChevronDown, ChevronRight, MarkerPin01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { ArchivedSection } from "@/components/patterns/ArchivedSection";
import { useArchiveView } from "@/lib/hooks/useArchiveView";
import {
    useRetailCategoriesController,
    RetailCategoriesToolbar,
    RetailCategoriesPanel,
    RetailCategoriesPagination,
} from "@/components/retail/RetailCategoriesView";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { ToolbarImportButton } from "@/components/patterns/ToolbarImportButton";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { Sliders } from "@/components/icons/Sliders";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { FilterPill } from "@/components/ui/FilterPill";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfigureStockPanel } from "@/components/retail/ConfigureStockPanel";
import { matrixToExportData } from "@/lib/export/export-data";
import { useAppStore, type RetailProduct } from "@/lib/store";
import { useBulkSelectionSignal } from "@/lib/hooks/useBulkSelectionSignal";

// ─── Types ───────────────────────────────────────────────────────────────────

type RetailStatus = RetailProduct["status"];
type StockBucket = "in_stock" | "low" | "out";
type RowActionKind = "archive" | "reactivate" | "recover" | "deactivate" | "delete";

interface FilterState {
    categoryIds: string[];
    statuses: RetailStatus[];
    stockBuckets: StockBucket[];
}
const EMPTY_FILTER: FilterState = {
    categoryIds: [],
    statuses: [],
    stockBuckets: [],
};

/** Per-branch row shown inside the accordion drawer under each product. */
interface RetailBranchRow {
    branchId: string;
    branchName: string;
    unitsOnHand: number;
    sold: number;
}

interface RetailRow {
    id: string;
    name: string;
    sku: string;
    categoryId: string;
    categoryLabel: string;
    priceAed: number;
    stockAggregate: number;
    hasZeroBranch: boolean;
    hasLowBranch: boolean;
    reorderThreshold: number;
    status: RetailStatus;
    imageUrl?: string;
    hasHistory: boolean;
    /** Per-branch breakdown for the accordion nested rows. Active branches
     *  only — archived branches skipped so admins see the same set the
     *  Configure-stock panel + Stock by branch tab show. */
    branchBreakdown: RetailBranchRow[];
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

function ProductThumb({ imageUrl, alt }: { imageUrl?: string; alt: string }) {
    if (imageUrl) {
        return (
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[var(--colors-bg-tertiary)] shrink-0">
                <Image
                    src={imageUrl}
                    alt={alt}
                    fill
                    sizes="40px"
                    className="object-cover"
                    unoptimized
                />
            </div>
        );
    }
    return (
        <div
            className="w-10 h-10 rounded-full bg-[var(--colors-bg-tertiary)] border-1 border-[#eaecf0] flex items-center justify-center shrink-0"
            aria-hidden
        >
            <Image01 className="w-4 h-4 text-[#98a2b3]" />
        </div>
    );
}

function CheckboxCell({ checked, indeterminate = false, onChange, ariaLabel }: {
    checked: boolean; indeterminate?: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-label={ariaLabel}
            aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#164e52] border-[#164e52] text-white"
                    : "bg-white border-[var(--colors-border-primary)] hover:border-[#457175]",
            )}
        >
            {indeterminate ? (
                <span className="block w-2 h-[1.5px] bg-white" />
            ) : checked ? (
                <Check className="w-3 h-3" />
            ) : null}
        </button>
    );
}

// FilterPill imported from @/components/ui/FilterPill — canonical shared
// chip used by every filter side panel across admin / instructor / customer.

// ─── Confirm modal config (same tone matrix as Gift cards) ───────────────────

type ConfirmTone = "destructive" | "primary";

const MODAL_CONFIG: Record<RowActionKind, {
    IconComp: React.ElementType;
    titleSingle: string;
    titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
    tone: ConfirmTone;
}> = {
    archive: {
        IconComp: Archive,
        titleSingle: "Archive this product?",
        titleBulk:   n => `Archive ${n} products?`,
        description: subject => <>{subject} will be hidden from the Point of Sale catalog and default admin list. You can recover archived products at any time.</>,
        confirmLabel: "Archive",
        tone: "primary",
    },
    reactivate: {
        IconComp: Check,
        titleSingle: "Reactivate this product?",
        titleBulk:   n => `Reactivate ${n} products?`,
        description: subject => <>{subject} will be sellable in the Point of Sale catalog and visible on the customer shop.</>,
        confirmLabel: "Reactivate",
        tone: "primary",
    },
    recover: {
        IconComp: RefreshCcw01,
        titleSingle: "Recover this product?",
        titleBulk:   n => `Recover ${n} products?`,
        description: subject => <>{subject} will be restored to Active status and become sellable again.</>,
        confirmLabel: "Recover",
        tone: "primary",
    },
    deactivate: {
        IconComp: SlashCircle01,
        titleSingle: "Deactivate this product?",
        titleBulk:   n => `Deactivate ${n} products?`,
        description: subject => <>{subject} will be hidden from new POS sales and the customer shop. Existing per-branch stock stays where it is.</>,
        confirmLabel: "Deactivate",
        tone: "destructive",
    },
    delete: {
        IconComp: Trash02,
        titleSingle: "Delete this product?",
        titleBulk:   n => `Delete ${n} products?`,
        description: subject => <>{subject} will be permanently removed along with its per-branch stock. This action cannot be undone.</>,
        confirmLabel: "Delete",
        tone: "destructive",
    },
};

// ─── Bulk action bar ─────────────────────────────────────────────────────────

function BulkActionBar({ count, hasArchivable, hasReactivatable, hasRecoverable, hasDeletable, onClear, onAction }: {
    count: number;
    hasArchivable: boolean;
    hasReactivatable: boolean;
    hasRecoverable: boolean;
    hasDeletable: boolean;
    onClear: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-fit max-w-full">
                <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[var(--colors-bg-secondary)] transition-colors whitespace-nowrap shrink-0"
                >
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {hasArchivable && (
                        <Button variant="secondary-gray" leftIcon={<Archive className="w-5 h-5 text-[#667085]" />} onClick={() => onAction("archive")}>
                            Archive
                        </Button>
                    )}
                    {hasReactivatable && (
                        <Button variant="secondary-gray" leftIcon={<Check className="w-5 h-5 text-[#164e52]" />} onClick={() => onAction("reactivate")}>
                            Reactivate
                        </Button>
                    )}
                    {hasRecoverable && (
                        <Button variant="secondary-gray" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#164e52]" />} onClick={() => onAction("recover")}>
                            Recover
                        </Button>
                    )}
                    {/* Delete ↔ Deactivate swap rule (matches Memberships &
                        Packages bulk pill). When every selected active row
                        has zero transaction history we expose Delete (red);
                        otherwise we expose Deactivate (red). Gated on
                        hasArchivable so it never shows alongside a
                        pure-archived selection. */}
                    {hasArchivable && (
                        hasDeletable ? (
                            <Button
                                variant="secondary-gray"
                               
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("delete")}
                            >
                                Delete
                            </Button>
                        ) : (
                            <Button
                                variant="secondary-gray"
                               
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("deactivate")}
                            >
                                Deactivate
                            </Button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Filter side panel ───────────────────────────────────────────────────────

function FilterPanel({ open, onClose, applied, onApply, categories }: {
    open: boolean; onClose: () => void;
    applied: FilterState;
    onApply: (next: FilterState) => void;
    categories: { id: string; label: string }[];
}) {
    const [pending, setPending] = useState<FilterState>(applied);

    // Re-seed pending state whenever the drawer opens so a closed-without-
    // apply session doesn't carry stale edits into the next opening.
    useMemo(() => { if (open) setPending(applied); return null; }, [open, applied]);

    function toggle<T>(arr: T[], val: T): T[] {
        return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    }

    const hasAny =
        pending.categoryIds.length > 0 ||
        pending.statuses.length > 0 ||
        pending.stockBuckets.length > 0;

    return (
        <SlidePanel open={open} onClose={onClose} width={420}>
            <div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <p className="text-[14px] font-medium text-[#344054]">Retail category</p>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                            <FilterPill key={c.id} label={c.label} selected={pending.categoryIds.includes(c.id)}
                                onClick={() => setPending(p => ({ ...p, categoryIds: toggle(p.categoryIds, c.id) }))} />
                        ))}
                    </div>
                </div>

                <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                <div className="flex flex-col gap-2">
                    <p className="text-[14px] font-medium text-[#344054]">Status</p>
                    <div className="flex flex-wrap gap-2">
                        {/* Archived is a place (the Archived section), not a filter value (policy §3). */}
                        <FilterPill label="Active"    selected={pending.statuses.includes("active")}    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, "active") }))} />
                        <FilterPill label="Inactive"  selected={pending.statuses.includes("inactive")}  onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, "inactive") }))} />
                    </div>
                </div>

                <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                <div className="flex flex-col gap-2">
                    <p className="text-[14px] font-medium text-[#344054]">Stock level</p>
                    <div className="flex flex-wrap gap-2">
                        <FilterPill label="In stock"     selected={pending.stockBuckets.includes("in_stock")} onClick={() => setPending(p => ({ ...p, stockBuckets: toggle(p.stockBuckets, "in_stock") }))} />
                        <FilterPill label="Low"          selected={pending.stockBuckets.includes("low")}      onClick={() => setPending(p => ({ ...p, stockBuckets: toggle(p.stockBuckets, "low") }))} />
                        <FilterPill label="Out of stock" selected={pending.stockBuckets.includes("out")}      onClick={() => setPending(p => ({ ...p, stockBuckets: toggle(p.stockBuckets, "out") }))} />
                    </div>
                    <p className="text-[12px] text-[#667085]">"Low" means at least one branch is at or below the product's reorder threshold.</p>
                </div>
            </div>
            <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between gap-3">
                <Button variant="secondary-gray" onClick={() => setPending(EMPTY_FILTER)} disabled={!hasAny}>
                    Reset
                </Button>
                <Button variant="primary" onClick={() => { onApply(pending); onClose(); }}>
                    Apply
                </Button>
            </div>
        </SlidePanel>
    );
}

// ─── Row VM builder ──────────────────────────────────────────────────────────

const COMPARATORS: Record<string, (a: RetailRow, b: RetailRow) => number> = {
    name:     (a, b) => a.name.localeCompare(b.name),
    sku:      (a, b) => a.sku.localeCompare(b.sku),
    category: (a, b) => a.categoryLabel.localeCompare(b.categoryLabel),
    price:    (a, b) => a.priceAed - b.priceAed,
    stock:    (a, b) => a.stockAggregate - b.stockAggregate,
    status:   (a, b) => a.status.localeCompare(b.status),
};

// ─── Page ────────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row"; row: RetailRow; kind: RowActionKind }
    | { mode: "bulk"; rows: RetailRow[]; kind: RowActionKind };

// ─── Retail products table — shared by the active list + Archived section ────
//
// Extracted so the active list and the Archived section (policy §3) render the
// same table (header + expandable per-branch subrows) from their own row set +
// sort + pagination, with a shared selection. Presentation only.

function RetailTable({
    rows, sortKey, sortDir, onSort,
    selectedIds, onToggleOne, onToggleAll,
    expandedIds, onToggleExpanded,
    onRowClick, onEdit, onConfigure, onRowAction,
}: {
    rows: RetailRow[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (checked: boolean) => void;
    expandedIds: Set<string>;
    onToggleExpanded: (id: string) => void;
    onRowClick: (id: string) => void;
    onEdit: (id: string) => void;
    onConfigure: (id: string) => void;
    onRowAction: (row: RetailRow, kind: RowActionKind) => void;
}) {
    const allChecked  = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && rows.some(r => selectedIds.has(r.id));
    return (
        <div className="px-6">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[44px]")}>
                            <CheckboxCell
                                checked={allChecked}
                                indeterminate={someChecked}
                                onChange={onToggleAll}
                                ariaLabel="Select all products"
                            />
                        </th>
                        <th className={cn(TH, "w-[36px]")} aria-hidden />
                        <th className={cn(TH, "w-[340px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Product name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[140px]")}>
                            <SortableHeader sortKey="sku" currentSort={sortKey} dir={sortDir} onSort={onSort}>SKU</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="category" currentSort={sortKey} dir={sortDir} onSort={onSort}>Retail category</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[140px]")}>
                            <SortableHeader sortKey="price" currentSort={sortKey} dir={sortDir} onSort={onSort}>Price</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <SortableHeader sortKey="stock" currentSort={sortKey} dir={sortDir} onSort={onSort}>Stock</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[52px]")}></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => {
                        const isSelected = selectedIds.has(r.id);
                        const stockLabel = r.stockAggregate === 0 ? "Out of stock" : `${r.stockAggregate} units`;
                        const stockTone = r.stockAggregate === 0
                            ? "text-[#b42318] font-medium"
                            : r.hasLowBranch ? "text-[#dc6803] font-medium" : "";
                        const isExpanded = expandedIds.has(r.id);
                        return (
                            <React.Fragment key={r.id}>
                                <tr
                                    onClick={() => onRowClick(r.id)}
                                    className={cn(
                                        "transition-colors cursor-pointer",
                                        isSelected ? "bg-[var(--colors-bg-secondary)]" : "hover:bg-[var(--colors-bg-secondary)]",
                                    )}
                                >
                                    <td className={TD} onClick={e => e.stopPropagation()}>
                                        <CheckboxCell
                                            checked={isSelected}
                                            onChange={() => onToggleOne(r.id)}
                                            ariaLabel={`Select ${r.name}`}
                                        />
                                    </td>
                                    <td className={TD} onClick={e => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            onClick={() => onToggleExpanded(r.id)}
                                            aria-label={isExpanded ? `Collapse ${r.name}` : `Expand ${r.name}`}
                                            aria-expanded={isExpanded}
                                            className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-[#eaecf0] transition-colors text-[#667085]"
                                        >
                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </button>
                                    </td>
                                    <td className={TD}>
                                        <div className="flex items-center gap-3">
                                            <ProductThumb imageUrl={r.imageUrl} alt={r.name} />
                                            <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                        </div>
                                    </td>
                                    <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>{r.sku}</td>
                                    <td className={cn(TD, "whitespace-nowrap")}>{r.categoryLabel}</td>
                                    <td className={cn(TD, "whitespace-nowrap")}>{formatAed(r.priceAed)}</td>
                                    <td className={cn(TD, "whitespace-nowrap")}>
                                        <span className={stockTone}>{stockLabel}</span>
                                    </td>
                                    <td className={TD}>
                                        <StatusBadge type="product" status={r.status} />
                                    </td>
                                    <td className={TD} onClick={e => e.stopPropagation()}>
                                        <RowActions items={[
                                            { label: "View details",    icon: Eye,          onClick: () => onRowClick(r.id) },
                                            { label: "Configure stock", icon: Package,      onClick: () => onConfigure(r.id), hidden: r.status === "archived" },
                                            { label: "Edit",            icon: Edit02,       onClick: () => onEdit(r.id), hidden: r.status !== "active" },
                                            { label: "Archive",         icon: Archive,      onClick: () => onRowAction(r, "archive"),    hidden: r.status !== "active" && r.status !== "inactive" },
                                            { label: "Reactivate",      icon: Check,        onClick: () => onRowAction(r, "reactivate"), hidden: r.status !== "inactive" },
                                            { label: "Recover",         icon: RefreshCcw01, onClick: () => onRowAction(r, "recover"),    hidden: r.status !== "archived" },
                                            { label: "Deactivate",      icon: SlashCircle01,onClick: () => onRowAction(r, "deactivate"), danger: true, hidden: !(r.status === "active" && r.hasHistory) },
                                            { label: "Delete",          icon: Trash01,      onClick: () => onRowAction(r, "delete"),     danger: true, hidden: !(r.status === "active" && !r.hasHistory) },
                                        ]} />
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={9} className="px-0 py-0 border-b border-[var(--colors-border-secondary)]">
                                            <div className="pl-12 pr-6">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className={cn(TH, "min-w-[220px]")}>Branch</th>
                                                            <th className={cn(TH, "w-[160px]")}>Stock on hand</th>
                                                            <th className={cn(TH, "w-[120px]")}>Sold</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {r.branchBreakdown.map(b => {
                                                            const isOut = b.unitsOnHand === 0;
                                                            const isLow = !isOut && b.unitsOnHand <= r.reorderThreshold;
                                                            return (
                                                                <tr key={b.branchId}>
                                                                    <td className={TD}>{b.branchName}</td>
                                                                    <td className={cn(TD, "whitespace-nowrap")}>
                                                                        <span className={cn(
                                                                            isOut && "text-[#b42318] font-medium",
                                                                            isLow && "text-[#dc6803] font-medium",
                                                                        )}>
                                                                            {isOut ? "Out of stock" : `${b.unitsOnHand} units`}
                                                                        </span>
                                                                    </td>
                                                                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
                                                                        {b.sold > 0 ? `${b.sold} units` : "—"}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function RetailPage() {
    const router = useRouter();
    const products             = useAppStore(s => s.retailProducts);
    const stock                = useAppStore(s => s.retailStock);
    const categories           = useAppStore(s => s.retailCategories);
    const branches             = useAppStore(s => s.branches);
    const transactions         = useAppStore(s => s.customerTransactions);
    const adjustments          = useAppStore(s => s.retailStockAdjustments);
    const setRetailProductStatus = useAppStore(s => s.setRetailProductStatus);
    const deleteRetailProducts   = useAppStore(s => s.deleteRetailProducts);
    const showToast              = useAppStore(s => s.showToast);
    // Categories tab controller — shared with the standalone route's view.
    const catCtrl = useRetailCategoriesController();

    // Client 2026-08-03 — Retail + Categories merged into one page with tabs
    // (mirrors Memberships & Packages). "products" shows the stock list;
    // "categories" renders the shared RetailCategoriesView.
    const [tab, setTab] = useState<"products" | "categories">("products");
    // Location filter — scopes the stock figures to a single branch. "" = all.
    const [branchId, setBranchId] = useState("");
    const [search, setSearch] = useState("");
    const [applied, setApplied] = useState<FilterState>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );
    const [page, setPage] = useState(1);
    const [archPage, setArchPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Hide the FloatingAiButton while bulk-select mode has ≥1 row checked.
    useBulkSelectionSignal(selectedIds.size > 0);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
    // Client 2026-07-31 — accordion state. Chevron on the LEFT of each row
    // toggles a nested per-branch table (Branch / Stock / Sold). Multi-open
    // — Set lets admin drill into several products side-by-side.
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const toggleExpanded = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    // Configure-stock side panel — opened directly from the row action so
    // admins don't need to jump into the detail page just to adjust units.
    const [configureId, setConfigureId] = useState<string | null>(null);
    const configureProduct = useMemo(
        () => (configureId ? products.find(p => p.id === configureId) ?? null : null),
        [configureId, products],
    );

    // ─── Row VM ────────────────────────────────────────────────────────────
    const allRows = useMemo<RetailRow[]>(() => {
        const catLabel = new Map(categories.map(c => [c.id, c.label] as const));
        // Index stock rows by product id so we don't do O(N × M) scans.
        const stockByProduct = new Map<string, typeof stock>();
        for (const s of stock) {
            const arr = stockByProduct.get(s.productId);
            if (arr) arr.push(s);
            else stockByProduct.set(s.productId, [s]);
        }
        // Index sold units by (productId × branchId) so the accordion's
        // per-branch subrows show a "Sold" figure without an inner scan.
        // Sold = absolute delta of every `kind === "sale"` adjustment at
        // that pair. Matches the Stock by branch tab on the detail page.
        const soldByPair = new Map<string, number>();
        for (const a of adjustments) {
            if (a.kind !== "sale") continue;
            const key = `${a.productId}|${a.branchId}`;
            soldByPair.set(key, (soldByPair.get(key) ?? 0) + Math.abs(a.delta));
        }
        // hasHistory covers BOTH past receipts (transactions) AND stock
        // movements (adjustments). A product with any receive / sale /
        // adjust / loss / refund row on the audit log can't be hard-
        // deleted — the audit rows would dangle. Matches the store's
        // canDeleteRetailProduct guard exactly.
        const historyIds = new Set<string>();
        for (const t of transactions) {
            if (t.retailProductId) historyIds.add(t.retailProductId);
        }
        for (const a of adjustments) historyIds.add(a.productId);
        // Active branches only — archived branches skipped so the accordion
        // matches the Configure-stock panel + Stock by branch tab. When a
        // location filter is active, scope everything (stock total, low/out
        // flags, accordion breakdown) to that single branch.
        const activeBranches = branches.filter(b => b.status !== "archived");
        const scopedBranches = branchId ? activeBranches.filter(b => b.id === branchId) : activeBranches;
        return products.map(p => {
            const allProductRows = stockByProduct.get(p.id) ?? [];
            const rows = branchId ? allProductRows.filter(r => r.branchId === branchId) : allProductRows;
            const stockAggregate = rows.reduce((sum, r) => sum + (r.unitsOnHand ?? 0), 0);
            // A branch can hold several rows now (one per size variant) — sum
            // them into a per-branch total before deriving low/out flags + the
            // accordion breakdown.
            const totalByBranch = new Map<string, number>();
            for (const r of rows) totalByBranch.set(r.branchId, (totalByBranch.get(r.branchId) ?? 0) + (r.unitsOnHand ?? 0));
            const branchTotals = Array.from(totalByBranch.values());
            const hasZeroBranch  = branchId
                ? (totalByBranch.get(branchId) ?? 0) === 0
                : branchTotals.some(t => t === 0);
            const hasLowBranch   = branchId
                ? (totalByBranch.get(branchId) ?? 0) <= p.reorderThreshold
                : branchTotals.some(t => t <= p.reorderThreshold);
            const branchBreakdown: RetailBranchRow[] = scopedBranches.map(b => ({
                branchId: b.id,
                branchName: b.name,
                unitsOnHand: totalByBranch.get(b.id) ?? 0,
                sold: soldByPair.get(`${p.id}|${b.id}`) ?? 0,
            }));
            return {
                id: p.id,
                name: p.name,
                sku: p.sku,
                categoryId: p.categoryId,
                categoryLabel: catLabel.get(p.categoryId) ?? "—",
                priceAed: p.priceAed,
                stockAggregate,
                hasZeroBranch,
                hasLowBranch,
                reorderThreshold: p.reorderThreshold,
                status: p.status,
                imageUrl: p.imageUrl,
                hasHistory: historyIds.has(p.id),
                branchBreakdown,
            };
        });
    }, [products, stock, categories, branches, transactions, adjustments, branchId]);

    // ─── Search + filter ───────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (q && !(r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))) return false;
            if (applied.categoryIds.length > 0 && !applied.categoryIds.includes(r.categoryId)) return false;
            // Status pill filters only the active table; archived rows are exempt —
            // they always render in the Archived section below (policy §3).
            if (r.status !== "archived" && applied.statuses.length > 0 && !applied.statuses.includes(r.status)) return false;
            if (applied.stockBuckets.length > 0) {
                const isOut = r.stockAggregate === 0;
                const isLow = !isOut && r.hasLowBranch;
                const isIn  = !isOut && !isLow;
                const bucketOk =
                    (applied.stockBuckets.includes("out")      && isOut) ||
                    (applied.stockBuckets.includes("low")      && isLow) ||
                    (applied.stockBuckets.includes("in_stock") && isIn);
                if (!bucketOk) return false;
            }
            return true;
        });
    }, [allRows, search, applied]);

    // Split archived rows off to the shared Archived section (policy §3). Both
    // buckets are already search/category/stock-scoped; the active bucket also
    // respects the status pill (archived was exempted above).
    const { active: activeRows, archived: archivedRows } = useArchiveView(filteredRows);

    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(activeRows, COMPARATORS);
    const { sorted: archSorted, sortKey: archSortKey, sortDir: archSortDir, toggle: toggleArchSort } = useSort(archivedRows, COMPARATORS);

    // ─── Pagination slice (active + archived each paginate independently) ────
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const pagedRows = useMemo(() => {
        const start = (clampedPage - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, clampedPage, pageSize]);

    const archTotalPages = Math.max(1, Math.ceil(archSorted.length / pageSize));
    const clampedArchPage = Math.min(Math.max(1, archPage), archTotalPages);
    const pagedArchivedRows = useMemo(() => {
        const start = (clampedArchPage - 1) * pageSize;
        return archSorted.slice(start, start + pageSize);
    }, [archSorted, clampedArchPage, pageSize]);

    // ─── Selection ─────────────────────────────────────────────────────────
    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllRows = (rows: RetailRow[], checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) rows.forEach(r => next.add(r.id));
            else rows.forEach(r => next.delete(r.id));
            return next;
        });
    };
    const clearSelection = () => setSelectedIds(new Set());

    const selectedRows = useMemo(
        () => filteredRows.filter(r => selectedIds.has(r.id)),
        [filteredRows, selectedIds],
    );
    const hasArchivable    = selectedRows.some(r => r.status === "active" || r.status === "inactive");
    const hasReactivatable = selectedRows.some(r => r.status === "inactive");
    const hasRecoverable   = selectedRows.some(r => r.status === "archived");
    // hasDeletable is TRUE only when EVERY selected row is deletable
    // (active + zero transaction history). Otherwise the swap rule in
    // the bulk pill flips to Deactivate. Matches the memberships /
    // packages bulk pill exactly.
    const hasDeletable     = selectedRows.length > 0
        && selectedRows.every(r => r.status === "active" && !r.hasHistory);

    // ─── Filter dot ────────────────────────────────────────────────────────
    const hasActiveFilter =
        applied.categoryIds.length > 0 ||
        applied.statuses.length > 0 ||
        applied.stockBuckets.length > 0;

    // ─── Action plumbing ───────────────────────────────────────────────────
    function openRowConfirm(row: RetailRow, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rows = (() => {
            switch (kind) {
                case "archive":    return selectedRows.filter(r => r.status === "active" || r.status === "inactive");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "recover":    return selectedRows.filter(r => r.status === "archived");
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "delete":     return selectedRows.filter(r => r.status === "active" && !r.hasHistory);
            }
        })();
        if (rows.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows, kind });
    }

    function performAction(p: PendingConfirm) {
        const rows = p.mode === "row" ? [p.row] : p.rows;
        const ids  = rows.map(r => r.id);
        if (p.kind === "archive") {
            setRetailProductStatus(ids, "archived");
            showToast(
                ids.length === 1 ? "Product archived" : `${ids.length} products archived`,
                ids.length === 1 ? `${rows[0].name} moved to Archive.` : "",
                "success", "check",
            );
        } else if (p.kind === "reactivate") {
            setRetailProductStatus(ids, "active");
            showToast(
                ids.length === 1 ? "Product reactivated" : `${ids.length} products reactivated`,
                ids.length === 1 ? `${rows[0].name} is Active again.` : "",
                "success", "check",
            );
        } else if (p.kind === "recover") {
            setRetailProductStatus(ids, "active");
            showToast(
                ids.length === 1 ? "Product recovered" : `${ids.length} products recovered`,
                ids.length === 1 ? `${rows[0].name} moved from Archive to Active.` : "",
                "success", "check",
            );
        } else if (p.kind === "deactivate") {
            setRetailProductStatus(ids, "inactive");
            showToast(
                ids.length === 1 ? "Product deactivated" : `${ids.length} products deactivated`,
                ids.length === 1 ? `${rows[0].name} is now Inactive.` : "",
                "success", "check",
            );
        } else if (p.kind === "delete") {
            const { deleted, blocked } = deleteRetailProducts(ids);
            if (deleted.length === 1) {
                const r = rows.find(x => x.id === deleted[0]);
                showToast("Product deleted", r ? `${r.name} has been permanently removed.` : "", "success", "trash");
            } else if (deleted.length > 1) {
                showToast(`${deleted.length} products deleted`, "", "success", "trash");
            }
            if (blocked.length > 0) {
                showToast(
                    `${blocked.length} ${blocked.length === 1 ? "product" : "products"} kept`,
                    `Cannot delete a product with past transactions — archive it instead.`,
                    "warning", "check",
                );
            }
        }
        setPendingConfirm(null);
        clearSelection();
    }

    function buildRetailExport() {
        if (sorted.length === 0) return null;
        // Client 2026-07-31 — CSV now round-trips through the AI Agent
        // migrate wizard. Two changes over the older "one Stock column"
        // shape:
        //   1. Per-branch stock columns — one `stock_<Branch Name>`
        //      column per active branch, matching the applier's
        //      `stock_<branch>` regex on the import side. Aggregate is
        //      no longer written; it's derivable by summing the
        //      per-branch columns anyway.
        //   2. Extra product fields — Unit cost AED, Description, Image
        //      URL — so an exported CSV re-imports without losing the
        //      admin's original data. Field names are chosen so the
        //      retail-products entity dict recognises them verbatim
        //      after `normHeader` (lowercase + space-normalised).
        //
        // Status is exported for admin readability but is NOT a
        // migration target (import always creates as `active`); leaving
        // the column in the CSV doesn't confuse the mapper because
        // there's no `status` field on the entity to match.
        const activeBranchesForExport = branches
            .filter(b => b.status !== "archived")
            .map(b => ({ id: b.id, name: b.name }));
        const stockHeaders = activeBranchesForExport.map(b => `stock_${b.name}`);
        // `id` + `category_id` are prepended for migration completeness (the
        // importer ignores unknown columns, so the round-trip is unaffected);
        // every other header stays verbatim so the AI-agent import mapper keeps
        // recognising them. Branch stock stays name-keyed (`stock_<Branch>`) —
        // the importer resolves each branch by name, preserving the FK on import.
        const headers = [
            "id", "Name", "SKU", "category_id", "Retail category", "Description",
            "Price AED", "Unit cost AED", "Reorder threshold",
            "Image URL", "Status", "Sizes",
            ...stockHeaders,
        ];
        const productsById = new Map(products.map(p => [p.id, p]));
        // Per-(product × branch × size) stock, UNSCOPED by the location filter —
        // the CSV must always export every branch's real stock so it round-trips,
        // even when the list is filtered to one branch. Size "" = a sizeless
        // product's single row. (r.branchBreakdown is view-scoped + size-summed,
        // so we read the raw stock slice instead.)
        const stockByPBS = new Map<string, number>();
        for (const s of stock) {
            const key = `${s.productId}|${s.branchId}|${s.size ?? ""}`;
            stockByPBS.set(key, (stockByPBS.get(key) ?? 0) + (s.unitsOnHand ?? 0));
        }
        const rows = sorted.map(r => {
            const p = productsById.get(r.id);
            const sizes = p?.sizes ?? [];
            const perBranch = activeBranchesForExport.map(b => {
                if (sizes.length > 0) {
                    // Sized product — encode "Size:qty | Size:qty" for the sizes
                    // that carry stock at this branch. Pipe/colon are safe
                    // against comma/semicolon CSV delimiters; the AI-agent
                    // importer parses this exact shape back.
                    const parts = sizes
                        .map(sz => ({ sz, units: stockByPBS.get(`${r.id}|${b.id}|${sz}`) ?? 0 }))
                        .filter(x => x.units > 0)
                        .map(x => `${x.sz}:${x.units}`);
                    return parts.length > 0 ? parts.join(" | ") : "";
                }
                // Sizeless — a plain total. Blank (not "0") when empty so the
                // CSV stays clean and re-import skips it.
                const units = stockByPBS.get(`${r.id}|${b.id}|`) ?? 0;
                return units > 0 ? units.toString() : "";
            });
            return [
                r.id,
                r.name,
                r.sku,
                r.categoryId,
                r.categoryLabel,
                p?.description ?? "",
                r.priceAed.toString(),
                p ? p.unitCostAed.toString() : "",
                r.reorderThreshold.toString(),
                r.imageUrl ?? "",
                r.status,
                sizes.join(", "),
                ...perBranch,
            ];
        });
        return matrixToExportData("retail-products", headers, rows);
    }
    function handleExported(fmt: "csv" | "xlsx") {
        showToast("Products exported", `${sorted.length} ${sorted.length === 1 ? "row" : "rows"} exported to ${fmt.toUpperCase()}.`, "success", "check");
    }

    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[#344054]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected products</>,
        };
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-6">
            {/* ── Toolbar — adaptive per tab, above the view-card (matches Memberships & Packages) ── */}
            {tab === "categories" ? (
                <RetailCategoriesToolbar ctrl={catCtrl} />
            ) : (
            <div className="flex items-center gap-3">
                <ToolbarTotal count={activeRows.length} entitySingular="product" />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search product..." />
                <ToolbarExport disabled={sorted.length === 0} exportData={buildRetailExport} onExported={handleExported} />
                <IconTooltip label="Filter">
                    <Button
                        variant="secondary-gray"
                        size="icon"
                        aria-label="Filter"
                        onClick={() => setFilterOpen(true)}
                    >
                        <span className="relative inline-flex">
                            <Sliders className="w-5 h-5" />
                            {hasActiveFilter && (
                                <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#164e52] border-1 border-white" aria-hidden />
                            )}
                        </span>
                    </Button>
                </IconTooltip>
                {/* Import — always immediately after Filter (memory rule
                    feedback_toolbar_import_order). Retail is the ONLY
                    module that always shows Import; every other list
                    passes `visible={empty && !filter}`. Routes to the
                    AI Agent Migrate Data thread scoped to retail_products
                    so the admin lands on the file-upload step for this
                    entity. */}
                <ToolbarImportButton />
                <Button
                    variant="primary"

                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push(`/products/retail/new?returnTo=${encodeURIComponent("/admin/products/retail")}`)}
                >
                    Add
                </Button>
            </div>
            )}

            {/* Scroll region — active card fills the viewport; the Archived
                section (products tab only) sits below and is reached by scrolling
                THIS region (matches Memberships & Packages). */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-6">
            {/* ── Active view card with tabs (client 2026-08-03) ── */}
            <div className="shrink-0 h-full bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
                <div className="shrink-0 flex items-center px-6 py-4">
                    <SegmentedTabs
                        tabs={[
                            { key: "products",   label: `Products (${products.length})` },
                            { key: "categories", label: `Categories (${categories.length})` },
                        ]}
                        activeKey={tab}
                        onChange={(k) => setTab(k as "products" | "categories")}
                    />
                </div>
                <div className="flex-auto min-h-0 overflow-y-auto scrollbar-hide relative">
                {tab === "categories" ? (
                    <div className="py-4">
                        <RetailCategoriesPanel ctrl={catCtrl} />
                    </div>
                ) : (
                <>
                {sorted.length === 0 ? (
                    <EmptyState
                        absolute={false} className="min-h-[400px]"
                        title="No products found"
                        subtitle="Try adjusting your search or filters."
                    />
                ) : (
                    <RetailTable
                        rows={pagedRows}
                        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
                        selectedIds={selectedIds}
                        onToggleOne={toggleOne}
                        onToggleAll={(c) => toggleAllRows(pagedRows, c)}
                        expandedIds={expandedIds}
                        onToggleExpanded={toggleExpanded}
                        onRowClick={(id) => router.push(`/products/retail/${id}`)}
                        onEdit={(id) => router.push(`/products/retail/${id}/edit?returnTo=${encodeURIComponent("/admin/products/retail")}`)}
                        onConfigure={(id) => setConfigureId(id)}
                        onRowAction={openRowConfirm}
                    />
                )}

                <BulkActionBar
                    count={selectedIds.size}
                    hasArchivable={hasArchivable}
                    hasReactivatable={hasReactivatable}
                    hasRecoverable={hasRecoverable}
                    hasDeletable={hasDeletable}
                    onClear={clearSelection}
                    onAction={openBulkConfirm}
                />
                </>
                )}
                </div>

                {/* Pagination footer — pinned to the bottom of the card, tab-aware. */}
                <div className="px-6 shrink-0">
                    {tab === "categories" ? (
                        <RetailCategoriesPagination ctrl={catCtrl} />
                    ) : (
                        <Pagination
                            page={clampedPage} total={sorted.length} pageSize={pageSize}
                            onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                        />
                    )}
                </div>
            </div>

            {/* ── Archived section (products tab only) — shared shell; its own
                   table + pagination; selection + search/filters shared with the
                   active list (policy §3). */}
            {tab === "products" && (
                <ArchivedSection
                    entitySingular="product"
                    count={archivedRows.length}
                    pagination={
                        <Pagination
                            page={clampedArchPage} total={archSorted.length} pageSize={pageSize}
                            onPage={setArchPage} onPageSize={s => { setPageSize(s); setArchPage(1); }}
                        />
                    }
                >
                    <RetailTable
                        rows={pagedArchivedRows}
                        sortKey={archSortKey} sortDir={archSortDir} onSort={toggleArchSort}
                        selectedIds={selectedIds}
                        onToggleOne={toggleOne}
                        onToggleAll={(c) => toggleAllRows(pagedArchivedRows, c)}
                        expandedIds={expandedIds}
                        onToggleExpanded={toggleExpanded}
                        onRowClick={(id) => router.push(`/products/retail/${id}`)}
                        onEdit={(id) => router.push(`/products/retail/${id}/edit?returnTo=${encodeURIComponent("/admin/products/retail")}`)}
                        onConfigure={(id) => setConfigureId(id)}
                        onRowAction={openRowConfirm}
                    />
                </ArchivedSection>
            )}
            </div>

            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={f => { setApplied(f); setPage(1); setArchPage(1); }}
                categories={categories.filter(c => c.status === "active").map(c => ({ id: c.id, label: c.label }))}
            />

            {configureProduct && (
                <ConfigureStockPanel
                    open={configureId !== null}
                    onClose={() => setConfigureId(null)}
                    product={configureProduct}
                />
            )}

            {pendingConfirm && (() => {
                const { count, subject } = modalSubject(pendingConfirm);
                const cfg = MODAL_CONFIG[pendingConfirm.kind];
                const title = count === 1 ? cfg.titleSingle : cfg.titleBulk(count);
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.IconComp}
                        tone={cfg.tone === "destructive" ? "danger" : "success"}
                        title={title}
                        description={cfg.description(subject, count)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performAction(pendingConfirm)}
                    />
                );
            })()}

            <Toast />
        </div>
    );
}
