// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · pivot reducer + period bucketing + delta computation
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure functions. Zero UI, zero store touches. Given a row array + a
// pivot config, returns a fully-resolved PivotResult ready to render.
//
// Algorithm mirrors the client's HTML mockup exactly
// (new-prd/Onra_Total_Sales_GroupBy_mockup.html renderPivot() function):
//
//   1. Extract period key from each row → collect unique + sorted
//   2. Extract dimension key from each row → collect unique
//   3. Fold rows into matrix[dim][period] += measure(row)
//   4. Row totals + column totals + grand total (single pass)
//   5. Sort dimension rows by row total DESC
//   6. Compute column deltas (each column vs the previous one)
//
// The HTML mockup labels its X axis "Period" and Y axis the breakdown;
// the shell reads PivotResult and lays this out as a matrix with a
// "Period change" delta row underneath the column totals.

import type { DimensionDef, MeasureDef, PeriodKey, PivotResult } from "./types";

// ─── Period bucketing ─────────────────────────────────────────────────────

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Given an ISO date string, return the bucket key for the specified period.
 *  Returns empty string for "none" (list mode — no bucketing). */
export function periodKeyFor(dateISO: string, period: PeriodKey): string {
    if (period === "none") return "";
    if (!dateISO || dateISO.length < 10) return "";

    if (period === "day")   return dateISO.slice(0, 10);
    if (period === "month") return dateISO.slice(0, 7);
    if (period === "year")  return dateISO.slice(0, 4);

    if (period === "quarter") {
        const monthNum = Number(dateISO.slice(5, 7));
        const q = Math.floor((monthNum - 1) / 3) + 1;
        return `${dateISO.slice(0, 4)}-Q${q}`;
    }

    if (period === "week") {
        // ISO week: Monday-anchored. Return the ISO date of the Monday.
        const d = new Date(dateISO.slice(0, 10) + "T00:00:00Z");
        const off = (d.getUTCDay() + 6) % 7;
        d.setUTCDate(d.getUTCDate() - off);
        return d.toISOString().slice(0, 10);
    }

    return "";
}

/** Human label for a period key — matches the HTML mockup's perLabel():
 *   day     → "2026-06-19"          (raw ISO)
 *   week    → "13 May"              (day + short month)
 *   month   → "Jun"                 (short month only — assumes user knows the year)
 *   quarter → "Q2"                  (quarter number)
 *   year    → "2026"
 *  Callers who want the year on month labels can pass includeYear=true. */
export function periodLabelFor(key: string, period: PeriodKey, includeYear = false): string {
    if (period === "day" || !period) return key;

    if (period === "week") {
        const [_y, m, d] = key.split("-");
        return `${Number(d)} ${MON[Number(m) - 1]}`;
    }

    if (period === "month") {
        const [y, m] = key.split("-");
        const label = MON[Number(m) - 1] ?? key;
        return includeYear ? `${label} ${y}` : label;
    }

    if (period === "quarter") {
        return key.split("-")[1] ?? key;
    }

    if (period === "year") return key;

    return key;
}

// ─── Pivot reducer ────────────────────────────────────────────────────────

export interface PivotConfig {
    /** Which field on each row holds the ISO date used for period bucketing.
     *  E.g. "createdAtISO" for transactions, "dateISO" for class sessions. */
    periodField: string;
    /** Chosen period granularity. */
    period: PeriodKey;
    /** Chosen breakdown dimension. `null` = no breakdown, everything
     *  aggregates into one "All" row. */
    dimension: DimensionDef | null;
    /** Active measure — what to aggregate. */
    measure: MeasureDef;
}

const ALL_ROW_KEY = "All";

/** Fold a row array into a fully-resolved PivotResult. Runs in O(N) with
 *  three small passes: (1) collect period/dim keys, (2) build matrix,
 *  (3) compute totals + deltas. */
export function pivotRows(
    rows: readonly Record<string, unknown>[],
    config: PivotConfig,
): PivotResult {
    const { periodField, period, dimension, measure } = config;

    // Pass 1 — collect unique period keys + dimension keys.
    const colKeySet = new Set<string>();
    const rowKeySet = new Set<string>();

    for (const row of rows) {
        const dateISO = String(row[periodField] ?? "");
        const colKey = periodKeyFor(dateISO, period);
        if (colKey) colKeySet.add(colKey);

        const rowKey = dimension ? dimension.extract(row) : ALL_ROW_KEY;
        rowKeySet.add(rowKey || "—");
    }

    const colKeys = Array.from(colKeySet).sort();
    // Row keys sorted later by row-total DESC. Fallback for the no-breakdown
    // case is a single "All" row.
    const rowKeys: string[] = Array.from(rowKeySet.size > 0 ? rowKeySet : new Set([ALL_ROW_KEY]));

    // Initialize matrix + running totals.
    const matrix: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    for (const rk of rowKeys) {
        matrix[rk] = {};
        rowTotals[rk] = 0;
        for (const ck of colKeys) matrix[rk][ck] = 0;
    }
    for (const ck of colKeys) colTotals[ck] = 0;
    let grandTotal = 0;

    // Pass 2 — accumulate.
    for (const row of rows) {
        const dateISO = String(row[periodField] ?? "");
        const colKey = periodKeyFor(dateISO, period);
        if (!colKey) continue; // row's date doesn't bucket into this period

        const rowKey = (dimension ? dimension.extract(row) : ALL_ROW_KEY) || "—";
        const v = measure.extract(row);
        if (!Number.isFinite(v)) continue;

        // Ensure the matrix cell exists — a rowKey / colKey may have been
        // introduced by a row whose date-bucket landed outside the initial
        // seen set. Defensive.
        if (!matrix[rowKey]) matrix[rowKey] = {};
        if (matrix[rowKey][colKey] == null) matrix[rowKey][colKey] = 0;

        matrix[rowKey][colKey] += v;
        rowTotals[rowKey] = (rowTotals[rowKey] ?? 0) + v;
        colTotals[colKey] = (colTotals[colKey] ?? 0) + v;
        grandTotal += v;
    }

    // Sort row keys by row total DESC (matches the HTML mockup). Ties keep
    // insertion order.
    rowKeys.sort((a, b) => (rowTotals[b] ?? 0) - (rowTotals[a] ?? 0));

    // Pass 3 — column deltas: (colT[p] - colT[p−1]) / colT[p−1] × 100.
    const columnDeltasPct: (number | null)[] = colKeys.map((ck, i) => {
        if (i === 0) return null;
        const prev = colTotals[colKeys[i - 1]] ?? 0;
        if (prev === 0) return null;
        const curr = colTotals[ck] ?? 0;
        return ((curr - prev) / prev) * 100;
    });

    return {
        rowKeys,
        colKeys,
        matrix,
        rowTotals,
        colTotals,
        grandTotal,
        columnDeltasPct,
    };
}

// ─── Sanity helper — total of a row/col slice for external callers ────────

/** Sum a specific row across all periods. Handy for report footers. */
export function rowTotal(pivot: PivotResult, rowKey: string): number {
    return pivot.rowTotals[rowKey] ?? 0;
}

/** Sum a specific column across all rows. */
export function colTotal(pivot: PivotResult, colKey: string): number {
    return pivot.colTotals[colKey] ?? 0;
}
