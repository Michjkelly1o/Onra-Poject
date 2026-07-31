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
    Upload01, ChevronDown, ChevronRight,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { Sliders } from "@/components/icons/Sliders";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { FilterPill } from "@/components/ui/FilterPill";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfigureStockPanel } from "@/components/retail/ConfigureStockPanel";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { useAppStore, type RetailProduct } from "@/lib/store";

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
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[#f2f4f7] shrink-0">
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
            className="w-10 h-10 rounded-full bg-[#f2f4f7] border-1 border-[#eaecf0] flex items-center justify-center shrink-0"
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
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
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
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-fit max-w-full">
                <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0"
                >
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {hasArchivable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Archive className="w-5 h-5 text-[#667085]" />} onClick={() => onAction("archive")}>
                            Archive
                        </Button>
                    )}
                    {hasReactivatable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Check className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("reactivate")}>
                            Reactivate
                        </Button>
                    )}
                    {hasRecoverable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("recover")}>
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
                                size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("delete")}
                            >
                                Delete
                            </Button>
                        ) : (
                            <Button
                                variant="secondary-gray"
                                size="sm"
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
            <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
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
                        <FilterPill label="Active"    selected={pending.statuses.includes("active")}    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, "active") }))} />
                        <FilterPill label="Inactive"  selected={pending.statuses.includes("inactive")}  onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, "inactive") }))} />
                        <FilterPill label="Archived"  selected={pending.statuses.includes("archived")}  onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, "archived") }))} />
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
            <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                <Button variant="secondary-gray" size="md" onClick={() => setPending(EMPTY_FILTER)} disabled={!hasAny}>
                    Reset
                </Button>
                <Button variant="primary" size="md" onClick={() => { onApply(pending); onClose(); }}>
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

    const [search, setSearch] = useState("");
    const [applied, setApplied] = useState<FilterState>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
        // matches the Configure-stock panel + Stock by branch tab.
        const activeBranches = branches.filter(b => b.status !== "archive");
        return products.map(p => {
            const rows = stockByProduct.get(p.id) ?? [];
            const stockAggregate = rows.reduce((sum, r) => sum + (r.unitsOnHand ?? 0), 0);
            const hasZeroBranch  = rows.some(r => r.unitsOnHand === 0);
            const hasLowBranch   = rows.some(r => r.unitsOnHand <= p.reorderThreshold);
            const branchBreakdown: RetailBranchRow[] = activeBranches.map(b => {
                const row = rows.find(r => r.branchId === b.id);
                return {
                    branchId: b.id,
                    branchName: b.name,
                    unitsOnHand: row?.unitsOnHand ?? 0,
                    sold: soldByPair.get(`${p.id}|${b.id}`) ?? 0,
                };
            });
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
    }, [products, stock, categories, branches, transactions, adjustments]);

    // ─── Search + filter ───────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (q && !(r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))) return false;
            if (applied.categoryIds.length > 0 && !applied.categoryIds.includes(r.categoryId)) return false;
            if (applied.statuses.length > 0 && !applied.statuses.includes(r.status)) return false;
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

    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, COMPARATORS);

    // ─── Pagination slice ──────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const pagedRows = useMemo(() => {
        const start = (clampedPage - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, clampedPage, pageSize]);

    // ─── Selection ─────────────────────────────────────────────────────────
    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAllOnPage = (checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) pagedRows.forEach(r => next.add(r.id));
            else pagedRows.forEach(r => next.delete(r.id));
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

    const allOnPageChecked  = pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id));
    const someOnPageChecked = !allOnPageChecked && pagedRows.some(r => selectedIds.has(r.id));

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

    function exportCsv() {
        const csv = buildCsv(
            ["Name", "SKU", "Retail category", "Price AED", "Stock", "Reorder threshold", "Status"],
            sorted.map(r => [
                r.name,
                r.sku,
                r.categoryLabel,
                r.priceAed.toString(),
                r.stockAggregate.toString(),
                r.reorderThreshold.toString(),
                r.status,
            ]),
        );
        downloadCsv(`retail-products-${todayISO()}.csv`, csv);
        showToast("Products exported", `${sorted.length} ${sorted.length === 1 ? "row" : "rows"} exported to CSV.`, "success", "check");
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
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={filteredRows.length} entitySingular="product" />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search product..." />
                <ToolbarExport onExportCsv={exportCsv} />
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
                                <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" aria-hidden />
                            )}
                        </span>
                    </Button>
                </IconTooltip>
                {/* Import — always immediately after Filter (memory rule
                    feedback_toolbar_import_order). Routes to the AI Agent
                    Migrate Data thread scoped to retail_products so the
                    admin lands on the file-upload step for this entity. */}
                <IconTooltip label="Import">
                    <Button
                        variant="secondary-gray"
                        size="icon"
                        aria-label="Import"
                        onClick={() => router.push(
                            `/ai-agent?mode=migrate_data&entity=retail_products&returnTo=${encodeURIComponent("/admin/products/retail")}`,
                        )}
                    >
                        <Upload01 className="w-5 h-5" />
                    </Button>
                </IconTooltip>
                <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push(`/products/retail/new?returnTo=${encodeURIComponent("/admin/products/retail")}`)}
                >
                    Add new
                </Button>
            </div>

            {/* ── Table + pagination ── */}
            <div className="relative flex flex-col flex-1">
                {sorted.length === 0 ? (
                    <div className="relative flex-1" style={{ minHeight: 400 }}>
                        <EmptyState
                            title="No products found"
                            subtitle="Try adjusting your search or filters."
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[44px]")}>
                                        <CheckboxCell
                                            checked={allOnPageChecked}
                                            indeterminate={someOnPageChecked}
                                            onChange={toggleAllOnPage}
                                            ariaLabel="Select all products"
                                        />
                                    </th>
                                    {/* Chevron column — expands per-branch subrows. */}
                                    <th className={cn(TH, "w-[36px]")} aria-hidden />
                                    <th className={cn(TH, "w-[340px]")}>
                                        <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Product name</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[140px]")}>
                                        <SortableHeader sortKey="sku" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>SKU</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[160px]")}>
                                        <SortableHeader sortKey="category" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Retail category</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[140px]")}>
                                        <SortableHeader sortKey="price" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Price</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[120px]")}>
                                        <SortableHeader sortKey="stock" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Stock</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[120px]")}>
                                        <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[52px]")}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map(r => {
                                    const isSelected = selectedIds.has(r.id);
                                    const stockLabel =
                                        r.stockAggregate === 0
                                            ? "Out of stock"
                                            : `${r.stockAggregate} units`;
                                    // Client 2026-07-31 — split the low-stock
                                    // tone away from the out-of-stock red.
                                    // Previous `#b54708` amber read too close
                                    // to `#b42318` red on the row; swapped for
                                    // `#dc6803` (Untitled DS warning/500) —
                                    // clearly yellower, still readable on
                                    // white, WCAG AA vs #101828 background.
                                    const stockTone = r.stockAggregate === 0
                                        ? "text-[#b42318] font-medium"
                                        : r.hasLowBranch
                                            ? "text-[#dc6803] font-medium"
                                            : "";
                                    const isExpanded = expandedIds.has(r.id);
                                    return (
                                        <React.Fragment key={r.id}>
                                            <tr
                                                onClick={() => router.push(`/products/retail/${r.id}`)}
                                                className={cn(
                                                    "transition-colors cursor-pointer",
                                                    isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                                                )}
                                            >
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <CheckboxCell
                                                        checked={isSelected}
                                                        onChange={() => toggleOne(r.id)}
                                                        ariaLabel={`Select ${r.name}`}
                                                    />
                                                </td>
                                                {/* Chevron — toggles per-branch nested rows.
                                                    stopPropagation so it doesn't also fire the
                                                    row's navigate-to-detail click. */}
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpanded(r.id)}
                                                        aria-label={isExpanded ? `Collapse ${r.name}` : `Expand ${r.name}`}
                                                        aria-expanded={isExpanded}
                                                        className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-[#eaecf0] transition-colors text-[#667085]"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronRight className="w-4 h-4" />
                                                        )}
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
                                                    {/* Same action ladder as memberships/packages,
                                                        plus the retail-specific "Configure stock"
                                                        entry. Deactivate ↔ Delete swap by history:
                                                        active + no history → Delete; active + has
                                                        history → Deactivate. */}
                                                    <RowActions items={[
                                                        { label: "View details",    icon: Eye,          onClick: () => router.push(`/products/retail/${r.id}`) },
                                                        { label: "Configure stock", icon: Package,      onClick: () => setConfigureId(r.id), hidden: r.status === "archived" },
                                                        { label: "Edit",            icon: Edit02,       onClick: () => router.push(`/products/retail/${r.id}/edit?returnTo=${encodeURIComponent("/admin/products/retail")}`), hidden: r.status !== "active" },
                                                        { label: "Archive",         icon: Archive,      onClick: () => openRowConfirm(r, "archive"),    hidden: r.status !== "active" && r.status !== "inactive" },
                                                        { label: "Reactivate",      icon: Check,        onClick: () => openRowConfirm(r, "reactivate"), hidden: r.status !== "inactive" },
                                                        { label: "Recover",         icon: RefreshCcw01, onClick: () => openRowConfirm(r, "recover"),    hidden: r.status !== "archived" },
                                                        { label: "Deactivate",      icon: SlashCircle01,onClick: () => openRowConfirm(r, "deactivate"), danger: true, hidden: !(r.status === "active" && r.hasHistory) },
                                                        { label: "Delete",          icon: Trash01,      onClick: () => openRowConfirm(r, "delete"),     danger: true, hidden: !(r.status === "active" && !r.hasHistory) },
                                                    ]} />
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-[#fafbfc]">
                                                    <td colSpan={9} className="px-0 py-0 border-b border-[#e4e7ec]">
                                                        <div className="px-6 py-4">
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
                )}

                <Pagination
                    page={clampedPage} total={sorted.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                />

                <BulkActionBar
                    count={selectedIds.size}
                    hasArchivable={hasArchivable}
                    hasReactivatable={hasReactivatable}
                    hasRecoverable={hasRecoverable}
                    hasDeletable={hasDeletable}
                    onClear={clearSelection}
                    onAction={openBulkConfirm}
                />
            </div>

            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={f => { setApplied(f); setPage(1); }}
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
