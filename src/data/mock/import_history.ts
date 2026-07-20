// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `import_history` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per completed AI Agent migration/import run. Feeds the
// Settings → Operations → "Migration & imports" table (Figma 196:99889).
//
// Seed mix (client 2026-07-20): 6 rows spanning the four core entity
// types the AI Agent supports today (customers / staff / memberships /
// packages). Rows land across two active branches (South + East) so the
// location filter in the toolbar has real data to slice on. One row has
// invalid_rows > 0 to demonstrate the error-report link + red "Invalid
// rows" cell; the others are clean full imports.
//
// FK: `branch_id` → branches.id
//
// Related module: the ONRA AI-Agent sibling project at
// `ONRA AI-Agent/lib/migration/MigrationStore.ts` — its `commit()` path
// is what will eventually write these rows in production. Until then the
// module renders from this seed + any pending rows admins add through
// the (still-unbuilt) /migrations-imports/new placeholder route.

import type { ImportHistorySeed } from "./_types";

const SOUTH = "branch_forma_south";
const EAST  = "branch_forma_east";

export const import_history: ImportHistorySeed[] = [
    // ── Feb 1, 2026 batch — 3-row initial migration from a legacy CRM
    //    (matches the Figma populated screenshot's three example rows). ──
    {
        id: "imp_001",
        data_type: "customers",
        file_name: "Customer file.csv",
        file_type: "csv",
        total_rows: 250,
        imported_rows: 230,
        invalid_rows: 20,
        invalid_rows_file_name: "Invalid rows data report.xlsx",
        status: "imported",
        imported_at: "2026-02-01T09:14:00Z",
        branch_id: SOUTH,
    },
    {
        id: "imp_002",
        data_type: "staff",
        file_name: "Staff file.csv",
        file_type: "csv",
        total_rows: 230,
        imported_rows: 230,
        invalid_rows: 0,
        status: "imported",
        imported_at: "2026-02-01T09:26:00Z",
        branch_id: SOUTH,
    },
    {
        id: "imp_003",
        data_type: "memberships",
        file_name: "Membership file.csv",
        file_type: "csv",
        total_rows: 230,
        imported_rows: 230,
        invalid_rows: 0,
        status: "imported",
        imported_at: "2026-02-01T09:41:00Z",
        branch_id: SOUTH,
    },
    // ── Later top-ups — smaller imports as the studio onboarded more
    //    data. Spread across branches + a partial + a failed row so the
    //    Status filter has all four states to demonstrate. ──
    {
        id: "imp_004",
        data_type: "packages",
        file_name: "Packages_Feb15.csv",
        file_type: "csv",
        total_rows: 42,
        imported_rows: 42,
        invalid_rows: 0,
        status: "imported",
        imported_at: "2026-02-15T14:02:00Z",
        branch_id: EAST,
    },
    {
        id: "imp_005",
        data_type: "customers",
        file_name: "east_customers_march.xlsx",
        file_type: "xlsx",
        total_rows: 88,
        imported_rows: 71,
        invalid_rows: 17,
        invalid_rows_file_name: "east_customers_march-errors.xlsx",
        status: "partial",
        imported_at: "2026-03-04T11:18:00Z",
        branch_id: EAST,
    },
    {
        id: "imp_006",
        data_type: "class_templates",
        file_name: "class_templates_v3.csv",
        file_type: "csv",
        total_rows: 18,
        imported_rows: 0,
        invalid_rows: 18,
        invalid_rows_file_name: "class_templates_v3-errors.xlsx",
        status: "failed",
        imported_at: "2026-03-10T16:45:00Z",
        branch_id: SOUTH,
    },
];
