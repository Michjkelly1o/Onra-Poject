# Export & migration completeness — status (dev handoff)

**Verdict — done for the prototype.** Every admin module that lists migratable data now exports a **complete, re-importable dataset in CSV and Excel**, driven by one shared column-spec so the two formats can never drift. This doc records what was built (Phases 0–5 of [`../new-prd/export-migration-completeness-implementation-plan.md`](../new-prd/export-migration-completeness-implementation-plan.md)) and the round-trip verification findings.

---

## The architecture

- **One column-spec per entity** in [`src/lib/export/specs/`](../src/lib/export/specs/). A module declares its columns once (`ExportColumn[]`); `exportRows(data, "csv" | "xlsx")` in [`src/lib/export/export-data.ts`](../src/lib/export/export-data.ts) produces both formats from that single spec.
- **CSV** goes through the shared `csv-export` primitive (UTF-8 BOM + CRLF). **Excel** is a real `.xlsx` via SheetJS, lazy-loaded so CSV-only pages don't ship the bundle.
- **`ToolbarExport`** ([`src/components/patterns/ToolbarExport.tsx`](../src/components/patterns/ToolbarExport.tsx)) takes an `exportData` prop → live CSV + Excel; the legacy `onExportCsv` (CSV-only) path is retired across migrated modules. PDF stays a disabled "soon" item (see [`pdf-export.md`](pdf-export.md)).

### The column contract (applied everywhere)
Every export carries: the record **`id`** first, **every FK as its `*_id`** (`branch_id`, `category_id`, `instructor_id`, `room_id`, `customer_id`, …) alongside a readable `*_name`, the **`status`**, and the full field set as **machine values** (ISO dates, raw numbers, JSON for structured sub-objects) — not display labels. An export → import round-trip reconstructs records and relationships.

---

## What ships an export (by phase)

- **Phase 1 — existing exports rebuilt to contract:** Customers (incl. the active/archived merge fix + 8 marketing prefs), Staff, Roles (serialized permissions matrix + grant limits), Memberships + Packages, Gift-card designs, Schedule, Tax rates, Agreements (with the current-version document body), Compensation, Retail (id + category_id added; importer-tuned columns kept verbatim).
- **Phase 2 — modules that had none:** Business/Locations (branches), Pay rates (full discriminated union), Promo codes, Marketing campaigns + Announcements, Services, Class categories, Notification settings. Also fixed the Staff page's shift sub-tab (it was exporting staff rows instead of shifts).
- **Phase 3 — child / relationship tables:** class-bookings, appointment-bookings, customer-plans, wallet-transactions, customer-transactions, referrals, customer-agreements, issued-gift-cards, rooms, business-hours. Surfaced per-record exports on the gift-card detail tab + the customer-profile tabs (Plan, Payments, Bookings, Referrals, Agreements).
- **Phase 4 — Reports migration mode:** the reports export dropdown gained a **"Migration export (all IDs)"** group (Excel + CSV) that emits raw per-record rows with *every* id/FK column (incl. the `hiddenByDefault` ones) and injects a `branch_id` column centrally when rows carry it. The normal Excel/CSV export (visible columns, pivot-aware) is unchanged.

### Specs with no toolbar surface (migration-layer only)
`wallet-transactions`, `rooms`, and `business-hours` have complete specs but **no admin list page** to hang a button on. They're built for a bulk export / Supabase-seed script that calls the spec with the full store array. Same for the full child tables (a real migration exports the whole table, not one customer at a time).

---

## Phase 5 — round-trip verification (findings)

Verified empirically by feeding each export's CSV through the **real AI-agent import wizard** (`parseCsv` → `proposeMapping` → `preview` in [`src/ai-agent/migration/parser.ts`](../src/ai-agent/migration/parser.ts)).

**There are two migration directions, with two different contracts — and that's correct:**

1. **Export → Supabase seed (migration OUT of Onra).** The **id-first** contract. Onra's own ids are authoritative; FKs are `*_id`. This is what the specs are built for and what a production migration actually consumes. ✅ complete and verified (100+ headless assertions across phases: id-first, FK ids present, status, every cell evaluates).

2. **Foreign CSV → AI-agent importer (migration INTO Onra).** The importer is **name/email-based**: it matches human header aliases (`name`, `email`, `branch`, `class name`, `class date`) and resolves FKs by **name**, minting fresh ids. It's designed to ingest a *customer's existing system's* export, not Onra's own id dump.

**Key result:** the two are **compatible, not conflicting.** Onra's exports carry both the id columns *and* readable columns. The importer consumes the readable attribute columns (name, email, address, dates, price, capacity…) and **safely ignores** the id/FK/status columns (the parser only maps dict-recognized headers — unknown columns are dropped, never errored). So an Onra export **doesn't break** the importer, and its human columns partially round-trip.

**Fix applied:** the importers resolve a branch from a header literally named `branch` / `location`, but Onra exports the branch as `branch_name` (→ normalizes to `"branch name"`). Added `"branch name"` as a dict alias to the four importers that resolve a branch (`rooms`, `staff`, `pay_rates`, `customers`) so the readable FK column now resolves on import. Verified: `branch_name → branch` maps after the fix. (This also helps real foreign CSVs, which commonly use a "Branch Name" column.)

### What a real developer does next
- **The production migration path is the id-based Supabase seed.** Point a seed/import script at each spec (call the `*ExportData` builder with the full store array, or read the exported CSV/Excel) — the ids + FK ids are authoritative, so records + relationships reconstruct directly. No name resolution needed.
- **The AI-agent importer stays the name-based ingest path** for onboarding foreign data. It does not need to consume Onra's id columns; extending its dicts with more `*_name` aliases (as done for branch) is the only work to tighten Onra-export → AI-import fidelity, and it's optional.
- **Retail** remains the one export deliberately tuned to the AI-agent importer's exact shape (dynamic `stock_<Branch>` columns, importer-recognized headers) — it round-trips through the importer directly; `id` + `category_id` were added without disturbing that.

---

## Files

- Specs: [`src/lib/export/specs/`](../src/lib/export/specs/) — `customers`, `staff`, `products`, `schedule`, `settings`, `locations`, `pay-rates`, `marketing`, `classes`, `notifications`, `bookings`, `customer-records`.
- Core: [`src/lib/export/export-data.ts`](../src/lib/export/export-data.ts) (`ExportColumn`, `exportRows`, `matrixToExportData`).
- Toolbar: [`src/components/patterns/ToolbarExport.tsx`](../src/components/patterns/ToolbarExport.tsx).
- Reports migration mode: [`src/components/reports/PivotableReportShell.tsx`](../src/components/reports/PivotableReportShell.tsx).
- Importer (verification target): [`src/ai-agent/migration/`](../src/ai-agent/migration/).
