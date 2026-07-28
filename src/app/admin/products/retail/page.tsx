"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail list view (/admin/products/retail)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-28 — layout preview only. Chrome mirrors Gift cards
// (`/admin/products/gift-cards`) so the two lists sit side-by-side in the
// Products & pricing group with matching toolbar + table + row-action ⋮.
//
// Purely visual for the demo — 6 hardcoded sample rows so the client can
// see the shape end-to-end. No store wiring, no filters, no CRUD; that
// lands in Phase A of the inventory-retail plan.

import { useState } from "react";
import Image from "next/image";
import {
    Plus, Eye, Edit02, Archive, Trash01, Image01,
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

// ─── Demo rows (preview-only) ────────────────────────────────────────────────

type RetailStatus = "active" | "inactive" | "archived";

type PreviewRow = {
    id: string;
    name: string;
    sku: string;
    category: string;
    priceAed: number;
    stock: number;
    reorderThreshold: number;
    status: RetailStatus;
    /** Real product image URL. Optional in the preview — rows without an
     *  image render a neutral placeholder tile that will get swapped for
     *  the uploaded image in Phase B (see inventory-retail plan). */
    imageUrl?: string;
};

const PREVIEW_ROWS: PreviewRow[] = [
    { id: "r_001", name: "Onra Studio Tank",   sku: "APP-TNK-001", category: "Apparel",     priceAed:  120, stock: 42, reorderThreshold: 10, status: "active"   },
    { id: "r_002", name: "Grip Socks",         sku: "APP-SOK-002", category: "Apparel",     priceAed:   60, stock:  8, reorderThreshold: 12, status: "active"   },
    { id: "r_003", name: "Protein Blend",      sku: "SUP-PRO-010", category: "Supplements", priceAed:  180, stock: 24, reorderThreshold:  6, status: "active"   },
    { id: "r_004", name: "Recovery Roller",    sku: "EQP-ROL-104", category: "Equipment",   priceAed:  220, stock: 15, reorderThreshold:  4, status: "active"   },
    { id: "r_005", name: "Stainless Bottle",   sku: "ACC-BTL-050", category: "Accessories", priceAed:   85, stock:  0, reorderThreshold:  5, status: "inactive" },
    { id: "r_006", name: "Sleep Formula",      sku: "REC-SLP-201", category: "Recovery",    priceAed:  140, stock: 33, reorderThreshold:  8, status: "archived" },
];

/** 40×40 product thumbnail. Renders the uploaded image when provided;
 *  otherwise a neutral placeholder tile (soft gray square + Image01 glyph)
 *  that clearly reads as "image slot" while no real product photo exists.
 *  Same footprint as the previous IconAvatar circle so table row height
 *  stays unchanged. Swap to `<Image>` fully once Phase B ships real
 *  imageUrl on every product. */
function ProductThumb({ imageUrl, alt }: { imageUrl?: string; alt: string }) {
    if (imageUrl) {
        return (
            <div className="relative w-10 h-10 rounded-md overflow-hidden bg-[#f2f4f7] shrink-0">
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
            className="w-10 h-10 rounded-md bg-[#f2f4f7] border-1 border-[#eaecf0] flex items-center justify-center shrink-0"
            aria-hidden
        >
            <Image01 className="w-4 h-4 text-[#98a2b3]" />
        </div>
    );
}

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

const COMPARATORS: Record<string, (a: PreviewRow, b: PreviewRow) => number> = {
    name:     (a, b) => a.name.localeCompare(b.name),
    sku:      (a, b) => a.sku.localeCompare(b.sku),
    category: (a, b) => a.category.localeCompare(b.category),
    price:    (a, b) => a.priceAed - b.priceAed,
    stock:    (a, b) => a.stock - b.stock,
    status:   (a, b) => a.status.localeCompare(b.status),
};

export default function RetailPage() {
    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(PREVIEW_ROWS, COMPARATORS);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            {/* Client 2026-07-28 — preview only. Filter, Search, Add new and
                every row action are wired UI-first but non-functional for
                this demo pass; behaviour lands in Phase A (data) + Phase B
                (UI wire-up) of the inventory-retail plan. */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={PREVIEW_ROWS.length} entitySingular="product" />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search product..." />
                <ToolbarExport onExportCsv={() => { /* preview only */ }} />
                <IconTooltip label="Filter">
                    <Button
                        variant="secondary-gray"
                        size="icon"
                        aria-label="Filter"
                        onClick={() => { /* preview only */ }}
                    >
                        <Sliders className="w-5 h-5" />
                    </Button>
                </IconTooltip>
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
                    Add new
                </Button>
            </div>

            {/* ── Table + pagination ── */}
            <div className="relative flex flex-col flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={cn(TH, "w-[340px]")}>
                                    <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Product name</SortableHeader>
                                </th>
                                <th className={cn(TH, "w-[140px]")}>
                                    <SortableHeader sortKey="sku" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>SKU</SortableHeader>
                                </th>
                                <th className={cn(TH, "w-[160px]")}>
                                    <SortableHeader sortKey="category" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Category</SortableHeader>
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
                            {sorted.map(r => {
                                const isLow = r.stock === 0 || r.stock <= r.reorderThreshold;
                                return (
                                    <tr key={r.id} className="transition-colors cursor-pointer hover:bg-[#f9fafb]">
                                        <td className={TD}>
                                            <div className="flex items-center gap-3">
                                                <ProductThumb imageUrl={r.imageUrl} alt={r.name} />
                                                <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                            </div>
                                        </td>
                                        <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>{r.sku}</td>
                                        <td className={cn(TD, "whitespace-nowrap")}>{r.category}</td>
                                        <td className={cn(TD, "whitespace-nowrap")}>{formatAed(r.priceAed)}</td>
                                        <td className={cn(TD, "whitespace-nowrap")}>
                                            <span className={cn(isLow && "text-[#b54708] font-medium")}>
                                                {r.stock === 0 ? "Out of stock" : `${r.stock} units`}
                                            </span>
                                        </td>
                                        <td className={TD}>
                                            <StatusBadge type="product" status={r.status} />
                                        </td>
                                        <td className={TD} onClick={e => e.stopPropagation()}>
                                            <RowActions items={[
                                                { label: "View details", icon: Eye,     onClick: () => { /* preview only */ } },
                                                { label: "Edit",         icon: Edit02,  onClick: () => { /* preview only */ }, hidden: r.status !== "active" },
                                                { label: "Archive",      icon: Archive, onClick: () => { /* preview only */ }, hidden: r.status === "archived" },
                                                { label: "Delete",       icon: Trash01, onClick: () => { /* preview only */ }, danger: true },
                                            ]} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    page={page} total={PREVIEW_ROWS.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                />
            </div>
        </div>
    );
}
