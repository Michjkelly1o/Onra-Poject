"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · shared presentation shell
// ─────────────────────────────────────────────────────────────────────────────
//
// ONE shell for all 32 reports. Reads a ReportDefinition + a pre-fetched
// row array, and renders either:
//
//   • List mode (Period === "none") — flat table, one row per data row,
//     Total row at the bottom for numeric columns. Optional group-by
//     dimension inserts group headers.
//
//   • Pivot mode (Period !== "none") — matrix, dimension down the side,
//     period across the top, row/column totals + a "Period change (%)"
//     delta row underneath.
//
// Toolbar (matches the client's HTML mockup + Excel spec + admin DS):
//   • Period pill    — None · Day · Week · Month · Quarter · Year
//   • Break-down     — pill list of report's dimensions ("None" first)
//   • Measure        — pill list of report's measures (only if >1)
//   • Select column  — dropdown checklist; persisted per-report to
//                      localStorage under `onra-reports:{id}:cols`
//   • Location       — branch multi-select (Owner sees all; Branch
//                      Admin+ scoped upstream)
//   • Date range     — the shared DateRangeFilter chrome; a label
//                      resolver derives ISO from/to from quick options
//   • Export dropdown — CSV | Excel (SheetJS)
//
// This component is purely presentational — the parent page owns the raw
// row array (from the resolved selector) + branch scope + date range,
// and passes them in. Filtering by branch + date range happens here so
// the toolbar wires straight into the visible surface.
//
// See new-prd/reports-implementation-plan.md §2.5 for the design.

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    ChevronDown,
    Download01,
    Rows01,
} from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/FilterPill";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import {
    DateRangeFilter,
    type DateFilter,
} from "@/components/ui/date-range-filter";
import { cn } from "@/lib/utils";
import { pivotRows, periodLabelFor } from "@/lib/reports/pivot";
import {
    buildListCsv,
    buildPivotCsv,
    triggerCsvDownload,
} from "@/lib/reports/export-csv";
import {
    exportListXlsx,
    exportPivotXlsx,
    type ExportMetadata,
} from "@/lib/reports/export-excel";
import type {
    ColumnDef,
    PeriodKey,
    ReportDefinition,
} from "@/lib/reports/types";

// ─── Props ────────────────────────────────────────────────────────────────

export interface BranchOption {
    id: string;
    name: string;
}

export interface PivotableReportShellProps {
    /** Registry entry driving the layout. */
    report: ReportDefinition;
    /** All rows produced by the resolved selector — the shell does the
     *  branch + date filter itself so the toolbar wires straight into
     *  what the user sees. */
    rows: readonly Record<string, unknown>[];
    /** Branches the current user can scope to (Owner sees all). */
    branches: readonly BranchOption[];
    /** Field on each row that holds the branch id. Defaults to "branchId". */
    branchField?: string;
    /** Back destination — usually "/admin/reports". */
    backHref?: string;
    /** Optional right-side toolbar slot (rare — most reports don't need it). */
    toolbarRight?: React.ReactNode;
}

// ─── Period → PeriodKey conversion for the pill row ────────────────────────

const PERIOD_LABEL: Record<PeriodKey, string> = {
    none:    "None",
    day:     "Day",
    week:    "Week",
    month:   "Month",
    quarter: "Quarter",
    year:    "Year",
};

// ─── Date-filter resolver — turns a DateFilter into a concrete ISO range ───
//
// Uses today's date locally. The label "This month" always resolves to
// the current calendar month, "Last 30 days" to today - 29 → today, etc.
// The resolver produces inclusive `[fromISO, toISO]` strings; downstream
// filtering uses `row.periodField >= fromISO && row.periodField <= toISO`.

interface DateRangeISO {
    fromISO: string; // "YYYY-MM-DD"
    toISO: string;   // "YYYY-MM-DD" inclusive
    label: string;
}

function iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
}

/** Resolve a DateFilter (from the DateRangeFilter chrome) into an ISO
 *  range. Handles every quick option the chrome exposes + custom range. */
function resolveDateFilter(f: DateFilter | undefined): DateRangeISO {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!f) {
        // Sensible default: current calendar month.
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { fromISO: iso(first), toISO: iso(last), label: "This month" };
    }

    if (f.type === "custom") {
        return { fromISO: iso(f.from), toISO: iso(f.to), label: f.label };
    }

    const L = f.label;

    // Day-type quick options.
    if (L === "Today")                return { fromISO: iso(today),               toISO: iso(today),               label: L };
    if (L === "Yesterday")            { const y = addDays(today, -1);          return { fromISO: iso(y),        toISO: iso(y),        label: L }; }
    if (L === "Last 7 days")          return { fromISO: iso(addDays(today, -6)),  toISO: iso(today),               label: L };
    if (L === "Last 30 days")         return { fromISO: iso(addDays(today, -29)), toISO: iso(today),               label: L };
    if (L === "Last 90 days")         return { fromISO: iso(addDays(today, -89)), toISO: iso(today),               label: L };

    // Week (ISO — Monday-anchored).
    const dow = (today.getDay() + 6) % 7; // 0 = Mon
    const monThis = addDays(today, -dow);
    if (L === "This week")            return { fromISO: iso(monThis),           toISO: iso(addDays(monThis, 6)), label: L };
    if (L === "Last week")            return { fromISO: iso(addDays(monThis, -7)), toISO: iso(addDays(monThis, -1)), label: L };

    // Month.
    const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastThisMonth  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    if (L === "This month")           return { fromISO: iso(firstThisMonth), toISO: iso(lastThisMonth), label: L };
    if (L === "Month to date")        return { fromISO: iso(firstThisMonth), toISO: iso(today),        label: L };
    if (L === "Last month") {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last  = new Date(today.getFullYear(), today.getMonth(),     0);
        return { fromISO: iso(first), toISO: iso(last), label: L };
    }
    if (L === "Last 12 months") {
        const from = new Date(today.getFullYear() - 1, today.getMonth() + 1, 1);
        return { fromISO: iso(from), toISO: iso(today), label: L };
    }

    // Year.
    const firstThisYear = new Date(today.getFullYear(), 0, 1);
    const lastThisYear  = new Date(today.getFullYear(), 11, 31);
    if (L === "This year")            return { fromISO: iso(firstThisYear), toISO: iso(lastThisYear), label: L };
    if (L === "Year to date")         return { fromISO: iso(firstThisYear), toISO: iso(today),        label: L };
    if (L === "Last year") {
        const first = new Date(today.getFullYear() - 1, 0, 1);
        const last  = new Date(today.getFullYear() - 1, 11, 31);
        return { fromISO: iso(first), toISO: iso(last), label: L };
    }

    // Fallback — should never hit if the chrome only emits its documented options.
    return { fromISO: iso(firstThisMonth), toISO: iso(lastThisMonth), label: L || "This month" };
}

// ─── Column-visibility persistence ────────────────────────────────────────

const COL_STORAGE_PREFIX = "onra-reports";

function loadColVisibility(reportId: string, columns: readonly ColumnDef[]): Set<string> {
    if (typeof window === "undefined") {
        return new Set(columns.filter(c => !c.hiddenByDefault).map(c => c.key));
    }
    try {
        const raw = window.localStorage.getItem(`${COL_STORAGE_PREFIX}:${reportId}:cols`);
        if (raw) {
            const parsed = JSON.parse(raw) as string[];
            // Guard: only keep keys that still exist on the report def.
            const allowed = new Set(columns.map(c => c.key));
            const visible = new Set(parsed.filter(k => allowed.has(k)));
            if (visible.size > 0) return visible;
        }
    } catch { /* fall through to default */ }
    return new Set(columns.filter(c => !c.hiddenByDefault).map(c => c.key));
}

function saveColVisibility(reportId: string, visible: Set<string>): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(
            `${COL_STORAGE_PREFIX}:${reportId}:cols`,
            JSON.stringify(Array.from(visible)),
        );
    } catch { /* quota — silently ignore */ }
}

// ─── Cell formatter (list mode) ───────────────────────────────────────────

const CURRENCY_FMT = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
const NUMBER_FMT   = new Intl.NumberFormat("en-US");

function formatCell(value: unknown, kind: ColumnDef["kind"]): string {
    if (value === null || value === undefined || value === "") return "—";
    if (kind === "currency") {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value);
        return `AED ${CURRENCY_FMT.format(Math.round(n))}`;
    }
    if (kind === "number") {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value);
        return NUMBER_FMT.format(Math.round(n));
    }
    if (kind === "percent") {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value);
        return `${n.toFixed(1)}%`;
    }
    if (kind === "date") {
        const s = String(value).slice(0, 10);
        return s || "—";
    }
    return String(value);
}

// ─── The shell ────────────────────────────────────────────────────────────

export function PivotableReportShell({
    report,
    rows: allRows,
    branches,
    branchField = "branchId",
    backHref = "/admin/reports",
    toolbarRight,
}: PivotableReportShellProps) {
    // ─ Toolbar state ─────────────────────────────────────────────────────
    const defaultPeriod: PeriodKey =
        report.periods.includes("month") ? "month" :
        report.periods.includes("none")  ? "none"  :
        report.periods[0] ?? "none";

    const [period, setPeriod] = useState<PeriodKey>(defaultPeriod);
    const [dimIdx, setDimIdx] = useState<number>(-1); // -1 = None
    const [meaIdx, setMeaIdx] = useState<number>(0);
    const [dateFilter, setDateFilter] = useState<DateFilter | undefined>(undefined);
    const [visibleBranchIds, setVisibleBranchIds] = useState<Set<string>>(
        () => new Set(branches.map(b => b.id)),
    );
    const [visibleCols, setVisibleCols] = useState<Set<string>>(
        () => loadColVisibility(report.id, report.columns),
    );

    useEffect(() => {
        saveColVisibility(report.id, visibleCols);
    }, [report.id, visibleCols]);

    // ─ Filter rows: branch + date range ─────────────────────────────────
    const dateISO = useMemo(() => resolveDateFilter(dateFilter), [dateFilter]);
    const periodField = report.periodField ?? "createdAtISO";
    const dimension = dimIdx >= 0 ? report.dimensions[dimIdx] ?? null : null;
    const measure = report.measures[meaIdx] ?? report.measures[0];

    const filteredRows = useMemo(() => {
        const { fromISO, toISO } = dateISO;
        return allRows.filter(r => {
            // Branch scope
            const b = String(r[branchField] ?? "");
            if (b && visibleBranchIds.size > 0 && !visibleBranchIds.has(b)) return false;
            // Date scope
            const d = String(r[periodField] ?? "").slice(0, 10);
            if (!d) return true; // rows without a period date pass through
            if (d < fromISO) return false;
            if (d > toISO)   return false;
            return true;
        });
    }, [allRows, branchField, visibleBranchIds, dateISO, periodField]);

    // ─ Pivot result — computed only in pivot mode ───────────────────────
    const pivot = useMemo(() => {
        if (period === "none" || !measure) return null;
        return pivotRows(filteredRows, {
            periodField,
            period,
            dimension,
            measure,
        });
    }, [filteredRows, period, periodField, dimension, measure]);

    // ─ Export ────────────────────────────────────────────────────────────
    const [exportOpen, setExportOpen] = useState(false);
    const exportTriggerRef = useRef<HTMLButtonElement>(null);

    function buildFilename(ext: "csv" | "xlsx"): string {
        return `${report.id}_${dateISO.fromISO}_${dateISO.toISO}.${ext}`;
    }

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
            exportedAtISO: new Date().toISOString(),
            rowCount:    period === "none" ? filteredRows.length : (pivot?.rowKeys.length ?? 0),
        };
    }

    function handleExportCsv() {
        const cols = report.columns.filter(c => visibleCols.has(c.key));
        if (period === "none" || !pivot) {
            const csv = buildListCsv({ columns: cols, rows: filteredRows, filename: buildFilename("csv") });
            triggerCsvDownload(csv, buildFilename("csv"));
        } else {
            const colHeaders = pivot.colKeys.map(k => periodLabelFor(k, period, period === "month"));
            const csv = buildPivotCsv({
                rowHeader: dimension?.label ?? "All",
                colHeaders,
                pivot,
                filename: buildFilename("csv"),
            });
            triggerCsvDownload(csv, buildFilename("csv"));
        }
        setExportOpen(false);
    }

    function handleExportXlsx() {
        const cols = report.columns.filter(c => visibleCols.has(c.key));
        const meta = buildMetadata();
        if (period === "none" || !pivot) {
            exportListXlsx({
                columns: cols,
                rows:    filteredRows,
                filename: buildFilename("xlsx"),
                meta,
                sheetName: report.title,
            });
        } else {
            const colHeaders = pivot.colKeys.map(k => periodLabelFor(k, period, period === "month"));
            exportPivotXlsx({
                rowHeader: dimension?.label ?? "All",
                colHeaders,
                pivot,
                filename: buildFilename("xlsx"),
                meta,
                sheetName: report.title,
                valueKind: measure?.kind === "number" ? "number" : "currency",
            });
        }
        setExportOpen(false);
    }

    // ─ Select-column dropdown ────────────────────────────────────────────
    const [colsOpen, setColsOpen] = useState(false);
    const colsTriggerRef = useRef<HTMLButtonElement>(null);

    function toggleCol(key: string) {
        setVisibleCols(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            // Never allow zero visible cols — user always sees at least one.
            if (next.size === 0) next.add(key);
            return next;
        });
    }

    // ─ Location dropdown ────────────────────────────────────────────────
    const [locOpen, setLocOpen] = useState(false);
    const locTriggerRef = useRef<HTMLButtonElement>(null);

    function toggleBranch(id: string) {
        setVisibleBranchIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            if (next.size === 0) next.add(id);
            return next;
        });
    }
    const locLabel = visibleBranchIds.size === branches.length
        ? "All locations"
        : visibleBranchIds.size === 1
            ? branches.find(b => visibleBranchIds.has(b.id))?.name ?? "1 location"
            : `${visibleBranchIds.size} locations`;

    // ─ Render ────────────────────────────────────────────────────────────
    const visibleColDefs = report.columns.filter(c => visibleCols.has(c.key));

    return (
        <div className="flex flex-col gap-[24px] pt-[24px] pb-[48px]">
            {/* ─── Page header ────────────────────────────────────────── */}
            <div className="px-[24px] flex items-start justify-between gap-4">
                <div className="flex flex-col gap-[8px] min-w-0">
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#475467] hover:text-[#182230] transition-colors w-fit"
                    >
                        <ArrowLeft className="w-[16px] h-[16px]" />
                        Back to reports
                    </Link>
                    <div className="flex flex-col gap-[4px]">
                        <h1 className="text-[24px] font-semibold text-[#101828] leading-tight">
                            {report.title}
                        </h1>
                        <p className="text-[14px] text-[#475467] max-w-[720px]">
                            {report.description}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-[8px] shrink-0">
                    {toolbarRight}
                </div>
            </div>

            {/* ─── Toolbar ────────────────────────────────────────────── */}
            <div className="px-[24px] flex flex-col gap-[12px]">
                {/* Row 1 — pills (Period · Break-down · Measure) */}
                <div className="flex flex-wrap items-center gap-[16px]">
                    {/* Period pills — only shown for lookback reports */}
                    {report.type === "lookback" && report.periods.length > 1 && (
                        <div className="flex items-center gap-[8px]">
                            <span className="text-[13px] font-medium text-[#475467]">Period</span>
                            <div className="flex flex-wrap gap-[6px]">
                                {report.periods.map(p => (
                                    <FilterPill
                                        key={p}
                                        label={PERIOD_LABEL[p]}
                                        selected={period === p}
                                        onClick={() => setPeriod(p)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Break-down pills */}
                    {report.dimensions.length > 0 && (
                        <div className="flex items-center gap-[8px]">
                            <span className="text-[13px] font-medium text-[#475467]">Break-down</span>
                            <div className="flex flex-wrap gap-[6px]">
                                <FilterPill label="None" selected={dimIdx === -1} onClick={() => setDimIdx(-1)} />
                                {report.dimensions.map((d, i) => (
                                    <FilterPill
                                        key={d.key}
                                        label={d.label}
                                        selected={dimIdx === i}
                                        onClick={() => setDimIdx(i)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Measure pills — only shown when > 1 measure */}
                    {report.measures.length > 1 && (
                        <div className="flex items-center gap-[8px]">
                            <span className="text-[13px] font-medium text-[#475467]">Measure</span>
                            <div className="flex flex-wrap gap-[6px]">
                                {report.measures.map((m, i) => (
                                    <FilterPill
                                        key={m.key}
                                        label={m.label}
                                        selected={meaIdx === i}
                                        onClick={() => setMeaIdx(i)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Row 2 — right-side action buttons + date range */}
                <div className="flex flex-wrap items-center justify-end gap-[8px]">
                    {/* Select column */}
                    <Button
                        ref={colsTriggerRef}
                        variant="secondary-gray"
                        size="md"
                        leftIcon={<Rows01 className="w-4 h-4" />}
                        rightIcon={<ChevronDown className="w-4 h-4" />}
                        onClick={() => setColsOpen(o => !o)}
                    >
                        Columns ({visibleCols.size}/{report.columns.length})
                    </Button>
                    <FixedDropdown
                        triggerRef={colsTriggerRef}
                        open={colsOpen}
                        onClose={() => setColsOpen(false)}
                        minWidth={260}
                    >
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-[8px] max-h-[420px] overflow-y-auto">
                            {report.columns.map(c => (
                                <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => toggleCol(c.key)}
                                    className="w-full flex items-center gap-[10px] px-[14px] py-[8px] text-left hover:bg-[#f9fafb] transition-colors"
                                >
                                    <span className={cn(
                                        "w-[16px] h-[16px] rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                                        visibleCols.has(c.key) ? "bg-[#658774] border-[#658774]" : "border-[#d0d5dd] bg-white",
                                    )}>
                                        {visibleCols.has(c.key) && (
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                <path d="M1.5 5.5 4 8L8.5 2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </span>
                                    <span className="text-[13.5px] text-[#344054] flex-1 truncate">{c.label}</span>
                                </button>
                            ))}
                        </div>
                    </FixedDropdown>

                    {/* Location filter — only when > 1 branch scope */}
                    {branches.length > 1 && (
                        <>
                            <Button
                                ref={locTriggerRef}
                                variant="secondary-gray"
                                size="md"
                                rightIcon={<ChevronDown className="w-4 h-4" />}
                                onClick={() => setLocOpen(o => !o)}
                            >
                                {locLabel}
                            </Button>
                            <FixedDropdown
                                triggerRef={locTriggerRef}
                                open={locOpen}
                                onClose={() => setLocOpen(false)}
                                minWidth={220}
                            >
                                <div className="bg-white border-1 border-[#e4e7ec] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-[8px]">
                                    {branches.map(b => (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => toggleBranch(b.id)}
                                            className="w-full flex items-center gap-[10px] px-[14px] py-[8px] text-left hover:bg-[#f9fafb] transition-colors"
                                        >
                                            <span className={cn(
                                                "w-[16px] h-[16px] rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                                                visibleBranchIds.has(b.id) ? "bg-[#658774] border-[#658774]" : "border-[#d0d5dd] bg-white",
                                            )}>
                                                {visibleBranchIds.has(b.id) && (
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                        <path d="M1.5 5.5 4 8L8.5 2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </span>
                                            <span className="text-[13.5px] text-[#344054] flex-1 truncate">{b.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </FixedDropdown>
                        </>
                    )}

                    {/* Date range */}
                    <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

                    {/* Export dropdown */}
                    <Button
                        ref={exportTriggerRef}
                        variant="secondary-gray"
                        size="md"
                        leftIcon={<Download01 className="w-4 h-4" />}
                        rightIcon={<ChevronDown className="w-4 h-4" />}
                        onClick={() => setExportOpen(o => !o)}
                    >
                        Export
                    </Button>
                    <FixedDropdown
                        triggerRef={exportTriggerRef}
                        open={exportOpen}
                        onClose={() => setExportOpen(false)}
                        minWidth={180}
                    >
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-[8px]">
                            <button type="button" onClick={handleExportXlsx}
                                className="w-full text-left px-[14px] py-[8px] text-[13.5px] text-[#344054] hover:bg-[#f9fafb] transition-colors">
                                Download Excel (.xlsx)
                            </button>
                            <button type="button" onClick={handleExportCsv}
                                className="w-full text-left px-[14px] py-[8px] text-[13.5px] text-[#344054] hover:bg-[#f9fafb] transition-colors">
                                Download CSV
                            </button>
                        </div>
                    </FixedDropdown>
                </div>
            </div>

            {/* ─── Body — list or pivot ──────────────────────────────── */}
            <div className="px-[24px]">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] min-h-[760px] relative overflow-hidden">
                    {period === "none" || !pivot ? (
                        <ListMode
                            rows={filteredRows}
                            columns={visibleColDefs}
                            groupBy={dimension}
                            reportId={report.id}
                        />
                    ) : (
                        <PivotMode
                            pivot={pivot}
                            period={period}
                            rowHeader={dimension?.label ?? "Total"}
                            measureKind={measure?.kind ?? "currency"}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── ListMode ─────────────────────────────────────────────────────────────

interface ListModeProps {
    rows: readonly Record<string, unknown>[];
    columns: ColumnDef[];
    groupBy: { key: string; label: string; extract: (r: Record<string, unknown>) => string } | null;
    reportId: string;
}

function ListMode({ rows, columns, groupBy, reportId: _reportId }: ListModeProps) {
    if (rows.length === 0) {
        return <EmptyState title="No rows in the selected range" subtitle="Adjust the date range, location, or filters to see data." />;
    }
    if (columns.length === 0) {
        return <EmptyState title="No columns selected" subtitle="Pick at least one column from the Columns dropdown." />;
    }

    // Group rows if a dimension is chosen. Otherwise a single flat block.
    const groups: { key: string; rows: readonly Record<string, unknown>[] }[] = groupBy
        ? (() => {
            const buckets = new Map<string, Record<string, unknown>[]>();
            for (const r of rows) {
                const k = groupBy.extract(r) || "—";
                if (!buckets.has(k)) buckets.set(k, []);
                buckets.get(k)!.push(r);
            }
            // Sort groups by row count DESC.
            return Array.from(buckets.entries())
                .sort((a, b) => b[1].length - a[1].length)
                .map(([key, rs]) => ({ key, rows: rs }));
        })()
        : [{ key: "", rows }];

    // Compute total row for numeric columns.
    function sumFor(rs: readonly Record<string, unknown>[], col: ColumnDef): number | null {
        if (col.kind !== "currency" && col.kind !== "number") return null;
        let s = 0;
        for (const r of rs) {
            const n = Number(r[col.key]);
            if (Number.isFinite(n)) s += n;
        }
        return s;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead className="bg-[#f9fafb] border-b border-[#e4e7ec] sticky top-0 z-10">
                    <tr>
                        {columns.map(c => (
                            <th key={c.key}
                                style={{ minWidth: c.minWidth ?? (c.kind === "text" ? 180 : 120) }}
                                className={cn(
                                    "px-[16px] py-[12px] text-[12px] font-semibold uppercase tracking-wide text-[#475467]",
                                    c.kind === "currency" || c.kind === "number" || c.kind === "percent" ? "text-right" : "text-left",
                                )}>
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {groups.flatMap(g => {
                        const rows: React.ReactNode[] = [];
                        if (groupBy) {
                            rows.push(
                                <tr key={`h-${g.key}`} className="bg-[#f2f4f7]">
                                    <td colSpan={columns.length}
                                        className="px-[16px] py-[8px] text-[12.5px] font-semibold text-[#344054]">
                                        {g.key} <span className="text-[#667085] font-normal">· {g.rows.length}</span>
                                    </td>
                                </tr>,
                            );
                        }
                        g.rows.forEach((r, ri) => {
                            rows.push(
                                <tr key={`${g.key}-${ri}`} className="border-b border-[#f2f4f7] hover:bg-[#f9fafb] transition-colors">
                                    {columns.map(c => (
                                        <td key={c.key}
                                            className={cn(
                                                "px-[16px] py-[12px] text-[13.5px] text-[#344054] whitespace-nowrap",
                                                c.kind === "currency" || c.kind === "number" || c.kind === "percent" ? "text-right tabular-nums" : "text-left",
                                            )}>
                                            {formatCell(r[c.key], c.kind)}
                                        </td>
                                    ))}
                                </tr>,
                            );
                        });
                        return rows;
                    })}

                    {/* Grand-total row */}
                    <tr className="bg-[#f9fafb] border-t-2 border-[#e4e7ec]">
                        {columns.map((c, i) => {
                            const total = sumFor(rows, c);
                            return (
                                <td key={c.key}
                                    className={cn(
                                        "px-[16px] py-[12px] text-[13.5px] font-semibold text-[#101828] whitespace-nowrap",
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
    );
}

// ─── PivotMode ────────────────────────────────────────────────────────────

interface PivotModeProps {
    pivot: NonNullable<ReturnType<typeof pivotRows>>;
    period: PeriodKey;
    rowHeader: string;
    measureKind: "currency" | "number" | "percent";
}

function PivotMode({ pivot, period, rowHeader, measureKind }: PivotModeProps) {
    if (pivot.colKeys.length === 0 || pivot.rowKeys.length === 0) {
        return <EmptyState title="No data to pivot" subtitle="Adjust the date range, break-down, or measure to see data." />;
    }

    function fmt(n: number): string {
        if (measureKind === "currency") return `AED ${CURRENCY_FMT.format(Math.round(n))}`;
        if (measureKind === "percent")  return `${n.toFixed(1)}%`;
        return NUMBER_FMT.format(Math.round(n));
    }
    function fmtDelta(d: number | null): { text: string; cls: string } {
        if (d === null) return { text: "—", cls: "text-[#98a2b3]" };
        const abs = Math.abs(d).toFixed(1);
        if (d > 0) return { text: `▲ ${abs}%`, cls: "text-[#067647]" };
        if (d < 0) return { text: `▼ ${abs}%`, cls: "text-[#b42318]" };
        return { text: "0.0%", cls: "text-[#475467]" };
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead className="bg-[#f9fafb] border-b border-[#e4e7ec] sticky top-0 z-10">
                    <tr>
                        <th className="px-[16px] py-[12px] text-left text-[12px] font-semibold uppercase tracking-wide text-[#475467] sticky left-0 bg-[#f9fafb] z-20"
                            style={{ minWidth: 200 }}>
                            {rowHeader}
                        </th>
                        {pivot.colKeys.map(ck => (
                            <th key={ck}
                                className="px-[16px] py-[12px] text-right text-[12px] font-semibold uppercase tracking-wide text-[#475467]"
                                style={{ minWidth: 110 }}>
                                {periodLabelFor(ck, period, period === "month")}
                            </th>
                        ))}
                        <th className="px-[16px] py-[12px] text-right text-[12px] font-semibold uppercase tracking-wide text-[#475467]"
                            style={{ minWidth: 120 }}>
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {pivot.rowKeys.map(rk => (
                        <tr key={rk} className="border-b border-[#f2f4f7] hover:bg-[#f9fafb] transition-colors">
                            <td className="px-[16px] py-[12px] text-[13.5px] text-[#344054] sticky left-0 bg-white whitespace-nowrap font-medium">
                                {rk}
                            </td>
                            {pivot.colKeys.map(ck => (
                                <td key={ck}
                                    className="px-[16px] py-[12px] text-[13.5px] text-[#344054] text-right tabular-nums whitespace-nowrap">
                                    {fmt(pivot.matrix[rk]?.[ck] ?? 0)}
                                </td>
                            ))}
                            <td className="px-[16px] py-[12px] text-[13.5px] text-[#101828] text-right tabular-nums font-semibold whitespace-nowrap">
                                {fmt(pivot.rowTotals[rk] ?? 0)}
                            </td>
                        </tr>
                    ))}

                    {/* Column-totals row */}
                    <tr className="bg-[#f9fafb] border-t-2 border-[#e4e7ec]">
                        <td className="px-[16px] py-[12px] text-[13.5px] font-semibold text-[#101828] sticky left-0 bg-[#f9fafb]">
                            Total
                        </td>
                        {pivot.colKeys.map(ck => (
                            <td key={ck}
                                className="px-[16px] py-[12px] text-[13.5px] font-semibold text-[#101828] text-right tabular-nums whitespace-nowrap">
                                {fmt(pivot.colTotals[ck] ?? 0)}
                            </td>
                        ))}
                        <td className="px-[16px] py-[12px] text-[13.5px] font-bold text-[#101828] text-right tabular-nums whitespace-nowrap">
                            {fmt(pivot.grandTotal)}
                        </td>
                    </tr>

                    {/* Period-change delta row */}
                    <tr className="bg-white">
                        <td className="px-[16px] py-[10px] text-[12.5px] text-[#475467] sticky left-0 bg-white">
                            Period change
                        </td>
                        {pivot.columnDeltasPct.map((d, i) => {
                            const { text, cls } = fmtDelta(d);
                            return (
                                <td key={i}
                                    className={cn("px-[16px] py-[10px] text-[12.5px] text-right tabular-nums whitespace-nowrap", cls)}>
                                    {text}
                                </td>
                            );
                        })}
                        <td className="px-[16px] py-[10px]"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
