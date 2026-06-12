// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tiny CSV download helper
// ─────────────────────────────────────────────────────────────────────────────
//
// One shared primitive that every module's CSV exporter can call so the
// download mechanics (UTF-8 BOM, quoted+escaped values, anchor click,
// URL revoke) stay consistent. Each module still owns its own column
// mapping + filename — see `/admin/customers/page.tsx` for the canonical
// "header + body + esc" pattern this helper plugs into.

/** Escape a single CSV cell — wrap in quotes, double-up embedded quotes. */
export function csvEscape(value: unknown): string {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Build the CSV string from a header row + body rows. Lines use CRLF for
 *  maximum spreadsheet compatibility. */
export function buildCsv(header: string[], body: string[][]): string {
    return [header, ...body].map(line => line.map(csvEscape).join(",")).join("\r\n");
}

/** Trigger a file download for the given CSV body. Adds the UTF-8 BOM so
 *  Excel renders Unicode (AED, accented names, etc.) correctly. */
export function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** "YYYY-MM-DD" — used in default filenames. */
export function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}
