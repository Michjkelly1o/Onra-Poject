// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · CSV export
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure helpers. The shell calls one of these when the user picks
// "Download CSV" from the Export dropdown. Matches the CSV shape the
// client's HTML mockup produces so consumers get familiar output.
//
// Two shapes:
//   1. exportListCsv — flat list (Period = "none"): one row per data
//      row, one column per visible ColumnDef, plus a Total row at the
//      bottom for numeric columns.
//   2. exportPivotCsv — matrix (Period != "none"): row headers on the
//      left, period columns across the top, row totals on the right,
//      column totals on the bottom, delta row underneath.

import type { ColumnDef, PivotResult } from "./types";

// ─── Cell formatting ──────────────────────────────────────────────────────

/** Escape a value for a CSV cell. Wraps in quotes if it contains comma,
 *  newline, or quote — and doubles internal quotes. */
export function csvEscape(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/** Format a cell value based on the column kind. Currency omits the AED
 *  prefix in CSV (Excel columns own the display), percentages use "0.00%",
 *  numbers stay as-is so Excel's "detect number format" picks them up. */
export function formatCellForCsv(value: unknown, kind: ColumnDef["kind"]): string {
    if (value === null || value === undefined || value === "") return "";
    if (kind === "currency" || kind === "number") {
        const n = Number(value);
        if (!Number.isFinite(n)) return "";
        return String(Math.round(n));
    }
    if (kind === "percent") {
        const n = Number(value);
        if (!Number.isFinite(n)) return "";
        // Store as decimal (0.15 → "0.15") so Excel formats it as percent.
        return (n / 100).toFixed(4);
    }
    if (kind === "date") {
        const s = String(value);
        return s.slice(0, 10); // YYYY-MM-DD
    }
    return String(value);
}

// ─── List-mode export ─────────────────────────────────────────────────────

export interface ExportListOpts {
    columns: ColumnDef[];
    rows: readonly Record<string, unknown>[];
    /** Filename without extension. E.g. "total-sales_2026-06_2026-07-04". */
    filename: string;
    /** Which columns are numeric — the Total row sums these. */
    includeTotalRow?: boolean;
}

/** Build the CSV string for a flat list report. Consumers pipe this into
 *  the browser via triggerDownload() below. */
export function buildListCsv(opts: ExportListOpts): string {
    const { columns, rows, includeTotalRow = true } = opts;
    const lines: string[] = [];

    // Header row.
    lines.push(columns.map(c => csvEscape(c.label)).join(","));

    // Data rows.
    for (const r of rows) {
        lines.push(columns.map(c => csvEscape(formatCellForCsv(r[c.key], c.kind))).join(","));
    }

    // Total row — sum numeric columns; leading text columns say "Total".
    if (includeTotalRow) {
        const totals = columns.map(c => {
            if (c.kind !== "currency" && c.kind !== "number") return null;
            let sum = 0;
            for (const r of rows) {
                const n = Number(r[c.key]);
                if (Number.isFinite(n)) sum += n;
            }
            return sum;
        });
        const firstNumericIdx = totals.findIndex(t => t !== null);
        const cells = columns.map((c, i) => {
            if (i === 0 || (firstNumericIdx > 0 && i < firstNumericIdx)) {
                // Put "Total" label in the first text column.
                return i === 0 ? csvEscape("Total") : "";
            }
            const t = totals[i];
            if (t === null) return "";
            return csvEscape(formatCellForCsv(t, c.kind));
        });
        lines.push(cells.join(","));
    }

    return lines.join("\n");
}

// ─── Pivot-mode export ────────────────────────────────────────────────────

export interface ExportPivotOpts {
    /** Label for the row header column (e.g. "Category", "Location"). */
    rowHeader: string;
    /** Label for each period column (already formatted for display). */
    colHeaders: string[];
    pivot: PivotResult;
    filename: string;
}

/** Build the CSV string for a pivoted report. Matches the client's HTML
 *  mockup exportCSV() output when Period != "none". */
export function buildPivotCsv(opts: ExportPivotOpts): string {
    const { rowHeader, colHeaders, pivot } = opts;
    const lines: string[] = [];

    // Header row: [rowHeader, ...colHeaders, "Total"].
    lines.push(
        [csvEscape(rowHeader), ...colHeaders.map(csvEscape), csvEscape("Total")].join(","),
    );

    // Data rows.
    for (const rk of pivot.rowKeys) {
        const cells = [csvEscape(rk)];
        for (const ck of pivot.colKeys) {
            const v = pivot.matrix[rk]?.[ck] ?? 0;
            cells.push(csvEscape(Math.round(v)));
        }
        cells.push(csvEscape(Math.round(pivot.rowTotals[rk] ?? 0)));
        lines.push(cells.join(","));
    }

    // Total row (column totals + grand total).
    const totalCells = [csvEscape("Total")];
    for (const ck of pivot.colKeys) {
        totalCells.push(csvEscape(Math.round(pivot.colTotals[ck] ?? 0)));
    }
    totalCells.push(csvEscape(Math.round(pivot.grandTotal)));
    lines.push(totalCells.join(","));

    // Delta row (Period change vs previous).
    const deltaCells = [csvEscape("Period change (%)")];
    for (const d of pivot.columnDeltasPct) {
        if (d === null) deltaCells.push("");
        else deltaCells.push(csvEscape(d.toFixed(1)));
    }
    deltaCells.push(""); // no total column for deltas
    lines.push(deltaCells.join(","));

    return lines.join("\n");
}

// ─── Browser trigger ──────────────────────────────────────────────────────

/** Trigger a download of `csv` as a CSV file. No-op on the server. */
export function triggerCsvDownload(csv: string, filename: string): void {
    if (typeof document === "undefined") return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
