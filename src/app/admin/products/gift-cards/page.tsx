"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gift Cards list view (/admin/products/gift-cards)
// ─────────────────────────────────────────────────────────────────────────────
//
// Same chrome as the Memberships & Packages list (toolbar + 760px view card +
// bulk-select table + pagination + row-action ⋮) — with kind-specific
// differences:
//   • Single product type (no tabs)
//   • No branch picker in the toolbar (gift cards aren't branch-scoped yet)
//   • Filter is a SIMPLE single-select dropdown (Active / Inactive / Archive)
//     vs the side-panel multi-select used elsewhere
//   • Avatar in the Name column is a `Gift01` icon inside a 40px `#f2f4f7`
//     circle, matching the Figma 3726:21787 reference
//
// State source of truth: useAppStore(s => s.giftCardDesigns). Edits, status
// flips and deletes propagate to the Point of Sale catalog instantly via the live
// store join.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, DotsVertical,
    ChevronLeft, Eye, Edit02, Trash01, Trash02, Archive,
    Download01, XClose, RefreshCcw01, SlashCircle01, Check,
    Gift01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { IconAvatar } from "@/components/patterns/IconAvatar";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import {
    useAppStore,
    type GiftCardDesign,
} from "@/lib/store";
import { giftCardHolderCount } from "@/lib/giftCardHolders";
import type { IssuedGiftCard } from "@/lib/store";

// ─── Types & constants ───────────────────────────────────────────────────────

type GiftCardStatus = GiftCardDesign["status"]; // "active" | "inactive" | "archived"

const STATUS_LABEL: Record<GiftCardStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archive",
};

const STATUS_ORDER: Record<GiftCardStatus, number> = {
    active: 0, inactive: 1, archived: 2,
};

// Filter state is just a single nullable status. `null` = "show all" — the
// brief explicitly says this filter is simpler than the side-panel filter
// used elsewhere.
type StatusFilter = GiftCardStatus | null;

// ─── Display helpers ─────────────────────────────────────────────────────────

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

/** Display the card's price — fixed cards show the exact amount, custom
 *  cards show the min/max range. */
function priceLabel(g: GiftCardDesign): string {
    if (g.value_type === "fixed") {
        return formatAed(g.fixed_value_aed ?? 0);
    }
    return `AED ${g.min_value_aed ?? 0}–${g.max_value_aed ?? 0}`;
}

/** Numeric price used for sorting — fixed cards use their face value;
 *  custom cards sort by their minimum. */
function priceForSort(g: GiftCardDesign): number {
    if (g.value_type === "fixed") return g.fixed_value_aed ?? 0;
    return g.min_value_aed ?? 0;
}

/** "Valid until" cell — honours the `no_expiry` flag. */
function validUntilLabel(g: GiftCardDesign): string {
    if (g.no_expiry) return "No expiry";
    return g.valid_until_date ?? "—";
}

// ─── Status badge ────────────────────────────────────────────────────────────

// Local StatusBadge removed — uses canonical `<StatusBadge type="gift-card">`
// from `@/components/patterns/StatusBadge`.

// Local GiftAvatar removed — uses canonical `<IconAvatar icon={Gift01} />`
// from `@/components/patterns/IconAvatar`.

// ─── Status filter dropdown (single-select, simpler than side-panel) ────────

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

    const OPTIONS: { value: GiftCardStatus; label: string }[] = [
        { value: "active",   label: "Active"   },
        { value: "inactive", label: "Inactive" },
        { value: "archived", label: "Archive"  },
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
                    <p className="px-5 pt-1 pb-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3] leading-4">Status</p>
                    {OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => {
                                // Click the same option twice → clear the filter
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

// ─── Row actions (⋮) ────────────────────────────────────────────────────────
//
// Same state-aware action set as memberships/packages:
//   • Active   → View · Edit · Archive · Deactivate (red) / Delete (red, when no holders)
//   • Inactive → View · Reactivate · Archive · Delete (red, when no holders)
//   • Archived → View · Recover · Delete (red, when no holders)
//
// Until issued_gift_cards lands, every gift-card design is treated as
// holder-free → Delete shows whenever it's available.

type RowActionKind = "deactivate" | "reactivate" | "archive" | "recover" | "delete";

// Local RowActions removed — uses canonical `<RowActions items={[...]}>` from
// `@/components/patterns/RowActions`. Items array is built per-row at the
// call site below based on status + hasHolders.

// ─── Confirmation modal (same tone matrix as memberships) ───────────────────

type ConfirmTone = "destructive" | "primary";
type ModalAction = RowActionKind;

const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
    tone: ConfirmTone;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this gift card?",
        titleBulk:   n => `Archive ${n} gift cards?`,
        description: subject => <>{subject} will be removed from the Point of Sale catalog. You can recover archived gift cards at any time.</>,
        confirmLabel: "Archive",
        tone: "primary",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this gift card?",
        titleBulk:   n => `Deactivate ${n} gift cards?`,
        description: (subject, n) => <>{subject} will be hidden from new Point of Sale sales. Customers who already hold {n === 1 ? "it" : "them"} keep their balance.</>,
        confirmLabel: "Deactivate",
        tone: "destructive",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this gift card?",
        titleBulk:   n => `Recover ${n} gift cards?`,
        description: subject => <>{subject} will be restored to Active status and become sellable again.</>,
        confirmLabel: "Recover",
        tone: "primary",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        titleSingle: "Reactivate this gift card?",
        titleBulk:   n => `Reactivate ${n} gift cards?`,
        description: subject => <>{subject} will become available again in the Point of Sale catalog.</>,
        confirmLabel: "Reactivate",
        tone: "primary",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        titleSingle: "Delete this gift card?",
        titleBulk:   n => `Delete ${n} gift cards?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
        tone: "destructive",
    },
};

// Local ActionModal removed — uses canonical `<ConfirmModal>` driven by
// MODAL_CONFIG above.

// ─── Export dropdown ────────────────────────────────────────────────────────

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ExportDropdown({ onExportCsv }: { onExportCsv: () => void }) {
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
                onClick={() => setOpen(p => !p)}>
                Export
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[140px]">
                    {EXPORT_FORMATS.map(fmt => (
                        <button key={fmt} type="button"
                            onClick={() => {
                                setOpen(false);
                                // Only CSV is wired today; PDF / Excel come later.
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-5 py-3 text-[15px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportGiftCardsCsv(rows: GiftCardRow[]) {
    const header = ["Design name", "Price", "Active customers", "Valid until", "Status"];
    const body = rows.map(r => [
        r.name,
        r.priceLabel,
        String(r.activeCustomers),
        r.validUntil,
        STATUS_LABEL[r.status],
    ]);
    downloadCsv(`gift-cards-${todayISO()}.csv`, buildCsv(header, body));
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Bulk action bar (floating pill, same pattern as memberships) ───────────

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
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
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
                    {hasArchivable && (
                        hasDeletable ? (
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("delete")}>
                                Delete
                            </Button>
                        ) : (
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("deactivate")}>
                                Deactivate
                            </Button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Table header/cell constants ───────────────────────────────────────────


// ─── Checkbox cell (same sage style as schedule + memberships) ──────────────

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
            {indeterminate ? (
                <span className="block w-2 h-[1.5px] bg-white" />
            ) : checked ? (
                <Check className="w-3 h-3" />
            ) : null}
        </button>
    );
}

// ─── Row VM ────────────────────────────────────────────────────────────────

type GiftCardRow = {
    id: string;
    name: string;
    priceLabel: string;
    priceSort: number;
    activeCustomers: number;
    validUntil: string;
    /** Sort key for "Valid until" — `no_expiry` rows sort last. */
    validUntilSort: number;
    status: GiftCardStatus;
    hasHolders: boolean;
};

function rowsFromDesigns(items: GiftCardDesign[], issuedGiftCards: IssuedGiftCard[]): GiftCardRow[] {
    return items.map(g => {
        // Holder count comes from the live `issued_gift_cards` table so the
        // list, the detail sidebar, and the detail "Active customers" tab all
        // agree — and so the delete-vs-deactivate gate is correct.
        const holderCount = giftCardHolderCount(g.id, issuedGiftCards);
        return {
            id: g.id,
            name: g.name,
            priceLabel: priceLabel(g),
            priceSort: priceForSort(g),
            activeCustomers: holderCount,
            validUntil: validUntilLabel(g),
            // No-expiry rows sort to the bottom (Number.MAX_SAFE_INTEGER). Date
            // rows sort by their numeric epoch.
            validUntilSort: g.no_expiry
                ? Number.MAX_SAFE_INTEGER
                : (g.valid_until_date ? new Date(g.valid_until_date).getTime() : 0),
            status: g.status,
            hasHolders: holderCount > 0,
        };
    });
}

// ─── List view (table) ────────────────────────────────────────────────────

function ListView({
    rows, sortKey, sortDir, onSort,
    selectedIds, onToggleOne, onToggleAll,
    onRowAction, onView, onEdit,
}: {
    rows: GiftCardRow[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onRowAction: (row: GiftCardRow, kind: RowActionKind) => void;
    onView: (row: GiftCardRow) => void;
    onEdit: (row: GiftCardRow) => void;
}) {
    if (rows.length === 0) {
        return (
            <div className="relative flex-1" style={{ minHeight: 300 }}>
                <EmptyState title="No gift cards found" subtitle="Try adjusting your search or filter." />
            </div>
        );
    }

    const allChecked = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && rows.some(r => selectedIds.has(r.id));

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[44px]")}>
                            <CheckboxCell
                                checked={allChecked}
                                indeterminate={someChecked}
                                onChange={onToggleAll}
                                ariaLabel="Select all gift cards"
                            />
                        </th>
                        <th className={cn(TH, "w-[320px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Gift card name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[140px]")}>
                            <SortableHeader sortKey="price" currentSort={sortKey} dir={sortDir} onSort={onSort}>Price</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="customers" currentSort={sortKey} dir={sortDir} onSort={onSort}>Active customers</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="valid_until" currentSort={sortKey} dir={sortDir} onSort={onSort}>Valid until</SortableHeader>
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
                        return (
                            <tr key={r.id}
                                onClick={() => onView(r)}
                                className={cn(
                                    "transition-colors cursor-pointer",
                                    isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                                )}>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    <CheckboxCell
                                        checked={isSelected}
                                        onChange={() => onToggleOne(r.id)}
                                        ariaLabel={`Select ${r.name}`}
                                    />
                                </td>
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <IconAvatar icon={Gift01} />
                                        <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                    </div>
                                </td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.priceLabel}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.activeCustomers}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.validUntil}</td>
                                <td className={TD}><StatusBadge type="gift-card" status={r.status} /></td>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    <RowActions items={[
                                        { label: "View details", icon: Eye, onClick: () => onView(r) },
                                        { label: "Edit", icon: Edit02, onClick: () => onEdit(r), hidden: r.status !== "active" },
                                        { label: "Archive", icon: Archive, onClick: () => onRowAction(r, "archive"), hidden: r.status !== "active" && r.status !== "inactive" },
                                        { label: "Reactivate", icon: Check, onClick: () => onRowAction(r, "reactivate"), hidden: r.status !== "inactive" },
                                        { label: "Recover", icon: RefreshCcw01, onClick: () => onRowAction(r, "recover"), hidden: r.status !== "archived" },
                                        { label: "Deactivate", icon: SlashCircle01, onClick: () => onRowAction(r, "deactivate"), danger: true, hidden: !(r.status === "active" && r.hasHolders) },
                                        { label: "Delete", icon: Trash01, onClick: () => onRowAction(r, "delete"), danger: true, hidden: !(r.status === "active" && !r.hasHolders) },
                                    ]} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row"; row: GiftCardRow; kind: RowActionKind }
    | { mode: "bulk"; rows: GiftCardRow[]; kind: RowActionKind };

export default function GiftCardsPage() {
    const router = useRouter();

    // ─── Store subscriptions ───────────────────────────────────────────────
    const giftCardDesigns        = useAppStore(s => s.giftCardDesigns);
    const issuedGiftCards        = useAppStore(s => s.issuedGiftCards);
    const setGiftCardDesignStatus = useAppStore(s => s.setGiftCardDesignStatus);
    const deleteGiftCardDesign    = useAppStore(s => s.deleteGiftCardDesign);
    const deleteGiftCardDesigns   = useAppStore(s => s.deleteGiftCardDesigns);
    const showToast              = useAppStore(s => s.showToast);

    // ─── Local UI state ────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<StatusFilter>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

    useEffect(() => { setPage(1); }, [search, filter]);

    // ─── Build + filter rows ───────────────────────────────────────────────
    const allRows = useMemo(() => rowsFromDesigns(giftCardDesigns, issuedGiftCards), [giftCardDesigns, issuedGiftCards]);
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (q && !r.name.toLowerCase().includes(q)) return false;
            if (filter && r.status !== filter) return false;
            return true;
        });
    }, [allRows, search, filter]);

    // ─── Sort ──────────────────────────────────────────────────────────────
    const comparators: Record<string, (a: GiftCardRow, b: GiftCardRow) => number> = {
        name:        (a, b) => a.name.localeCompare(b.name),
        price:       (a, b) => a.priceSort - b.priceSort,
        customers:   (a, b) => a.activeCustomers - b.activeCustomers,
        valid_until: (a, b) => a.validUntilSort - b.validUntilSort,
        status:      (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, comparators);

    // ─── Pagination slice ──────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Selection helpers ─────────────────────────────────────────────────
    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    }
    function toggleAllOnPage(check: boolean) {
        const next = new Set(selectedIds);
        if (check) pagedRows.forEach(r => next.add(r.id));
        else pagedRows.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    function clearSelection() { setSelectedIds(new Set()); }

    // ─── Bulk derived flags ────────────────────────────────────────────────
    const selectedRows = useMemo(
        () => sorted.filter(r => selectedIds.has(r.id)),
        [sorted, selectedIds],
    );
    const hasArchivable    = selectedRows.some(r => r.status !== "archived");
    const hasReactivatable = selectedRows.some(r => r.status === "inactive");
    const hasRecoverable   = selectedRows.some(r => r.status === "archived");
    // Delete only when every selected row is Active AND holder-free —
    // inactive/archived gift cards must be reactivated/recovered first.
    const hasDeletable     = selectedRows.length > 0
        && selectedRows.every(r => r.status === "active" && !r.hasHolders);

    // ─── Action plumbing ───────────────────────────────────────────────────
    function openRowConfirm(row: GiftCardRow, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function handleView(row: GiftCardRow) {
        router.push(`/products/gift-cards/${row.id}?returnTo=${encodeURIComponent("/admin/products/gift-cards")}`);
    }
    function handleEdit(row: GiftCardRow) {
        router.push(`/products/gift-cards/${row.id}/edit?returnTo=${encodeURIComponent("/admin/products/gift-cards")}`);
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "archive":    return selectedRows.filter(r => r.status !== "archived");
                case "recover":    return selectedRows.filter(r => r.status === "archived");
                case "delete":     return selectedRows.filter(r => r.status === "active" && !r.hasHolders);
            }
        })();
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const kind = pending.kind;
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;
        const ids = rows.map(r => r.id);

        // ─── Status mutations ─────────────────────────────────────────────
        if (kind === "deactivate" || kind === "reactivate" || kind === "archive" || kind === "recover") {
            const nextStatus: GiftCardStatus =
                kind === "deactivate" ? "inactive" :
                kind === "reactivate" ? "active" :
                kind === "archive"    ? "archived" :
                /* recover */ "active";
            setGiftCardDesignStatus(ids, nextStatus);

            const verbPast =
                kind === "deactivate" ? "deactivated" :
                kind === "reactivate" ? "reactivated" :
                kind === "archive"    ? "archived" :
                "recovered";
            const titleSingle =
                kind === "deactivate" ? "Gift card deactivated" :
                kind === "reactivate" ? "Gift card reactivated" :
                kind === "archive"    ? "Gift card archived" :
                "Gift card recovered";
            const icon: "slash" | "archive" | "refresh" | "check" =
                kind === "deactivate" ? "slash" :
                kind === "archive"    ? "archive" :
                kind === "reactivate" ? "check" :
                "refresh";
            const tone: "success" | "error" = kind === "deactivate" ? "error" : "success";

            if (rows.length === 1) {
                showToast(titleSingle, `${rows[0].name} has been ${verbPast}.`, tone, icon);
            } else {
                showToast(
                    `${rows.length} gift cards ${verbPast}`,
                    `Your selected gift cards have been ${verbPast} and the catalog updated.`,
                    tone, icon,
                );
            }
            clearSelection();
            setPendingConfirm(null);
            return;
        }

        // ─── Delete ───────────────────────────────────────────────────────
        if (kind === "delete") {
            if (pending.mode === "row") {
                deleteGiftCardDesign(ids[0]);
                showToast("Gift card deleted", `${rows[0].name} has been deleted.`, "success", "trash");
            } else {
                const r = deleteGiftCardDesigns(ids);
                showToast(
                    "Gift cards deleted",
                    `${r.deleted.length} gift card${r.deleted.length === 1 ? "" : "s"} deleted.`,
                    "success", "trash",
                );
            }
            clearSelection();
            setPendingConfirm(null);
        }
    }

    // ─── Modal subject copy ───────────────────────────────────────────────
    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[#344054]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected gift cards</>,
        };
    }

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={filteredRows.length} entitySingular="gift card" />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search product..." />
                <ExportDropdown
                    onExportCsv={() => {
                        exportGiftCardsCsv(filteredRows);
                        showToast(
                            "Gift cards exported",
                            `${filteredRows.length} gift card${filteredRows.length === 1 ? "" : "s"} exported to CSV.`,
                            "success", "check",
                        );
                    }}
                />
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push(`/products/gift-cards/new?returnTo=${encodeURIComponent("/admin/products/gift-cards")}`)}>
                    Add new
                </Button>
            </div>

            {/* Body — sits flush on the admin chrome (no nested view card)
                per Figma 3726:21787. The relative wrapper anchors the
                floating bulk-action pill so it can absolutely-position over
                the table area without escaping the page. */}
            <div className="relative flex flex-col flex-1">
                {sorted.length === 0 ? (
                    <div className="relative flex-1" style={{ minHeight: 400 }}>
                        <EmptyState
                            title="No gift cards found"
                            subtitle="Try adjusting your search or filter."
                        />
                    </div>
                ) : (
                    <ListView
                        rows={pagedRows}
                        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
                        selectedIds={selectedIds}
                        onToggleOne={toggleOne}
                        onToggleAll={toggleAllOnPage}
                        onRowAction={openRowConfirm}
                        onView={handleView}
                        onEdit={handleEdit}
                    />
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
