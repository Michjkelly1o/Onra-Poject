# PDF export — status & production work (dev handoff)

**Verdict — partially built.** PDF export is **not** universally missing: the library (`jspdf` + `jspdf-autotable`) is installed and there's a **working client-side PDF renderer** in the AI-agent export card. But the **admin module export buttons** and the **reports export dropdown** list "PDF" in their menus without wiring it — they either no-op or show a "coming soon" toast.

> Scope note: PDF is a **human-readable report** format, not a migration format. Migration/import round-trips use CSV/Excel — see [`../new-prd/export-migration-completeness-implementation-plan.md`](../new-prd/export-migration-completeness-implementation-plan.md). This doc is only about the PDF option.

---

## What works today
- **AI-agent export card renders real PDF.** `src/ai-agent/components/cards/ExportCard.tsx:72-73` dynamically imports `jspdf` + `jspdf-autotable` and renders the exported report to a PDF client-side (the same file bubble as csv/xlsx). The agent's export tool advertises all three formats as supported (`src/ai-agent/agent/tools.ts:793`). So a proven jspdf pattern already exists in the codebase to reuse.
- `jspdf@^4` + `jspdf-autotable@^5` are in `package.json` (no new dependency needed).

## What's stubbed (PDF listed but not wired)
- **Admin module export button** — `src/components/patterns/ToolbarExport.tsx` lists `["CSV","PDF","Excel"]` (`:21`) but only fires CSV; PDF (and Excel) are inert placeholders (`:69` runs the handler only when `fmt === "CSV"`; header comment `:13-14`: "Only CSV is wired today; PDF / Excel exist as placeholders"). This is the button on Customers, Staff, Products, Schedule, Tax, Agreements, Compensation, etc.
- **Legacy reports dropdown** — `src/components/reports/ExportDropdown.tsx` lists all three; PDF/Excel fire a "coming soon" toast (`:59` — "Only CSV is available in this prototype"). (Note: the live Reports UI doesn't use this component — it uses `ExportInlineDropdown` in `PivotableReportShell`, which offers real **CSV + Excel** but **no PDF**.)

## What a real dev must build
1. **A shared PDF export helper** — wrap the jspdf + jspdf-autotable pattern from `ExportCard.tsx` into a reusable `exportRowsPdf({ title, columns, rows, meta })` (studio name/logo header, the active filters/date-range as a subtitle, `autoTable` for the body, page numbers). One helper both the module toolbar and the reports shell call.
2. **Wire it into `ToolbarExport`** — make the "PDF" menu item call the helper (pass the same rows/columns the CSV export already builds). Remove the placeholder no-op.
3. **Wire it into the reports export** — add a "PDF" item to `PivotableReportShell`'s `ExportInlineDropdown` alongside CSV/Excel (the report already has typed columns + a metadata sheet to reuse for the header). Retire the dead `ExportDropdown` "coming soon" stub.
4. **Good fits for PDF specifically** — the per-instructor payout statement (`PayrollInstructorDetailPage`) and the payroll run breakdown are document-shaped and read best as PDF; make sure their export offers it.

## Priority
Low/medium — PDF is a nice-to-have human format. CSV/Excel completeness (the migration path) is the higher priority; do that plan first, then wire PDF into the same shared exporter so all three formats come from one column spec.
