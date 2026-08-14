// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared, migration-ready export (CSV + Excel from one spec)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 0 of the export-migration plan (new-prd/export-migration-completeness-
// implementation-plan.md). A module declares its columns ONCE as an
// `ExportColumn[]` and calls `exportRows(data, format)`; CSV and Excel are then
// produced from the same spec, so the two formats can never drift.
//
// The COLUMN CONTRACT (applied when a module authors its spec, Phase 1+):
//   • first column is the record `id`
//   • every foreign key is exported as its `*_id` (branch_id, category_id,
//     instructor_id, …) — keep a readable `*_name` column alongside it
//   • always include `status`, and machine values (ISO dates, raw numbers),
//     not display labels
// so an export → import round-trip reconstructs records + relationships.

import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";

/** One column in an export. `value` returns the cell for a given row. */
export interface ExportColumn<Row> {
    /** Machine key — used as the header and (for migration/import) the field
     *  name. Prefer the entity's snake_case field name, e.g. "branch_id". */
    key: string;
    /** Human header, when different from `key`. Optional. */
    header?: string;
    /** Cell value for a row. Numbers stay numeric in Excel; null/undefined → "".
     *  Method syntax (bivariant params) so a typed ExportData<Row> stays
     *  assignable to the ToolbarExport `ExportData<unknown>` prop. */
    value(row: Row): string | number | null | undefined;
}

export interface ExportData<Row> {
    /** Base filename WITHOUT extension or date, e.g. "customers". The final
     *  file is `${entity}-YYYY-MM-DD.{csv|xlsx}`. */
    entity: string;
    columns: ExportColumn<Row>[];
    rows: Row[];
}

export type ExportFormat = "csv" | "xlsx";

/**
 * Wrap a pre-built `header + matrix` into an `ExportData` so a DYNAMIC-column
 * export (columns whose count/labels are known only at runtime — e.g. one stock
 * column per active branch) can still flow through the shared CSV/Excel path.
 * Static entities should prefer an explicit `ExportColumn[]` spec instead.
 */
export function matrixToExportData(entity: string, header: string[], matrix: (string | number)[][]): ExportData<(string | number)[]> {
    return {
        entity,
        rows: matrix,
        columns: header.map((h, i) => ({ key: h, value: (row: (string | number)[]) => row[i] })),
    };
}

/**
 * THE single entry point for a module's list export. One column spec → both
 * CSV and Excel. CSV goes through the shared `csv-export` primitive (UTF-8 BOM +
 * CRLF); Excel is a real `.xlsx` via SheetJS, lazy-loaded so CSV-only pages
 * never ship the xlsx bundle.
 */
export async function exportRows<Row>(data: ExportData<Row>, format: ExportFormat): Promise<void> {
    const header = data.columns.map(c => c.header ?? c.key);
    const filename = `${data.entity}-${todayISO()}`;

    if (format === "csv") {
        const body = data.rows.map(r => data.columns.map(c => cellToString(c.value(r))));
        downloadCsv(`${filename}.csv`, buildCsv(header, body));
        return;
    }

    // Real .xlsx — numbers stay numeric, everything else is text. Lazy import so
    // the ~500KB SheetJS bundle only loads when Excel is actually chosen.
    const mod = (await import("xlsx")) as unknown as XlsxModule;
    const XLSX = mod.utils ? mod : (mod as unknown as { default: XlsxModule }).default;
    const aoa: (string | number)[][] = [
        header,
        ...data.rows.map(r => data.columns.map(c => cellForXlsx(c.value(r)))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Reasonable column widths from the header length so the file opens tidy.
    ws["!cols"] = header.map(h => ({ wch: Math.min(40, Math.max(10, h.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName(data.entity));
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── internals ──────────────────────────────────────────────────────────────

interface XlsxModule {
    utils: {
        aoa_to_sheet: (aoa: unknown[][]) => Record<string, unknown>;
        book_new: () => unknown;
        book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
    };
    writeFile: (wb: unknown, filename: string) => void;
}

function cellToString(v: unknown): string {
    return v === null || v === undefined ? "" : String(v);
}
function cellForXlsx(v: unknown): string | number {
    if (v === null || v === undefined) return "";
    return typeof v === "number" && Number.isFinite(v) ? v : String(v);
}
/** Excel sheet names: max 31 chars, none of []:*?/\ */
function sheetName(entity: string): string {
    const clean = entity.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
    return clean || "Sheet1";
}
