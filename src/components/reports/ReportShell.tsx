"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared report page shell
// ─────────────────────────────────────────────────────────────────────────────
//
// Drives every report under `/reports/<slug>`. Figma 4211:128933.
//
// Layout:
//   • Header bar (h-72): X close (left), page title
//   • Body container with white card chrome
//   • Top-of-card: left = summary block ("Total" + count + period),
//                  right = toolbar slot (caller provides the widget mix)
//   • Horizontally-scrollable table with sortable header
//   • Pagination row at the bottom (per-page select · Prev / Next)
//   • Empty state when there are no rows to render
//
// Phase 1 scope: chrome + table render. Data is supplied by the report
// page that mounts the shell. Phase 2 will wire the data source to the
// live store seeds for each report.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, ArrowUp, ArrowDown, ChevronSelectorVertical,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

// ─── Column model ────────────────────────────────────────────────────────────

export interface ReportColumn<T> {
    /** Stable identifier used for sort + Select-column toggles. */
    key: string;
    /** Header label rendered in the table head row. */
    label: string;
    /** Minimum column width in pixels. Drives the table's horizontal scroll
     *  by summing across columns and applying a `minWidth` to the inner grid. */
    minWidth: number;
    /** Renderer for a single cell. The column key is unique; the rendered
     *  node controls colour / typography (e.g. red negative values for
     *  discount/refund columns). */
    render: (row: T) => ReactNode;
    /** When true the column never appears in the "Select column" dropdown
     *  (always visible). Defaults to false — toggleable. */
    fixed?: boolean;
    /** When true the column header is right-aligned. */
    align?: "left" | "right";
    /** Optional sort key. Sortable columns get arrow chrome in the header. */
    sort?: {
        getValue: (row: T) => number | string;
    };
}

export type SortDirection = "asc" | "desc" | null;

// ─── Shell props ────────────────────────────────────────────────────────────

export interface ReportShellProps<T> {
    /** Page title (e.g. "Total sales (orders)"). */
    title: string;
    /** Where the X close button navigates to. Defaults to /admin/reports. */
    returnTo?: string;
    /** Left of the toolbar — caption rendered above `summaryText`. */
    totalLabel: string;
    /** Live count + period under the caption — e.g. "9 records · Feb 2025". */
    summaryText: string;
    /** Right of the toolbar — caller composes the per-report widget mix. */
    toolbar: ReactNode;
    /** Full column list. The shell filters by `visibleKeys` at render time. */
    columns: ReportColumn<T>[];
    /** Set of column keys currently visible. Columns marked `fixed` stay
     *  visible regardless of this set. */
    visibleKeys: Set<string>;
    /** Rows to render. Empty array → EmptyState. */
    rows: T[];
    /** Pagination: rows per page (caller controls so it can be export-aware). */
    pageSize: number;
    onPageSizeChange: (n: number) => void;
    page: number;
    onPageChange: (n: number) => void;
    /** Empty state copy. */
    emptyTitle?: string;
    emptyMessage?: string;
}

export function ReportShell<T>({
    title, returnTo = "/admin/reports",
    totalLabel, summaryText, toolbar,
    columns, visibleKeys, rows,
    pageSize, onPageSizeChange,
    page, onPageChange,
    emptyTitle = "No records found",
    emptyMessage = "Adjust the filters above to see results.",
}: ReportShellProps<T>) {
    const router = useRouter();

    // Sort state — matches the existing `useSort` hook used by every
    // other module table (customers / products / staff / etc.). Cycle is
    // **desc → asc → off** and the icon set is
    //   inactive: ChevronSelectorVertical
    //   active:   ArrowDown (desc) / ArrowUp (asc)
    // so the reports module reads as one family with the rest of the app.
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<Exclude<SortDirection, null>>("desc");

    const visibleColumns = useMemo(
        () => columns.filter(c => c.fixed || visibleKeys.has(c.key)),
        [columns, visibleKeys],
    );

    const sortedRows = useMemo(() => {
        if (!sortKey) return rows;
        const col = columns.find(c => c.key === sortKey);
        if (!col?.sort) return rows;
        const getValue = col.sort.getValue;
        const copy = [...rows];
        copy.sort((a, b) => {
            const va = getValue(a);
            const vb = getValue(b);
            if (typeof va === "number" && typeof vb === "number") {
                return sortDir === "asc" ? va - vb : vb - va;
            }
            return sortDir === "asc"
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
        return copy;
    }, [rows, columns, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // desc → asc → off — same cycle as the existing `useSort` hook.
    function toggleSort(key: string) {
        const col = columns.find(c => c.key === key);
        if (!col?.sort) return;
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir("desc");
            return;
        }
        if (sortDir === "desc") { setSortDir("asc"); return; }
        setSortKey(null);
        setSortDir("desc");
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{title}</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
                {/* Top row: summary block · toolbar */}
                <div className="flex items-end justify-between gap-6 py-4 flex-wrap">
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] leading-[20px] text-[#667085]">{totalLabel}</p>
                        <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{summaryText}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        {toolbar}
                    </div>
                </div>

                {/* Table — borderless per design revision (no card chrome).
                    The horizontal scroller wraps the table so column overflow
                    pans inside the page, not the body. */}
                <div className="flex flex-col min-h-[600px]">
                    {rows.length === 0 ? (
                        <div className="relative flex-1 min-h-[400px]">
                            <EmptyState title={emptyTitle} subtitle={emptyMessage} />
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-x-auto">
                            <table className="w-full border-collapse" style={{
                                minWidth: visibleColumns.reduce((s, c) => s + c.minWidth, 0),
                            }}>
                                <thead>
                                    <tr className="border-b border-[#e4e7ec]">
                                        {visibleColumns.map(col => (
                                            <th key={col.key}
                                                style={{ minWidth: col.minWidth }}
                                                className={cn(
                                                    "px-6 py-3 text-[12px] font-medium text-[#475467] leading-[18px] whitespace-nowrap",
                                                    col.align === "right" ? "text-right" : "text-left",
                                                )}>
                                                <SortIconButton
                                                    label={col.label}
                                                    sortable={Boolean(col.sort)}
                                                    active={sortKey === col.key}
                                                    dir={sortDir}
                                                    align={col.align ?? "left"}
                                                    onClick={() => toggleSort(col.key)}
                                                />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-[#e4e7ec] last:border-b-0 hover:bg-[#f9fafb] transition-colors">
                                            {visibleColumns.map(col => (
                                                <td key={col.key}
                                                    style={{ minWidth: col.minWidth }}
                                                    className={cn(
                                                        "px-6 py-4 text-[14px] text-[#475467] leading-[20px] whitespace-nowrap",
                                                        col.align === "right" ? "text-right" : "text-left",
                                                    )}>
                                                    {col.render(row)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination — same chrome as the customers / products
                    tables (border-top divider, per-page popover that opens
                    upward, "Page X of Y" label, Previous/Next pills). */}
                {rows.length > 0 && (
                    <Pagination
                        page={clampedPage}
                        total={sortedRows.length}
                        pageSize={pageSize}
                        onPage={onPageChange}
                        onPageSize={onPageSizeChange}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Sortable header button ────────────────────────────────────────────────
//
// Mirrors `SortableHeader` from `src/components/ui/SortableHeader.tsx`:
//   inactive → `ChevronSelectorVertical`
//   active   → `ArrowDown` (desc) / `ArrowUp` (asc)
// Same hover treatment, same icon swap — so the reports module reads as
// one family with every other sortable table in the app.

function SortIconButton({ label, sortable, active, dir, align, onClick }: {
    label: string;
    sortable: boolean;
    active: boolean;
    dir: "asc" | "desc";
    align: "left" | "right";
    onClick: () => void;
}) {
    if (!sortable) {
        return <span className="inline-block">{label}</span>;
    }
    const Icon = !active
        ? ChevronSelectorVertical
        : dir === "asc" ? ArrowUp : ArrowDown;
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1 hover:text-[#101828] transition-colors select-none",
                align === "right" && "flex-row-reverse",
            )}>
            <span>{label}</span>
            <Icon className={cn(
                "w-3.5 h-3.5 shrink-0",
                active ? "text-[#475467]" : "text-[#98a2b3]",
            )} />
        </button>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.
