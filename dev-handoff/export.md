# Export — status & production work (dev handoff)

**Where it stands.** CSV and Excel export are **done** across the admin — every list, every child table, and the Dashboard snapshot download both, all driven by one column-spec per entity (full story in [`export-migration.md`](export-migration.md)). Two pieces of production work remain:

1. **Wire PDF** — still a disabled "soon" item in every export menu.
2. **A correctness pass on the Reports exports** — verify each report's columns and the data behind them are right, so report exports can be trusted for real reporting + migration.

---

## Current state of the three formats

- **CSV** — real, everywhere. Shared primitive (`src/lib/csv-export.ts`, UTF-8 BOM + CRLF).
- **Excel (.xlsx)** — real, everywhere. SheetJS, lazy-loaded (`src/lib/export/export-data.ts`). The Reports module has a richer Excel path (`src/lib/reports/export-excel.ts`) with per-cell number formats + a self-describing metadata sheet.
- **PDF** — **not wired.** Shown as a disabled "soon" item in both export menus: the shared `ToolbarExport` (`src/components/patterns/ToolbarExport.tsx`, `EXPORT_FORMATS = ["CSV","Excel","PDF"]`, `isEnabled` returns false for PDF) and the reports `ExportInlineDropdown` in `PivotableReportShell.tsx` (PDF item rendered disabled). A **working jspdf renderer already exists** in the AI-agent export card (`src/ai-agent/components/cards/ExportCard.tsx`) to reuse — `jspdf@^4` + `jspdf-autotable@^5` are already in `package.json`.

---

## Part 1 — PDF: what a real dev must build

1. **A shared PDF export helper** — wrap the jspdf + jspdf-autotable pattern from `ExportCard.tsx` into a reusable `exportRowsPdf({ title, columns, rows, meta })` (studio name/logo header, the active filters/date-range as a subtitle, `autoTable` for the body, page numbers). One helper the module toolbar and the reports shell both call.
2. **Wire it into `ToolbarExport`** — the component already receives an `exportData` column spec (id + FK + label per column). Make the PDF menu item enabled and route it through the helper using that same spec, so PDF comes from the identical columns as CSV/Excel. Remove the disabled/"soon" state for PDF.
3. **Wire it into the Reports export** — `PivotableReportShell`'s `ExportInlineDropdown` already lists PDF (disabled); enable it and call the helper with the report's typed columns + the metadata it already builds for the Excel sheet.
4. **Best-fit documents** — the per-instructor payout statement (`src/components/staff/PayrollInstructorDetailPage.tsx`) and the payroll run breakdown are document-shaped and read best as PDF; make sure their export offers it.

> PDF is a **human-readable** format, not a migration format. Migration round-trips use CSV/Excel — see [`export-migration.md`](export-migration.md).

---

## Part 2 — Reports: correctness / optimization pass (verify columns + data)

The Reports module has its own richer export engine, separate from the shared spec exporter:
- **Column definitions** per report in `src/config/reports/*.ts` (each column: `key`, `label`, `kind`, optional `hiddenByDefault`, `minWidth`).
- **Data selectors** in `src/lib/reports/selectors.ts` that produce the row objects.
- **The shell** `src/components/reports/PivotableReportShell.tsx` renders + exports whatever columns are currently visible (users toggle hidden ones via **"Select columns"**).

Before report exports can be trusted for real reporting/migration, a dev should verify each report end-to-end. Checklist:

1. **Column `key` ↔ data field.** For every column def, confirm its `key` matches a real field the selector actually produces (a typo'd key silently exports blanks). Confirm no two columns read the same field by mistake.
2. **Column `kind` is right.** The `kind` (`currency` / `number` / `percent` / `date` / `id` / `status` / `text`) drives Excel number formatting and the Total row. A money column typed as `text` won't sum or format as AED; a percent stored as `15` vs `0.15` will format wrong. Verify each.
3. **Hidden ID / FK columns are populated + complete.** Reports carry id columns marked `hiddenByDefault` — Transaction #, Customer ID, Payout / settlement ID, etc. — and rows carry `branchId`. Confirm these hold real, complete values (some selector fields may still be stubbed/placeholder — see the stub list in [`reports-and-insights.md`](reports-and-insights.md)). Show them via "Select columns" and check the exported values are correct.
4. **`branch_id` in the export.** Reports show **Location as a name**, and each row carries `branchId` but most configs don't surface it as a column. If a report's export needs the branch id (for migration), add a `branch_id` column to that report's config (`{ key: "branchId", label: "Branch ID", kind: "id", hiddenByDefault: true }`) — the row already carries the value.
5. **Totals + number formats match meaning.** Verify the Total row (numeric columns only) and the Excel currency/percent/date formats reflect each column's real meaning.
6. **Exported numbers match the screen.** The exports inherit the reports' refund + recognized-revenue logic (`src/lib/reports/refunds.ts`, `recognized-revenue.ts`). For the same date range + Location filter, confirm the exported figures equal what's shown on screen — no drift between the table and the file.

**Goal:** every report exports the columns it should, with correct values, formats, and IDs, so the file can be trusted both for human reporting and for moving data into a real system later.

---

## Priority
- **CSV/Excel completeness** — done (see `export-migration.md`).
- **Reports correctness pass (Part 2)** — do this before anyone relies on report exports for real numbers; it's about trust in the data, not new features.
- **PDF wiring (Part 1)** — low/medium; a nice-to-have human format. Wire it into the same shared helper so all three formats come from one column spec.
