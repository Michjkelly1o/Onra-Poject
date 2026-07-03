"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · shared shell (rewrite v2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reuses the existing report chrome (X close header · summary top-right ·
// toolbar row of dropdowns · sortable table · pagination). Every button in
// the toolbar is a DROPDOWN matching the Onra DS style used by
// SelectColumnDropdown / MultiSelectFilterDropdown / DateRangeFilter.
//
// Client's two new asks (the whole point of the rewrite):
//   1. Grouping by PERIOD  — dropdown (None / Day / Week / Month / Quarter / Year).
//                            Renders a pivot table with per-period totals + a
//                            "Period change" line under the column totals row.
//   2. Grouping by TYPE    — dropdown (None + report.dimensions[]).
//                            When Period !== None, drives the row axis of the
//                            pivot. When Period === None, groups the flat list.
//
// Refund model (client rule #10 — enforced by selectors, not by this shell):
// same-day pre-settle refunds ARE voids and never appear here; later refunds
// land in THEIR OWN period as negative amounts. Past months never restate.
//
// The 16+ pages that mount this shell pass a ReportDefinition (from
// src/config/reports/*.ts) + a pre-mapped row array. This file owns the
// entire visual layer.

import * as React from "react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, ChevronDown, Check,
    CurrencyDollar, Grid01, Columns01, MarkerPin01, CalendarPlus01,
    ArrowUp, ArrowDown, ChevronSelectorVertical,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DateRangeFilter, type DateFilter } from "@/components/ui/date-range-filter";
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
    toolbarRight?: React.ReactNode;
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
//
// The DateRangeFilter emits quick-option labels ("This year", "Last 30
// days", etc); the shell resolves them into an inclusive [fromISO, toISO]
// window used for row filtering.

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
        const first = new Date(today.getFullYear(), 0, 1);
        const last  = new Date(today.getFullYear(), 11, 31);
        return { fromISO: iso(first), toISO: iso(last), label: "This year" };
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
        const from = new Date(today.getFullYear() - 1, today.getMonth() + 1, 1);
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
    return { fromISO: iso(firstThisYear), toISO: iso(lastThisYear), label: L || "This year" };
}

// ─── Column visibility persistence ────────────────────────────────────────
//
// Per-report key in localStorage so testers' visible-column choices survive
// refresh + tab close. Falls back to `!hiddenByDefault` on the report def.

const COL_STORAGE_PREFIX = "onra-reports";
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
function formatCell(value: unknown, kind: ColumnDef["kind"]): string {
    if (value === null || value === undefined || value === "") return "—";
    if (kind === "currency") { const n = Number(value); if (!Number.isFinite(n)) return String(value); return `AED ${CURRENCY_FMT.format(Math.round(n))}`; }
    if (kind === "number")   { const n = Number(value); if (!Number.isFinite(n)) return String(value); return NUMBER_FMT.format(Math.round(n)); }
    if (kind === "percent")  { const n = Number(value); if (!Number.isFinite(n)) return String(value); return `${n.toFixed(1)}%`; }
    if (kind === "date")     { const s = String(value).slice(0, 10); return s || "—"; }
    return String(value);
}

// ─────────────────────────────────────────────────────────────────────────
// The shell
// ─────────────────────────────────────────────────────────────────────────

export function PivotableReportShell({
    report, rows: allRows, branches,
    branchField = "branchId",
    backHref = "/admin/reports",
    toolbarRight,
}: PivotableReportShellProps) {
    const router = useRouter();

    // Default period + measure. Period defaults to "none" so every report
    // opens on flat list; user picks a grouping to switch to pivot.
    const defaultPeriod: PeriodKey =
        report.periods.includes("none") ? "none" : report.periods[0] ?? "none";

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
    useEffect(() => { saveColVisibility(report.id, visibleCols); }, [report.id, visibleCols]);

    // Sort state (list mode only).
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // ─ Filter rows: branch + date range ─────────────────────────────────
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

    // Sort for list mode.
    const sortedRows = useMemo(() => {
        if (period !== "none") return filteredRows;
        if (!sortKey) return filteredRows;
        const col = report.columns.find(c => c.key === sortKey);
        if (!col) return filteredRows;
        const copy = [...filteredRows];
        copy.sort((a, b) => {
            const va = a[sortKey]; const vb = b[sortKey];
            const na = Number(va); const nb = Number(vb);
            if (Number.isFinite(na) && Number.isFinite(nb)) return sortDir === "asc" ? na - nb : nb - na;
            return sortDir === "asc"
                ? String(va ?? "").localeCompare(String(vb ?? ""))
                : String(vb ?? "").localeCompare(String(va ?? ""));
        });
        return copy;
    }, [filteredRows, period, sortKey, sortDir, report.columns]);

    // ─ Pivot computation ────────────────────────────────────────────────
    const pivot = useMemo(() => {
        if (period === "none" || !measure) return null;
        return pivotRows(filteredRows, { periodField, period, dimension, measure });
    }, [filteredRows, period, periodField, dimension, measure]);

    // ─ Header summary line ──────────────────────────────────────────────
    const summaryText = useMemo(() => {
        const count = filteredRows.length;
        const parts: string[] = [];
        parts.push(`${count} record${count === 1 ? "" : "s"}`);
        parts.push(dateISO.label);
        if (period !== "none") parts.push(`by ${PERIOD_LABEL[period].toLowerCase()}`);
        return parts.join(" · ");
    }, [filteredRows.length, dateISO.label, period]);

    // ─ Export handlers ─────────────────────────────────────────────────
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
            exportedAtISO: "",   // resolved on click — see below
            rowCount:    period === "none" ? filteredRows.length : (pivot?.rowKeys.length ?? 0),
        };
    }
    function stamp(m: ExportMetadata): ExportMetadata { return { ...m, exportedAtISO: new Date().toISOString() }; }
    function handleExportCsv() {
        const cols = report.columns.filter(c => visibleCols.has(c.key));
        if (period === "none" || !pivot) {
            const csv = buildListCsv({ columns: cols, rows: filteredRows, filename: buildFilename("csv") });
            triggerCsvDownload(csv, buildFilename("csv"));
        } else {
            const colHeaders = pivot.colKeys.map(k => periodLabelFor(k, period, period === "month"));
            const csv = buildPivotCsv({
                rowHeader: dimension?.label ?? "All",
                colHeaders, pivot, filename: buildFilename("csv"),
            });
            triggerCsvDownload(csv, buildFilename("csv"));
        }
    }
    function handleExportXlsx() {
        const cols = report.columns.filter(c => visibleCols.has(c.key));
        const meta = stamp(buildMetadata());
        if (period === "none" || !pivot) {
            exportListXlsx({ columns: cols, rows: filteredRows, filename: buildFilename("xlsx"), meta, sheetName: report.title });
        } else {
            const colHeaders = pivot.colKeys.map(k => periodLabelFor(k, period, period === "month"));
            exportPivotXlsx({
                rowHeader: dimension?.label ?? "All",
                colHeaders, pivot,
                filename: buildFilename("xlsx"),
                meta,
                sheetName: report.title,
                valueKind: measure?.kind === "number" ? "number" : "currency",
            });
        }
    }

    // ─ Toggle helpers ────────────────────────────────────────────────
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

    // ─ Derived ─────────────────────────────────────────────────────────
    const visibleColDefs = report.columns.filter(c => visibleCols.has(c.key));
    const isPivot = period !== "none" && !!pivot;
    const dimensionLabel = dimension?.label ?? "None";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* ── Header (X close · title · summary right) ────────────── */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0 border-b border-[#e4e7ec]">
                <button type="button" onClick={() => router.push(backHref)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{report.title}</h1>
                <div className="ml-auto flex items-center gap-3">
                    <span className="text-[14px] leading-[20px] text-[#667085]">{summaryText}</span>
                    {toolbarRight}
                </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {/* Toolbar row */}
                <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
                    {/* Period */}
                    {report.type === "lookback" && report.periods.length > 1 && (
                        <SingleSelectDropdown
                            icon={CalendarPlus01}
                            label="Period"
                            active={period !== "none"}
                            options={report.periods.map(p => ({ value: p, label: PERIOD_LABEL[p] }))}
                            value={period}
                            onChange={v => setPeriod(v as PeriodKey)}
                        />
                    )}

                    {/* Break down by */}
                    {report.dimensions.length > 0 && (
                        <SingleSelectDropdown
                            icon={Grid01}
                            label="Break down by"
                            active={dimIdx >= 0}
                            options={[
                                { value: "-1", label: "None" },
                                ...report.dimensions.map((d, i) => ({ value: String(i), label: d.label })),
                            ]}
                            value={String(dimIdx)}
                            onChange={v => setDimIdx(Number(v))}
                        />
                    )}

                    {/* Measure */}
                    {report.measures.length > 1 && (
                        <SingleSelectDropdown
                            icon={CurrencyDollar}
                            label=""
                            active={false}
                            options={report.measures.map((m, i) => ({ value: String(i), label: m.label }))}
                            value={String(meaIdx)}
                            onChange={v => setMeaIdx(Number(v))}
                        />
                    )}

                    {/* Select column — flat mode only */}
                    {!isPivot && (
                        <CheckListDropdown
                            icon={Columns01}
                            label="Select column"
                            options={report.columns.map(c => ({ value: c.key, label: c.label }))}
                            value={visibleCols}
                            onToggle={toggleCol}
                        />
                    )}

                    {/* Select location — only when > 1 branch scope */}
                    {branches.length > 1 && (
                        <CheckListDropdown
                            icon={MarkerPin01}
                            label="Select location"
                            options={branches.map(b => ({ value: b.id, label: b.name }))}
                            value={visibleBranchIds}
                            onToggle={toggleBranch}
                        />
                    )}

                    {/* Date range */}
                    <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

                    {/* Push export to the right */}
                    <div className="ml-auto" />

                    {/* Export — green primary, matching existing ExportDropdown */}
                    <ExportInlineDropdown onExcel={handleExportXlsx} onCsv={handleExportCsv} />
                </div>

                {/* Body — pivot OR list */}
                {isPivot ? (
                    <PivotTable
                        pivot={pivot!}
                        period={period}
                        rowHeader={dimensionLabel === "None" ? "Total" : dimensionLabel}
                        measureKind={measure?.kind ?? "currency"}
                    />
                ) : (
                    <ListTable
                        rows={sortedRows}
                        columns={visibleColDefs}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                    />
                )}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Single-select dropdown (Period · Break down · Measure)
// ═════════════════════════════════════════════════════════════════════════
//
// Chrome mirrors SelectColumnDropdown / MultiSelectFilterDropdown exactly:
// h-40 trigger · white bg · #d0d5dd border · icon-left · label · chevron.
// When `active` (non-default value picked), the border swaps to the DS
// green (#7ba08c 2px) — same treatment as FilterPill selected.

type IconCmp = ComponentType<SVGProps<SVGSVGElement>>;

function SingleSelectDropdown({
    icon: Icon, label, options, value, onChange, active,
}: {
    icon: IconCmp;
    label: string;
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
                    "h-[40px] bg-white rounded-[8px] px-3.5 flex items-center gap-2 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    active ? "border-2 border-[#7ba08c]" : "border-1 border-[#d0d5dd]",
                )}>
                <Icon className={cn("w-4 h-4", active ? "text-[#658774]" : "text-[#667085]")} />
                {label && <span className={cn(active ? "text-[#182230]" : "")}>{label}:</span>}
                <span className={cn("font-semibold", active ? "text-[#182230]" : "text-[#344054]")}>{currentLabel}</span>
                <ChevronDown className={cn("w-4 h-4 text-[#667085] transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[200px] max-h-[360px] overflow-y-auto">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={cn(
                                "w-full text-left px-3.5 py-[10px] text-[14px] font-medium transition-colors flex items-center justify-between",
                                opt.value === value
                                    ? "bg-[#f9fafb] text-[#182230]"
                                    : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            <span>{opt.label}</span>
                            {opt.value === value && <Check className="w-4 h-4 text-[#658774]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Multi-select checkbox dropdown (Select column · Select location)
// ═════════════════════════════════════════════════════════════════════════
//
// Same trigger chrome as SingleSelectDropdown but with a count badge.
// Popover: Select all + checkbox list. Matches existing
// SelectColumnDropdown / MultiSelectFilterDropdown line-for-line so all
// toolbar dropdowns read as one family.

function CheckListDropdown({
    icon: Icon, label, options, value, onToggle,
}: {
    icon: IconCmp;
    label: string;
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
                    "h-[40px] bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3.5 flex items-center gap-2 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                )}>
                <Icon className="w-4 h-4 text-[#667085]" />
                <span>{label}</span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-[20px] px-1.5 rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[12px] font-medium text-[#344054]">
                    {value.size}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-[#667085] transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[240px] max-h-[400px] overflow-y-auto">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => onToggle(opt.value)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#f9fafb] transition-colors">
                            <span className={cn(
                                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                                value.has(opt.value) ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
                            )}>
                                {value.has(opt.value) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </span>
                            <span className="text-[14px] font-medium text-[#344054] leading-[20px] flex-1 text-left">{opt.label}</span>
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

function ExportInlineDropdown({ onExcel, onCsv }: { onExcel: () => void; onCsv: () => void; }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <Button variant="primary" size="md" onClick={() => setOpen(p => !p)}
                rightIcon={<ChevronDown className="w-4 h-4" />}>
                Export
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[180px]">
                    <button type="button" onClick={() => { onExcel(); setOpen(false); }}
                        className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        Excel (.xlsx)
                    </button>
                    <button type="button" onClick={() => { onCsv(); setOpen(false); }}
                        className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        CSV
                    </button>
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// List table (Period = None) — flat sortable list
// ═════════════════════════════════════════════════════════════════════════

function ListTable({
    rows, columns, sortKey, sortDir, onToggleSort,
}: {
    rows: readonly Record<string, unknown>[];
    columns: ColumnDef[];
    sortKey: string | null;
    sortDir: "asc" | "desc";
    onToggleSort: (key: string) => void;
}) {
    if (rows.length === 0) {
        return (
            <div className="relative min-h-[400px]">
                <EmptyState title="No records found" subtitle="Adjust the filters above to see results." />
            </div>
        );
    }
    if (columns.length === 0) {
        return (
            <div className="relative min-h-[400px]">
                <EmptyState title="No columns selected" subtitle="Pick at least one column from the Select column dropdown." />
            </div>
        );
    }

    function sumFor(col: ColumnDef): number | null {
        if (col.kind !== "currency" && col.kind !== "number") return null;
        let s = 0;
        for (const r of rows) { const n = Number(r[col.key]); if (Number.isFinite(n)) s += n; }
        return s;
    }

    return (
        <div className="px-6 pb-6">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: columns.reduce((s, c) => s + (c.minWidth ?? 140), 0) }}>
                    <thead>
                        <tr className="border-b border-[#e4e7ec]">
                            {columns.map(col => (
                                <th key={col.key}
                                    style={{ minWidth: col.minWidth ?? 140 }}
                                    className={cn(
                                        "px-6 py-3 text-[12px] font-medium text-[#475467] leading-[18px] whitespace-nowrap",
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
                            <tr key={ri} className="border-b border-[#e4e7ec] last:border-b-0 hover:bg-[#f9fafb] transition-colors">
                                {columns.map(c => (
                                    <td key={c.key}
                                        style={{ minWidth: c.minWidth ?? 140 }}
                                        className={cn(
                                            "px-6 py-4 text-[14px] text-[#475467] leading-[20px] whitespace-nowrap",
                                            c.kind === "currency" || c.kind === "number" || c.kind === "percent" ? "text-right tabular-nums" : "text-left",
                                        )}>
                                        {formatCell(r[c.key], c.kind)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {/* Total row */}
                        <tr className="bg-[#f9fafb] border-t border-[#e4e7ec]">
                            {columns.map((c, i) => {
                                const total = sumFor(c);
                                return (
                                    <td key={c.key}
                                        className={cn(
                                            "px-6 py-4 text-[14px] font-semibold text-[#101828] whitespace-nowrap",
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
                "inline-flex items-center gap-1 hover:text-[#101828] transition-colors select-none",
                align === "right" && "flex-row-reverse",
            )}>
            <span>{label}</span>
            <Icon className={cn("w-3.5 h-3.5 shrink-0", active ? "text-[#475467]" : "text-[#98a2b3]")} />
        </button>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Pivot table (Period != None)
// ═════════════════════════════════════════════════════════════════════════
//
// Matches the client's screenshot exactly:
//   Header row  : [rowHeader] · [period cols] · Total
//   Data rows   : rowKey values → per-column totals + row total
//   Column totals row (bold, gray bg) at the bottom
//   Period change row (▲ green / ▼ red / — muted) underneath the totals
// The pivot logic (bucket / dim / measure) is done by pivotRows() upstream.

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
            <div className="relative min-h-[400px]">
                <EmptyState title="No data to pivot" subtitle="Adjust the date range, break-down, or measure to see data." />
            </div>
        );
    }

    function fmt(n: number): string {
        if (n === 0) return "—";
        if (measureKind === "currency") return `AED ${CURRENCY_FMT.format(Math.round(n))}`;
        if (measureKind === "percent")  return `${n.toFixed(1)}%`;
        return NUMBER_FMT.format(Math.round(n));
    }
    function fmtTotal(n: number): string {
        if (measureKind === "currency") return `AED ${CURRENCY_FMT.format(Math.round(n))}`;
        if (measureKind === "percent")  return `${n.toFixed(1)}%`;
        return NUMBER_FMT.format(Math.round(n));
    }
    function fmtDelta(d: number | null): { text: string; cls: string } {
        if (d === null) return { text: "—", cls: "text-[#98a2b3]" };
        const abs = Math.abs(d).toFixed(0);
        if (d > 0) return { text: `▲ ${abs}%`, cls: "text-[#079455] font-semibold" };
        if (d < 0) return { text: `▼ ${abs}%`, cls: "text-[#d92d20] font-semibold" };
        return { text: "0%", cls: "text-[#475467]" };
    }

    return (
        <div className="px-6 pb-6">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-[#e4e7ec]">
                            <th className="px-6 py-3 text-left text-[12px] font-medium text-[#475467] leading-[18px] whitespace-nowrap"
                                style={{ minWidth: 200 }}>
                                {rowHeader}
                            </th>
                            {pivot.colKeys.map(ck => (
                                <th key={ck}
                                    className="px-6 py-3 text-right text-[12px] font-medium text-[#475467] leading-[18px] whitespace-nowrap"
                                    style={{ minWidth: 130 }}>
                                    {periodLabelFor(ck, period, period === "month")}
                                </th>
                            ))}
                            <th className="px-6 py-3 text-right text-[12px] font-medium text-[#475467] leading-[18px] whitespace-nowrap bg-[#f9fafb]"
                                style={{ minWidth: 140 }}>
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {pivot.rowKeys.map(rk => (
                            <tr key={rk} className="border-b border-[#e4e7ec] hover:bg-[#f9fafb] transition-colors">
                                <td className="px-6 py-4 text-[14px] text-[#344054] font-medium whitespace-nowrap">
                                    {rk}
                                </td>
                                {pivot.colKeys.map(ck => (
                                    <td key={ck}
                                        className="px-6 py-4 text-[14px] text-[#475467] text-right tabular-nums whitespace-nowrap">
                                        {fmt(pivot.matrix[rk]?.[ck] ?? 0)}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-[14px] text-[#101828] text-right tabular-nums font-semibold whitespace-nowrap bg-[#f9fafb]">
                                    {fmtTotal(pivot.rowTotals[rk] ?? 0)}
                                </td>
                            </tr>
                        ))}

                        {/* Column totals row */}
                        <tr className="border-t-2 border-[#e4e7ec] bg-white">
                            <td className="px-6 py-4 text-[14px] font-semibold text-[#101828]">
                                Total
                            </td>
                            {pivot.colKeys.map(ck => (
                                <td key={ck}
                                    className="px-6 py-4 text-[14px] font-semibold text-[#101828] text-right tabular-nums whitespace-nowrap">
                                    {fmtTotal(pivot.colTotals[ck] ?? 0)}
                                </td>
                            ))}
                            <td className="px-6 py-4 text-[14px] font-bold text-[#101828] text-right tabular-nums whitespace-nowrap bg-[#f9fafb]">
                                {fmtTotal(pivot.grandTotal)}
                            </td>
                        </tr>

                        {/* Period-change delta row */}
                        <tr className="bg-white">
                            <td className="px-6 py-3 text-[13px] text-[#475467]">
                                {period === "month" ? "MoM change" : period === "week" ? "WoW change" : period === "quarter" ? "QoQ change" : period === "year" ? "YoY change" : "Period change"}
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
