# Export & Migration Completeness — Audit + Implementation Plan

**Goal:** every admin module that lists migratable data can export a **complete, re-importable** dataset in **CSV and Excel** — including the record `id`, every **FK id** (branch/location, category, instructor, room, plan, design…), the `status`, and all fields — so that an export → import round-trip reconstructs the original records and relationships. Today most exports drop the ids and write only display names, which cannot be re-imported.

**Audited:** 2026-08-14, across all admin export points.

---

## 1. What we found (audit summary)

### Export mechanisms
- **`src/lib/csv-export.ts`** — a shared CSV primitive (`buildCsv`/`downloadCsv`/`csvEscape`, UTF-8 BOM + CRLF). **It's effectively unused** — most modules hand-roll their own Blob/anchor CSV with **inconsistent encoding** (some CRLF+BOM, some `\n`, Compensation has no BOM).
- **`ToolbarExport`** (`src/components/patterns/ToolbarExport.tsx`) — the menu lists **CSV / PDF / Excel**, but **only CSV is wired**; PDF/Excel are inert placeholders.
- **`ExportDropdown`** (`src/components/reports/ExportDropdown.tsx`) — CSV real; PDF/Excel fire a **"coming soon" toast**. (Unused by the live reports UI.)
- **Reports** are the exception: `PivotableReportShell` uses its own `ExportInlineDropdown` with **real CSV + real Excel (SheetJS)** — `src/lib/reports/export-excel.ts` (`XLSX.writeFile`, per-cell number formats, metadata sheet) + `export-csv.ts`.

### Three systemic problems
1. **Display names, not ids.** Every module export except Retail writes human-readable names, never the `id` / FK ids — so **nothing round-trips** for import.
2. **CSV-only.** Only the Reports module offers Excel. Every module list export is CSV-only (Excel is a placeholder).
3. **Missing columns / missing exports.** Most exports drop the record's extended fields; many entities have **no export at all**.

### Per-module current state

| Module / entity | Export? | Format | Migration status | Biggest gaps |
|---|---|---|---|---|
| **Retail products** | Yes | CSV | ~Complete (round-trips) | FK-by-name (no `category_id`/branch id), no `id` |
| **Reports** (bookings, payments, memberships, customers, referrals, refunds…) | Yes | CSV **+ Excel** | Row-level, has ID/FK columns | ID columns `hiddenByDefault`; **Location is a name, not `branch_id`** |
| **Customers** | Yes | CSV | Incomplete | no `id`, no `branchId`, **no `status` (active+archived merged!)**, no address/DOB/gender, no plan FKs, no marketing prefs (8), no emergency contact, no `referralCode`/`sourceId`, no `createdAt` |
| **Staff** | Yes | CSV | Incomplete | no `id`, `roleId`/`branchId` as names, no `payRateId`/`payConfig`, no `categoryIds`, no bio/specialties/invite state |
| **Roles** | Yes | CSV | Incomplete | no `id`, **no `permissions` matrix** (the defining payload), no `grantLimits`/`locked` |
| **Memberships & Packages** | Yes | CSV | Incomplete | no `id`, `branch_ids` as name label, raw `credits`/`duration_months`/`validity_days` dropped, no config fields (`auto_renew`, `active_on_first_use`, `is_intro_offer`, `purchase_rules`, description) |
| **Gift cards (designs)** | Yes | CSV | Incomplete | no `id`, no `value_type`/`fixed_value_aed`/`min/max`/`validity_days`/config; **Issued gift cards not exported at all** |
| **Schedule** | Yes | CSV | Incomplete | no `id`, all 4 FKs as names, raw `start/end_time` dropped, no `class_type`/`gender_access`/`recurrence_group_id`/`applicable_*_ids`/`spot_layout` |
| **Tax rates** | Yes | CSV | Incomplete | no `id`, dates as display strings (not `validFromISO`), no branch scope |
| **Agreements** | Yes | CSV | Incomplete | no `id`, **no document body/URL**, branch names not FKs, no signature records |
| **Compensation / Payroll run / Payout detail** | Yes | CSV | Incomplete (finance reports) | drops the `entryId` it already has, all FK ids, gross/attendees/hours/commission/adjustments |
| **Dashboard** | Yes | CSV | N/A | analytics snapshot of on-screen charts — **no entity records at all** |
| **Pay rates** | **No** | — | Missing | entire `PayRate` entity (rates, tiers, commissions, bonuses) |
| **Promo codes** | **No** | — | Missing | entire `PromoCode` entity |
| **Marketing campaigns** | **No** | — | Missing | entire `MarketingItem` (targeting, delivery model) |
| **Announcements** | **No** | — | Missing | `MarketingItem` (type=announcement) |
| **Business — Locations / Branches / Rooms** | **No** | — | Missing | branches + rooms (+ hours) — the entity everything else FKs to |
| **Services / Class templates / Categories** | **No** | — | Missing | catalog config |
| **Shifts** | **No** | — | Missing | shift records |
| **Notification settings** | **No** | — | Missing | per-event channel config |
| **Bookings / Appointments / Customer plans / Wallet / POS transactions / Referrals / Issued gift cards / Customer agreements** | **No admin export** | (Reports only, partial) | Missing | the relationship/child tables a full migration needs |

---

## 2. Design decisions (the column contract)

Before building, lock these rules so every export is consistent and import-ready:

1. **Always export the record `id`** as the first column, and **every FK as its `*_id`** (e.g. `branch_id`, `category_id`, `instructor_id`, `room_id`, `template_id`, `design_id`, `membership_id`). Keep the human name as an *additional* readable column (e.g. `branch_id` **and** `branch_name`) — machine id for import, name for humans.
2. **Location is never name-only.** Every entity that has a branch carries `branch_id` (and `branch_ids` for multi-branch as a delimited list of ids).
3. **Always export `status`** (active/inactive/archived) and never merge active + archived without a distinguishing column. (Fixes the Customers active/archived merge bug.)
4. **Export the full field set** — align export columns 1:1 with the entity's snake_case fields in `src/data/mock/_types.ts` (the future Supabase columns), including config/extended fields and `created_at`. Raw machine values (ISO dates, numeric credits/durations) not display labels.
5. **One file per entity** (mirroring the mock-data table-per-file convention), so each export maps directly to one import table. Child tables (bookings, plans, wallet, issued cards) export separately with their parent FKs.
6. **Two real formats** — CSV (canonical migration format) **and** Excel (.xlsx, human-friendly). Wire both in the toolbar; drop the "coming soon" stubs.
7. **Align with the importer.** The AI-agent migration wizard (`src/ai-agent/migration/entities/*`) is the import target — export column names/shape should match what those mappers expect (Retail already round-trips this way). Every new export gets a matching import mapper (or confirms one exists).

---

## 3. Implementation phases

### Phase 0 — Shared export foundation (do first)
- **Consolidate onto one CSV helper.** Make `src/lib/csv-export.ts` the single path; migrate the hand-rolled exporters (customers, staff, roles, tax, agreements, compensation, payroll) to it so BOM/CRLF/escaping are consistent.
- **Generalize the Excel helper.** Lift `src/lib/reports/export-excel.ts` (SheetJS) into a shared `exportRows({ entity, columns, rows, format: "csv" | "xlsx" })` so any module gets Excel for free.
- **Wire `ToolbarExport` for real CSV + Excel** (remove the placeholder no-ops); same for any shared dropdown. Standard filename: `entity-YYYY-MM-DD.{csv|xlsx}`.
- **Define one column-spec type** per entity (`{ key, header, fromRow }[]`) so a module declares its columns once and both formats + the id/FK contract come from it.

### Phase 1 — Fix the exports that EXIST but are incomplete
Rebuild each existing export's column set to the contract (id + FK ids + status + full fields + Excel). Priority order by value:
1. **Customers** — add `id`, `branch_id`, `status`, name split, DOB/gender/full address, plan FKs (`membership_id`/`package_ids`/`credits_remaining`/`plan_expiry`), marketing prefs (8), emergency contact, `referral_code`/`source_id`, `created_at`; stop merging active+archived (status column).
2. **Staff** + **Roles** — staff: `id`, `role_id`, `branch_id`, pay FKs/`payConfig`, `category_ids`, instructor fields. Roles: `id`, **serialized `permissions`**, `grant_limits`, `locked`.
3. **Memberships & Packages** + **Gift cards** — full config fields + ids; add **Issued gift cards** export.
4. **Schedule** — ids + FK ids + raw times + `class_type`/`recurrence_group_id`/`applicable_*_ids`/`spot_layout`.
5. **Tax** + **Agreements** — ids, machine dates, branch FKs, agreement document body/URL.
6. **Retail** — add `id` + FK ids alongside the existing names (it's otherwise complete).
7. **Compensation/Payroll** — decide: keep as human finance reports (leave as-is) **or** add a machine `payroll_entries` export (id + FKs + all fields). Recommend a separate migration export, keep the pretty report too.

### Phase 2 — Add exports to modules that have NONE
Add a `ToolbarExport` + a contract-compliant exporter to: **Pay rates**, **Promo codes**, **Marketing campaigns**, **Announcements**, **Business — Locations (branches + rooms + hours)**, **Services**, **Class templates + Categories**, **Shifts**, **Notification settings**. (Business/Locations is highest priority — it's the entity everything else FKs to.)

### Phase 3 — Add the child / relationship tables (full-migration completeness)
Export the tables a real migration needs, each with parent FKs: **Class bookings**, **Appointment bookings**, **Customer plans** (memberships/packages held), **Wallet transactions**, **Customer transactions** (POS/payment history), **Referrals**, **Customer agreements** (signatures), **Issued gift cards**. Surface these from their owning module (e.g. bookings from Bookings, transactions from POS/customer profile).

### Phase 4 — Reports migration mode + polish
- Add a **"Migration export"** option (or un-hide the ID/FK columns) so the Reports Excel/CSV includes every id column, not `hiddenByDefault`.
- Add **`branch_id`** (not just the display name) to the report column configs.
- Consistent filenames + the shared Excel path everywhere.

### Phase 5 — Verify round-trip
For each entity: export → feed to the AI-agent import wizard (or the future Supabase seed) → confirm every column maps and the record reconstructs (ids + FKs resolve). Retail is the reference for a working round-trip.

---

## 4. Priority (if done incrementally)
1. **Phase 0** (shared CSV+Excel foundation + column contract) — unblocks everything and makes Excel real.
2. **Business/Locations export** + **Customers/Staff/Roles** completeness (Phase 1 #1–2, Phase 2 branches) — the core entities + the branch table every FK points to.
3. Remaining Phase 1 (products, schedule, tax, agreements).
4. Phase 2 remainder + Phase 3 child tables.
5. Phase 4 reports migration-mode + Phase 5 round-trip verification.

## 5. Notes
- The **Dashboard "export"** is an analytics snapshot, not a data export — leave it as-is (not a migration target).
- Keep human-readable names in exports (alongside ids) — the goal is files that are both importable *and* readable, not raw id dumps.
- The single biggest lever is **Phase 0's column contract** (id + FK ids + status + full fields): applying it uniformly is what makes every export migration-complete.
