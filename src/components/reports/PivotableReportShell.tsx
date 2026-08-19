"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · shared shell (rewrite v3 — matches ReportShell)
// ─────────────────────────────────────────────────────────────────────────────
//
// Chrome copied line-for-line from ReportShell (the existing per-report
// shell used by every legacy /reports/{slug} page). NO deviations:
//
//   • Header (h-72): X close + title only. NO border-bottom.
//   • Body: overflow-y-auto · px-6 pb-6.
//   • Top row: LEFT = summary block ("Total" caption + "N records · date
//     range · [by period]"). RIGHT = toolbar buttons.
//   • Table: min-h-[600px], no card chrome, sortable header, one border-b
//     under the header row only.
//   • Pagination at the bottom (shared @/components/ui/Pagination).
//
// The two client asks that DIFFER from ReportShell:
//   1. Grouping by PERIOD (Week / Month / Quarter / etc). New dropdown in
//      the toolbar. When != None, table swaps to pivot mode.
//   2. Grouping by TYPE (Category / Channel / etc). New dropdown in the
//      toolbar — drives the row axis in pivot mode; ignored in list mode.
//
// Refund model (client rule #10 — enforced upstream by resolveLedger):
// same-day pre-settle refunds are VOIDS (both rows erased); later refunds
// land as negative rows in THEIR OWN period. Past never restates.

import * as React from "react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, ChevronDown, Check,
    Grid01, Columns01, MarkerPin01, CalendarPlus01, Download01,
    ArrowUp, ArrowDown, ChevronSelectorVertical,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { pivotRows, periodLabelFor } from "@/lib/reports/pivot";
import {
    buildListCsv, buildPivotCsv, triggerCsvDownload,
} from "@/lib/reports/export-csv";
import {
    exportListXlsx, exportPivotXlsx, type ExportMetadata,
} from "@/lib/reports/export-excel";
import type {
    ColumnDef, PeriodKey, ReportDefinition,
} from "@/lib/reports/types";

// ─── Props ────────────────────────────────────────────────────────────────

export interface BranchOption { id: string; name: string; }

export interface PivotableReportShellProps {
    report: ReportDefinition;
    rows: readonly Record<string, unknown>[];
    branches: readonly BranchOption[];
    /** Field on each row that holds the branch id. Defaults to "branchId". */
    branchField?: string;
    /** X-close target. Defaults to "/admin/reports". */
    backHref?: string;
    /** Optional slot rendered to the right of the toolbar buttons. Rare —
     *  most reports don't need it (kept for the legacy Total Sales "Export
     *  invoice" split button). */
    toolbarRight?: React.ReactNode;
    /** Fired with the resolved date range + visible branch ids whenever they
     *  change. Lets a page that pre-aggregates its own rows (e.g. Sales
     *  Breakdown) scope that aggregation to the shell's date + location
     *  filters — the shell's own row filter no-ops on rows that carry no
     *  date/branch field, so there's no double-filtering. */
    onScopeChange?: (scope: { fromISO: string; toISO: string; branchIds: string[] }) => void;
}

// ─── Period labels ────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<PeriodKey, string> = {
    none:    "None",
    day:     "Day",
    week:    "Week",
    month:   "Month",
    quarter: "Quarter",
    year:    "Year",
};

// ─── Date-range → concrete ISO bounds resolver ────────────────────────────

interface DateRangeISO { fromISO: string; toISO: string; label: string; }
function iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function resolveDateFilter(f: DateFilter | undefined): DateRangeISO {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (!f) {
        // Default matches ReportShell: last 30 days
        const from = addDays(today, -29);
        return { fromISO: iso(from), toISO: iso(today), label: "Last 30 days" };
    }
    if (f.type === "custom") return { fromISO: iso(f.from), toISO: iso(f.to), label: f.label };
    const L = f.label;
    if (L === "Today")        return { fromISO: iso(today), toISO: iso(today), label: L };
    if (L === "Yesterday")    { const y = addDays(today, -1); return { fromISO: iso(y), toISO: iso(y), label: L }; }
    if (L === "Last 7 days")  return { fromISO: iso(addDays(today, -6)),  toISO: iso(today), label: L };
    if (L === "Last 30 days") return { fromISO: iso(addDays(today, -29)), toISO: iso(today), label: L };
    if (L === "Last 90 days") return { fromISO: iso(addDays(today, -89)), toISO: iso(today), label: L };
    const dow = (today.getDay() + 6) % 7;
    const monThis = addDays(today, -dow);
    if (L === "This week")    return { fromISO: iso(monThis),               toISO: iso(addDays(monThis, 6)),  label: L };
    if (L === "Last week")    return { fromISO: iso(addDays(monThis, -7)),  toISO: iso(addDays(monThis, -1)), label: L };
    const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastThisMonth  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    if (L === "This month")    return { fromISO: iso(firstThisMonth), toISO: iso(lastThisMonth), label: L };
    if (L === "Month to date") return { fromISO: iso(firstThisMonth), toISO: iso(today),         label: L };
    if (L === "Last month") {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last  = new Date(today.getFullYear(), today.getMonth(),     0);
        return { fromISO: iso(first), toISO: iso(last), label: L };
    }
    if (L === "Last 12 months") {
        // Exactly 12 months back from today (not first-of-next-month a year ago),
        // so the label matches the range and early data isn't clipped.
        const from = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        return { fromISO: iso(from), toISO: iso(today), label: L };
    }
    const firstThisYear = new Date(today.getFullYear(), 0, 1);
    const lastThisYear  = new Date(today.getFullYear(), 11, 31);
    if (L === "This year")    return { fromISO: iso(firstThisYear), toISO: iso(lastThisYear), label: L };
    if (L === "Year to date") return { fromISO: iso(firstThisYear), toISO: iso(today),        label: L };
    if (L === "Last year") {
        const first = new Date(today.getFullYear() - 1, 0, 1);
        const last  = new Date(today.getFullYear() - 1, 11, 31);
        return { fromISO: iso(first), toISO: iso(last), label: L };
    }
    return { fromISO: iso(addDays(today, -29)), toISO: iso(today), label: L || "Last 30 days" };
}

// ─── Column visibility persistence ────────────────────────────────────────

// Versioned key — bumped when the reports' default column visibility changes
// (client "Report Columns" Column-E pass). Bumping invalidates every browser's
// stale saved column set so the new hiddenByDefault defaults take effect instead
// of a pre-change cached selection.
const COL_STORAGE_PREFIX = "onra-reports-v2";
function loadColVisibility(reportId: string, columns: readonly ColumnDef[]): Set<string> {
    if (typeof window === "undefined") return new Set(columns.filter(c => !c.hiddenByDefault).map(c => c.key));
    try {
        const raw = window.localStorage.getItem(`${COL_STORAGE_PREFIX}:${reportId}:cols`);
        if (raw) {
            const parsed = JSON.parse(raw) as string[];
            const allowed = new Set(columns.map(c => c.key));
            const visible = new Set(parsed.filter(k => allowed.has(k)));
            if (visible.size > 0) return visible;
        }
    } catch { /* fall through */ }
    return new Set(columns.filter(c => !c.hiddenByDefault).map(c => c.key));
}
function saveColVisibility(reportId: string, visible: Set<string>): void {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(`${COL_STORAGE_PREFIX}:${reportId}:cols`, JSON.stringify(Array.from(visible))); }
    catch { /* quota — ignore */ }
}

// ─── Cell formatting ──────────────────────────────────────────────────────

const CURRENCY_FMT = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
const NUMBER_FMT   = new Intl.NumberFormat("en-US");
// Accounting-style money: a negative value renders in brackets, e.g. (AED 170)
// instead of AED -170. The red colour is applied at the cell (see isNegMoney),
// since a string can't carry a class — this returns the bracketed text only.
function fmtCurrency(n: number): string {
    // Decide the sign on the ROUNDED value so a tiny negative (e.g. −0.3 that
    // rounds to 0) renders "AED 0", never "(AED 0)".
    const rounded = Math.round(n);
    const body = `AED ${CURRENCY_FMT.format(Math.abs(rounded))}`;
    return rounded < 0 ? `(${body})` : body;
}
/** True when a cell should render red — a negative currency value. */
function isNegMoney(value: unknown, kind: ColumnDef["kind"] | undefined): boolean {
    return kind === "currency" && Number(value) < 0;
}
function formatCell(value: unknown, kind: ColumnDef["kind"]): string {
    if (value === null || value === undefined || value === "") return "—";
    if (kind === "currency") { const n = Number(value); if (!Number.isFinite(n)) return String(value); return fmtCurrency(n); }
    if (kind === "number")   { const n = Number(value); if (!Number.isFinite(n)) return String(value); return NUMBER_FMT.format(Math.round(n)); }
    if (kind === "percent")  { const n = Number(value); if (!Number.isFinite(n)) return String(value); return `${n.toFixed(1)}%`; }
    if (kind === "date")     { const s = String(value).slice(0, 10); return s || "—"; }
    return String(value);
}

// List-mode grouping — aggregate rows by a break-down dimension into one row per
// group: numeric/currency columns are summed, a text/date/status column shows
// its value when uniform across the group (else blank), and ratio (percent)
// columns are left blank (a rate can't be summed). This lets "Group by" work
// standalone in the flat list — no period pivot required — so it works on every
// report, including snapshots like Stock on Hand that have no period.
function groupListRows(
    rows: readonly Record<string, unknown>[],
    dimension: { extract: (r: Record<string, unknown>) => unknown },
    columns: readonly ColumnDef[],
): Record<string, unknown>[] {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
        const key = String(dimension.extract(r) ?? "—");
        let arr = groups.get(key);
        if (!arr) { arr = []; groups.set(key, arr); }
        arr.push(r);
    }
    // Pass 1 — sum numeric, keep uniform text, blank plain ratios.
    const summed = Array.from(groups.values()).map(groupRows => {
        const out: Record<string, unknown> = {};
        for (const c of columns) {
            if (c.groupCalc) { out[c.key] = 0; continue; } // derived — filled in pass 2
            if (c.kind === "currency" || c.kind === "number") {
                let sum = 0; let any = false;
                for (const r of groupRows) { const n = Number(r[c.key]); if (Number.isFinite(n)) { sum += n; any = true; } }
                out[c.key] = any ? sum : "";
            } else if (c.kind === "percent") {
                out[c.key] = "";
            } else {
                const vals = new Set(groupRows.map(r => String(r[c.key] ?? "")));
                out[c.key] = vals.size === 1 ? Array.from(vals)[0] : "";
            }
        }
        return out;
    });
    // Pass 2 — derived columns (ratios) computed from the summed rows, with
    // access to all groups for cross-group totals (e.g. "% of total").
    const calcCols = columns.filter(c => c.groupCalc);
    for (const row of summed) {
        for (const c of calcCols) { row[c.key] = c.groupCalc!(row, summed); }
    }
    return summed;
}

// ═════════════════════════════════════════════════════════════════════════
// The shell
// ═════════════════════════════════════════════════════════════════════════

export function PivotableReportShell({
    report, rows: allRows, branches,
    branchField = "branchId",
    backHref = "/admin/reports",
    toolbarRight,
    onScopeChange,
}: PivotableReportShellProps) {
    const router = useRouter();

    const defaultPeriod: PeriodKey =
        report.periods.includes("none") ? "none" : report.periods[0] ?? "none";

    const [period, setPeriod] = useState<PeriodKey>(defaultPeriod);
    const [dimIdx, setDimIdx] = useState<number>(() =>   // -1 = None
        report.defaultDimensionKey
            ? report.dimensions.findIndex(d => d.key === report.defaultDimensionKey)
            : -1,
    );
    // Measure is always the report's primary measure. The measure dropdown was
    // removed (client 2026-08 — switching it changed nothing on screen).
    const meaIdx = 0;
    // Default to a wide window so the historical demo data is visible on open —
    // "Last 30 days" showed almost nothing now that the seed runs 2025-08→2026-07.
    const [dateFilter, setDateFilter] = useState<DateFilter | undefined>({ type: "month", label: "Last 12 months" });
    const [visibleBranchIds, setVisibleBranchIds] = useState<Set<string>>(
        () => new Set(branches.map(b => b.id)),
    );
    const [visibleCols, setVisibleCols] = useState<Set<string>>(
        () => loadColVisibility(report.id, report.columns),
    );
    useEffect(() => { saveColVisibility(report.id, visibleCols); }, [report.id, visibleCols]);

    // List-mode sort + pagination (state kept but ignored in pivot mode).
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(1);

    // ─ Row filter (branch + date range) ─────────────────────────────────
    const dateISO = useMemo(() => resolveDateFilter(dateFilter), [dateFilter]);
    const periodField = report.periodField ?? "createdAtISO";
    const dimension = dimIdx >= 0 ? report.dimensions[dimIdx] ?? null : null;
    const measure = report.measures[meaIdx] ?? report.measures[0];

    const filteredRows = useMemo(() => {
        const { fromISO, toISO } = dateISO;
        return allRows.filter(r => {
            const b = String(r[branchField] ?? "");
            if (b && visibleBranchIds.size > 0 && !visibleBranchIds.has(b)) return false;
            const d = String(r[periodField] ?? "").slice(0, 10);
            if (!d) return true;
            if (d < fromISO) return false;
            if (d > toISO)   return false;
            return true;
        });
    }, [allRows, branchField, visibleBranchIds, dateISO, periodField]);

    // Report the resolved scope (date range + visible branches) to a
    // pre-aggregating page, so it can re-aggregate within the active filters.
    useEffect(() => {
        onScopeChange?.({
            fromISO: dateISO.fromISO,
            toISO: dateISO.toISO,
            branchIds: Array.from(visibleBranchIds),
        });
    }, [dateISO.fromISO, dateISO.toISO, visibleBranchIds, onScopeChange]);

    // Base list rows — grouped by the break-down dimension when one is picked in
    // list mode (so "Group by" works without a period pivot, incl. on snapshot
    // reports); otherwise the flat filtered set.
    const listBaseRows = useMemo<Record<string, unknown>[]>(() => {
        if (period !== "none" || !dimension) return filteredRows as Record<string, unknown>[];
        return groupListRows(filteredRows, dimension, report.columns);
    }, [filteredRows, period, dimension, report.columns]);

    // Sort for list mode.
    const sortedRows = useMemo(() => {
        if (period !== "none") return filteredRows;
        if (!sortKey) return listBaseRows;
        const col = report.columns.find(c => c.key === sortKey);
        if (!col) return listBaseRows;
        const copy = [...listBaseRows];
        copy.sort((a, b) => {
            const va = a[sortKey]; const vb = b[sortKey];
            const na = Number(va); const nb = Number(vb);
            if (Number.isFinite(na) && Number.isFinite(nb)) return sortDir === "asc" ? na - nb : nb - na;
            return sortDir === "asc"
                ? String(va ?? "").localeCompare(String(vb ?? ""))
                : String(vb ?? "").localeCompare(String(va ?? ""));
        });
        return copy;
    }, [filteredRows, listBaseRows, period, sortKey, sortDir, report.columns]);

    // Pivot.
    const pivot = useMemo(() => {
        if (period === "none" || !measure) return null;
        return pivotRows(filteredRows, { periodField, period, dimension, measure });
    }, [filteredRows, period, periodField, dimension, measure]);

    // Summary text ("N records · date range · by month").
    const summaryText = useMemo(() => {
        const count = filteredRows.length;
        const parts: string[] = [];
        parts.push(`${count} record${count === 1 ? "" : "s"}`);
        parts.push(dateISO.label);
        if (period !== "none") parts.push(`by ${PERIOD_LABEL[period].toLowerCase()}`);
        return parts.join(" · ");
    }, [filteredRows.length, dateISO.label, period]);

    // Export handlers.
    function buildFilename(ext: "csv" | "xlsx"): string {
        return `${report.id}_${dateISO.fromISO}_${dateISO.toISO}.${ext}`;
    }
    function stamp(m: ExportMetadata): ExportMetadata { return { ...m, exportedAtISO: new Date().toISOString() }; }
    function buildMetadata(): ExportMetadata {
        const activeBranches = branches.filter(b => visibleBranchIds.has(b.id)).map(b => b.name);
        const locFilter = activeBranches.length === branches.length
            ? "All locations"
            : activeBranches.join(", ") || "None";
        return {
            reportTitle: report.title,
            dateRange:   `${dateISO.fromISO} → ${dateISO.toISO} (${dateISO.label})`,
            filters:     `Location: ${locFilter}`,
            period:      period === "none" ? "None (list)" : PERIOD_LABEL[period],
            breakdown:   dimension?.label ?? "None",
            exportedAtISO: "",
            rowCount:    period === "none" ? filteredRows.length : (pivot?.rowKeys.length ?? 0),
        };
    }
    function handleExportCsv() {
        const cols = report.columns.filter(c => visibleCols.has(c.key));
        if (period === "none" || !pivot) {
            const csv = buildListCsv({ columns: cols, rows: listBaseRows, filename: buildFilename("csv") });
            triggerCsvDownload(csv, buildFilename("csv"));
        } else {
            const colHeaders = pivot.colKeys.map(k => periodLabelFor(k, period, period === "month"));
            const csv = buildPivotCsv({ rowHeader: dimension?.label ?? "All", colHeaders, pivot, filename: buildFilename("csv") });
            triggerCsvDownload(csv, buildFilename("csv"));
        }
    }
    function handleExportXlsx() {
        const meta = stamp(buildMetadata());
        const cols = report.columns.filter(c => visibleCols.has(c.key));
        if (period === "none" || !pivot) {
            exportListXlsx({ columns: cols, rows: listBaseRows, filename: buildFilename("xlsx"), meta, sheetName: report.title });
        } else {
            const colHeaders = pivot.colKeys.map(k => periodLabelFor(k, period, period === "month"));
            exportPivotXlsx({
                rowHeader: dimension?.label ?? "All",
                colHeaders, pivot,
                filename: buildFilename("xlsx"),
                meta, sheetName: report.title,
                valueKind: measure?.kind === "number" ? "number" : "currency",
            });
        }
    }

    // Toggle helpers.
    function toggleCol(key: string) {
        setVisibleCols(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            if (next.size === 0) next.add(key);
            return next;
        });
    }
    function toggleBranch(id: string) {
        setVisibleBranchIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            if (next.size === 0) next.add(id);
            return next;
        });
    }
    function toggleSort(key: string) {
        const col = report.columns.find(c => c.key === key);
        if (!col) return;
        if (sortKey !== key) { setSortKey(key); setSortDir("desc"); return; }
        if (sortDir === "desc") { setSortDir("asc"); return; }
        setSortKey(null); setSortDir("desc");
    }

    // Pagination clamp for list mode.
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const visibleColDefs = report.columns.filter(c => visibleCols.has(c.key));
    const isPivot = period !== "none" && !!pivot;

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* ── Header — X close · title. NO border-bottom. ────────── */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(backHref)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">{report.title}</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
                {/* Top row — summary (left) · toolbar (right).
                    `ml-auto` on the toolbar keeps it fit-content but
                    pushes it to the right edge of its row, whether on
                    the same row as the summary or on its own wrapped
                    row. Does NOT stretch to fill the row width. */}
                <div className="flex items-end justify-between gap-6 py-4 flex-wrap">
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] leading-[20px] text-[var(--colors-text-quaternary)]">Total</p>
                        <p className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">{summaryText}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
                        {/* Period — no label prefix; just the selected value */}
                        {report.type === "lookback" && report.periods.length > 1 && (
                            <SingleSelectDropdown
                                icon={CalendarPlus01}
                                label=""
                                caption="Group by period"
                                active={period !== "none"}
                                options={report.periods.map(p => ({ value: p, label: PERIOD_LABEL[p] }))}
                                value={period}
                                onChange={v => { setPeriod(v as PeriodKey); setPage(1); }}
                            />
                        )}

                        {/* Break down — no label prefix; just the selected value */}
                        {report.dimensions.length > 0 && (
                            <SingleSelectDropdown
                                icon={Grid01}
                                label=""
                                caption="Break down by"
                                active={dimIdx >= 0}
                                options={[
                                    { value: "-1", label: "None" },
                                    ...report.dimensions.map((d, i) => ({ value: String(i), label: d.label })),
                                ]}
                                value={String(dimIdx)}
                                onChange={v => setDimIdx(Number(v))}
                            />
                        )}

                        {/* Column — flat mode only */}
                        {!isPivot && (
                            <CheckListDropdown
                                icon={Columns01}
                                label="Column"
                                caption="Columns"
                                options={report.columns.map(c => ({ value: c.key, label: c.label }))}
                                value={visibleCols}
                                onToggle={toggleCol}
                            />
                        )}

                        {/* Location — only when > 1 branch scope */}
                        {branches.length > 1 && (
                            <CheckListDropdown
                                icon={MarkerPin01}
                                label="Location"
                                caption="Locations"
                                options={branches.map(b => ({ value: b.id, label: b.name }))}
                                value={visibleBranchIds}
                                onToggle={toggleBranch}
                            />
                        )}

                        <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

                        {toolbarRight}

                        {/* Export — green primary */}
                        <ExportInlineDropdown onCsv={() => handleExportCsv()} onExcel={() => handleExportXlsx()} />
                    </div>
                </div>

                {/* Body — pivot OR list. */}
                {isPivot ? (
                    <PivotTable
                        pivot={pivot!}
                        period={period}
                        rowHeader={(dimension?.label ?? "Total")}
                        measureKind={measure?.kind ?? "currency"}
                    />
                ) : (
                    <ListTable
                        rows={pageRows}
                        totalRowSource={sortedRows}
                        columns={visibleColDefs}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                    />
                )}

                {/* Pagination — list mode only (pivot mode shows every group). */}
                {!isPivot && sortedRows.length > 0 && (
                    <Pagination
                        page={clampedPage}
                        total={sortedRows.length}
                        pageSize={pageSize}
                        onPage={setPage}
                        onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                )}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Single-select dropdown  (Period · Break down · Measure)
// ═════════════════════════════════════════════════════════════════════════

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

export function SingleSelectDropdown({
    icon: Icon, label, caption, options, value, onChange, active,
}: {
    icon: IconCmp;
    label: string;
    /** Small uppercase caption shown at the top of the popover — describes
     *  what the dropdown controls (e.g. "GROUP BY PERIOD"). */
    caption?: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (next: string) => void;
    active: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const currentLabel = options.find(o => o.value === value)?.label ?? "—";

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className={cn(
                    "h-[40px] bg-white rounded-[8px] px-3.5 flex items-center gap-2 text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    active ? "border-2 border-[var(--colors-secondary-500)]" : "border-1 border-[var(--colors-border-primary)]",
                )}>
                <Icon className={cn("w-4 h-4", active ? "text-[var(--colors-secondary-600)]" : "text-[var(--colors-text-quaternary)]")} />
                {label && <span>{label}:</span>}
                <span className="text-[#182230]">{currentLabel}</span>
                <ChevronDown className={cn("w-4 h-4 text-[var(--colors-text-quaternary)] transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[200px] max-h-[360px] overflow-y-auto">
                    {caption && (
                        <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--colors-fg-quaternary)] leading-4">{caption}</p>
                    )}
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={cn(
                                "w-full text-left px-3.5 py-[10px] text-[14px] font-medium transition-colors flex items-center justify-between",
                                opt.value === value
                                    ? "bg-[var(--colors-bg-secondary)] text-[#182230]"
                                    : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                            )}>
                            <span>{opt.label}</span>
                            {opt.value === value && <Check className="w-4 h-4 text-[var(--colors-secondary-600)]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Multi-select checkbox dropdown  (Select column · Select location)
// ═════════════════════════════════════════════════════════════════════════

function CheckListDropdown({
    icon: Icon, label, caption, options, value, onToggle,
}: {
    icon: IconCmp;
    label: string;
    /** Small uppercase caption shown at the top of the popover — describes
     *  what the dropdown controls (e.g. "COLUMNS"). */
    caption?: string;
    options: { value: string; label: string }[];
    value: Set<string>;
    onToggle: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className={cn(
                    "h-[40px] bg-white border-1 border-[var(--colors-border-primary)] rounded-[8px] px-3.5 flex items-center gap-2 text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                )}>
                <Icon className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
                <span>{label}</span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-[20px] px-1.5 rounded-full bg-[var(--colors-bg-tertiary)] border-1 border-[var(--colors-border-secondary)] text-[12px] font-medium text-[var(--colors-text-secondary)]">
                    {value.size}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-[var(--colors-text-quaternary)] transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[240px] max-h-[400px] overflow-y-auto">
                    {caption && (
                        <p className="px-3.5 pt-2 pb-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--colors-fg-quaternary)] leading-4">{caption}</p>
                    )}
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => onToggle(opt.value)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--colors-bg-secondary)] transition-colors">
                            <span className={cn(
                                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                                value.has(opt.value) ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)]" : "bg-white border-[var(--colors-border-primary)]",
                            )}>
                                {value.has(opt.value) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </span>
                            <span className="text-[14px] font-medium text-[var(--colors-text-secondary)] leading-[20px] flex-1 text-left">{opt.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Export dropdown (green primary — matches existing ExportDropdown chrome)
// ═════════════════════════════════════════════════════════════════════════

// Export picker — CSV · Excel · PDF, identical to the shared ToolbarExport used
// across every other module (same order, same "soon" disabled PDF). Reports keep
// their own richer exporter (number formats + metadata sheet + pivot) under the
// hood, so this is a UI match, not a swap to the generic exporter.
function ExportInlineDropdown({ onCsv, onExcel }: { onCsv: () => void; onExcel: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const FORMATS: { label: string; enabled: boolean; run?: () => void }[] = [
        { label: "CSV", enabled: true, run: onCsv },
        { label: "Excel", enabled: true, run: onExcel },
        { label: "PDF", enabled: false },
    ];
    return (
        <div ref={ref} className="relative">
            {/* Icon-only trigger — matches ToolbarExport used across the other
                modules (Download01 + hover tooltip), not a green text button. */}
            <IconTooltip label="Export" disabled={open}>
                <Button variant="secondary-gray" size="icon" aria-label="Export"
                    onClick={() => setOpen(p => !p)}>
                    <Download01 className="w-4 h-4" />
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    {FORMATS.map(f => (
                        <button
                            key={f.label}
                            type="button"
                            disabled={!f.enabled}
                            onClick={() => { if (f.enabled) { f.run?.(); setOpen(false); } }}
                            className={cn(
                                "w-full text-left px-4 py-[10px] text-[14px] font-medium transition-colors flex items-center justify-between",
                                f.enabled
                                    ? "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]"
                                    : "text-[var(--colors-text-quaternary)] cursor-not-allowed",
                            )}
                        >
                            <span>{f.label}</span>
                            {!f.enabled && <span className="text-[12px] text-[var(--colors-text-quaternary)]">soon</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// List table  (Period === None)  — mirrors ReportShell exactly
// ═════════════════════════════════════════════════════════════════════════

function ListTable({
    rows, totalRowSource, columns, sortKey, sortDir, onToggleSort,
}: {
    rows: readonly Record<string, unknown>[];
    /** All filtered rows (unpaged) — used for the Total row so it stays
     *  correct as the user pages through. */
    totalRowSource: readonly Record<string, unknown>[];
    columns: ColumnDef[];
    sortKey: string | null;
    sortDir: "asc" | "desc";
    onToggleSort: (key: string) => void;
}) {
    if (totalRowSource.length === 0) {
        return (
            <div className="relative flex-1 min-h-[400px]">
                <EmptyState title="No records found" subtitle="Adjust the filters above to see results." />
            </div>
        );
    }
    if (columns.length === 0) {
        return (
            <div className="relative flex-1 min-h-[400px]">
                <EmptyState title="No columns selected" subtitle="Pick at least one column from the Select column dropdown." />
            </div>
        );
    }

    function sumFor(col: ColumnDef): number | null {
        if (col.kind !== "currency" && col.kind !== "number") return null;
        let s = 0, count = 0;
        for (const r of totalRowSource) { const n = Number(r[col.key]); if (Number.isFinite(n)) { s += n; count += 1; } }
        // "avg" columns (e.g. Days frozen) show the mean — a sum would be
        // meaningless. Everything else sums.
        if (col.totalMode === "avg") return count > 0 ? s / count : null;
        return s;
    }

    return (
        <div className="flex flex-col min-h-[600px]">
            <div className="flex-1 min-h-0 overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: columns.reduce((s, c) => s + (c.minWidth ?? 140), 0) }}>
                    <thead>
                        <tr className="border-b border-[var(--colors-border-secondary)]">
                            {columns.map(col => (
                                <th key={col.key}
                                    style={{ minWidth: col.minWidth ?? 140 }}
                                    className={cn(
                                        "px-6 py-3 text-[12px] font-medium text-[var(--colors-text-tertiary)] leading-[18px] whitespace-nowrap",
                                        col.kind === "currency" || col.kind === "number" || col.kind === "percent" ? "text-right" : "text-left",
                                    )}>
                                    <SortIconButton
                                        label={col.label}
                                        active={sortKey === col.key}
                                        dir={sortDir}
                                        align={col.kind === "currency" || col.kind === "number" || col.kind === "percent" ? "right" : "left"}
                                        onClick={() => onToggleSort(col.key)}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, ri) => (
                            <tr key={ri} className="border-b border-[var(--colors-border-secondary)] last:border-b-0 hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                {columns.map(c => (
                                    <td key={c.key}
                                        style={{ minWidth: c.minWidth ?? 140 }}
                                        className={cn(
                                            "px-6 py-4 text-[14px] leading-[20px] whitespace-nowrap",
                                            isNegMoney(r[c.key], c.kind) ? "text-[#d92d20]" : "text-[var(--colors-text-tertiary)]",
                                            c.kind === "currency" || c.kind === "number" || c.kind === "percent" ? "text-right tabular-nums" : "text-left",
                                        )}>
                                        {formatCell(r[c.key], c.kind)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {/* Total row (based on the ENTIRE filtered set, not just the page). */}
                        <tr>
                            {columns.map((c, i) => {
                                const total = sumFor(c);
                                return (
                                    <td key={c.key}
                                        className={cn(
                                            "px-6 py-4 text-[14px] font-semibold whitespace-nowrap",
                                            isNegMoney(total, c.kind) ? "text-[#d92d20]" : "text-[var(--colors-text-primary)]",
                                            c.kind === "currency" || c.kind === "number" || c.kind === "percent" ? "text-right tabular-nums" : "text-left",
                                        )}>
                                        {i === 0 && total === null ? "Total" : total === null ? "" : formatCell(total, c.kind)}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SortIconButton({ label, active, dir, align, onClick }: {
    label: string; active: boolean; dir: "asc" | "desc"; align: "left" | "right"; onClick: () => void;
}) {
    const Icon = !active ? ChevronSelectorVertical : dir === "asc" ? ArrowUp : ArrowDown;
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1 hover:text-[var(--colors-text-primary)] transition-colors select-none",
                align === "right" && "flex-row-reverse",
            )}>
            <span>{label}</span>
            <Icon className={cn("w-3.5 h-3.5 shrink-0", active ? "text-[var(--colors-text-tertiary)]" : "text-[var(--colors-fg-quaternary)]")} />
        </button>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Pivot table  (Period !== None)
// ═════════════════════════════════════════════════════════════════════════
//
// Matches the client's mockup:
//   Header row  : [rowHeader] · [period cols] · Total
//   Data rows   : rowKey values → per-column totals + row total
//   Column-totals row at the bottom (bold, no fill)
//   Period-change row underneath (▲ green / ▼ red / — muted)

function PivotTable({
    pivot, period, rowHeader, measureKind,
}: {
    pivot: NonNullable<ReturnType<typeof pivotRows>>;
    period: PeriodKey;
    rowHeader: string;
    measureKind: "currency" | "number" | "percent";
}) {
    if (pivot.colKeys.length === 0 || pivot.rowKeys.length === 0) {
        return (
            <div className="relative flex-1 min-h-[400px]">
                <EmptyState title="No data to pivot" subtitle="Adjust the date range, break-down, or measure to see data." />
            </div>
        );
    }

    function fmt(n: number): string {
        if (n === 0) return "—";
        if (measureKind === "currency") return fmtCurrency(n);
        if (measureKind === "percent")  return `${n.toFixed(1)}%`;
        return NUMBER_FMT.format(Math.round(n));
    }
    function fmtTotal(n: number): string {
        if (measureKind === "currency") return fmtCurrency(n);
        if (measureKind === "percent")  return `${n.toFixed(1)}%`;
        return NUMBER_FMT.format(Math.round(n));
    }
    function fmtDelta(d: number | null): { text: string; cls: string } {
        if (d === null) return { text: "—", cls: "text-[var(--colors-fg-quaternary)]" };
        const abs = Math.abs(d).toFixed(0);
        if (d > 0) return { text: `▲ ${abs}%`, cls: "text-[#164e52] font-semibold" };
        if (d < 0) return { text: `▼ ${abs}%`, cls: "text-[#d92d20] font-semibold" };
        return { text: "0%", cls: "text-[var(--colors-text-tertiary)]" };
    }

    return (
        <div className="flex flex-col min-h-[600px]">
            <div className="flex-1 min-h-0 overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--colors-border-secondary)]">
                            <th className="px-6 py-3 text-left text-[12px] font-medium text-[var(--colors-text-tertiary)] leading-[18px] whitespace-nowrap"
                                style={{ minWidth: 200 }}>
                                {rowHeader}
                            </th>
                            {pivot.colKeys.map(ck => (
                                <th key={ck}
                                    className="px-6 py-3 text-right text-[12px] font-medium text-[var(--colors-text-tertiary)] leading-[18px] whitespace-nowrap"
                                    style={{ minWidth: 130 }}>
                                    {periodLabelFor(ck, period, period === "month")}
                                </th>
                            ))}
                            <th className="px-6 py-3 text-right text-[12px] font-medium text-[var(--colors-text-tertiary)] leading-[18px] whitespace-nowrap"
                                style={{ minWidth: 140 }}>
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {pivot.rowKeys.map(rk => (
                            <tr key={rk} className="border-b border-[var(--colors-border-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                <td className="px-6 py-4 text-[14px] text-[var(--colors-text-secondary)] font-medium whitespace-nowrap">
                                    {rk}
                                </td>
                                {pivot.colKeys.map(ck => {
                                    const v = pivot.matrix[rk]?.[ck] ?? 0;
                                    return (
                                        <td key={ck}
                                            className={cn(
                                                "px-6 py-4 text-[14px] text-right tabular-nums whitespace-nowrap",
                                                measureKind === "currency" && v < 0 ? "text-[#d92d20]" : "text-[var(--colors-text-tertiary)]",
                                            )}>
                                            {fmt(v)}
                                        </td>
                                    );
                                })}
                                <td className={cn(
                                    "px-6 py-4 text-[14px] text-right tabular-nums font-semibold whitespace-nowrap",
                                    measureKind === "currency" && (pivot.rowTotals[rk] ?? 0) < 0 ? "text-[#d92d20]" : "text-[var(--colors-text-primary)]",
                                )}>
                                    {fmtTotal(pivot.rowTotals[rk] ?? 0)}
                                </td>
                            </tr>
                        ))}
                        {/* Column totals row */}
                        <tr>
                            <td className="px-6 py-4 text-[14px] font-semibold text-[var(--colors-text-primary)]">Total</td>
                            {pivot.colKeys.map(ck => {
                                const v = pivot.colTotals[ck] ?? 0;
                                return (
                                    <td key={ck}
                                        className={cn(
                                            "px-6 py-4 text-[14px] font-semibold text-right tabular-nums whitespace-nowrap",
                                            measureKind === "currency" && v < 0 ? "text-[#d92d20]" : "text-[var(--colors-text-primary)]",
                                        )}>
                                        {fmtTotal(v)}
                                    </td>
                                );
                            })}
                            <td className={cn(
                                "px-6 py-4 text-[14px] font-bold text-right tabular-nums whitespace-nowrap",
                                measureKind === "currency" && pivot.grandTotal < 0 ? "text-[#d92d20]" : "text-[var(--colors-text-primary)]",
                            )}>
                                {fmtTotal(pivot.grandTotal)}
                            </td>
                        </tr>
                        {/* Period-change delta row */}
                        <tr>
                            <td className="px-6 py-3 text-[13px] text-[var(--colors-text-tertiary)]">
                                {period === "none" ? "vs previous period" : `vs previous ${period}`}
                            </td>
                            {pivot.columnDeltasPct.map((d, i) => {
                                const { text, cls } = fmtDelta(d);
                                return (
                                    <td key={i} className={cn("px-6 py-3 text-[13px] text-right tabular-nums whitespace-nowrap", cls)}>
                                        {text}
                                    </td>
                                );
                            })}
                            <td className="px-6 py-3"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
