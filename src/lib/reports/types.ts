// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · shared type definitions
// ─────────────────────────────────────────────────────────────────────────────
//
// The typed vocabulary every report + the shared shell speak. See
// new-prd/reports-implementation-plan.md §2.4 for how these plug into
// the registry.
//
// Design rules:
//   1. Every column/dimension/measure is defined ONCE per report in the
//      registry — the shell reads config, never hardcodes.
//   2. Row shape is generic (`Record<string, unknown>`) at the shell
//      level so ONE shell serves 32 reports without knowing each row
//      type. TypeScript strictness lives inside each selector.
//   3. Selector names are strings, not function references. Keeps the
//      registry serializable + Supabase-migration-friendly (post-demo,
//      the string maps to a Supabase query name instead of a Zustand
//      selector).

// ─── Category (matches the 6 sections of the /admin/reports landing) ──────

export type ReportCategory =
    | "financial"          // 12 reports (Total Sales, Payments, Refunds, ...)
    | "membership_package" //  4 reports (Memberships & Packages, Frozen, ...)
    | "customer"           //  4 reports (Customer Data, Retention, Win-back, ...)
    | "class"              //  4 reports (Bookings, Class Performance, ...)
    | "staff"              //  2 reports (Instructor Performance, Staff Attendance)
    | "marketing";         //  6 reports (Referral, Promo, Campaign, Lead, ...)

/** Report kind:
 *  - "lookback" — pivotable by period (Total Sales, Refunds, Bookings, ...)
 *  - "snapshot" — point-in-time (MRR, Gift Card, Frozen, ...). Skip Period pill.
 */
export type ReportType = "lookback" | "snapshot";

// ─── Period bucketing (Excel spec: day / week / month / quarter / year) ───

/** Period granularity for pivot columns. "none" = flat list mode. */
export type PeriodKey = "none" | "day" | "week" | "month" | "quarter" | "year";

// ─── Column, dimension, measure definitions ───────────────────────────────

/** Column kind — drives cell formatting in the shell. */
export type ColumnKind =
    | "text"       // free text (customer name, item)
    | "date"       // ISO date → "DD Mmm YYYY" display
    | "currency"   // AED with thousands separator
    | "number"     // integer, tabular-num alignment
    | "percent"    // 0.15 → "15.0%"
    | "id"         // short id, mono font
    | "status";    // colored badge

/** Column definition — matches the Excel spec exactly (labels come from
 *  Sheet 2 "Report Columns" verbatim). */
export interface ColumnDef {
    /** Field name on the row object. E.g. "customerName", "signedAmount". */
    key: string;
    /** Header label — matches Excel spec verbatim. */
    label: string;
    /** Cell rendering kind. */
    kind: ColumnKind;
    /** Formula text from Excel column C ("Gross − Discount", "Attendees ÷
     *  Sessions"). Shown in a "column info" tooltip. `null` on raw fields. */
    calc?: string;
    /** Text alignment override. Number/currency/percent right-align by default. */
    align?: "left" | "right";
    /** Hide by default; user shows via Select column dropdown. Every
     *  hidden-by-default column stays in the CSV export unless the user
     *  explicitly deselects it — matches how spreadsheet apps handle it. */
    hiddenByDefault?: boolean;
    /** Column width hint (px) — the shell uses it as a min-width. Wide
     *  columns (customer name, item description) can specify > 200. */
    minWidth?: number;
}

/** Breakdown dimension — becomes the rows-down-the-side when Period != "none".
 *  When Period === "none" AND a dimension is selected, the list mode groups
 *  by the dimension (small headers between groups). */
export interface DimensionDef {
    key: string;
    label: string;
    /** How to extract the group key from a row. Falls back to "—" when
     *  the source field is empty. */
    extract: (row: Record<string, unknown>) => string;
}

/** Measure — the numeric field to aggregate in pivot mode. Reports with
 *  Net/Gross toggle define TWO measures; the shell shows the active one.
 *  A count-style measure ("Transactions", "Bookings") counts rows. */
export interface MeasureDef {
    key: string;
    label: string;
    /** Extract the numeric value from a row. For count-style measures,
     *  return 1 per row. */
    extract: (row: Record<string, unknown>) => number;
    /** Formatting kind — currency for AED, number for counts, percent for rates. */
    kind: "currency" | "number" | "percent";
}

// ─── RBAC (registry-driven access control) ────────────────────────────────

/** Access rule on a report. `admin` = full studio view; `instructor:self`
 *  = instructor sees only own classes; `customer:self` = customer sees
 *  only own record (not wired until customer module is complete). */
export type RbacRule = "admin" | "instructor:self" | "customer:self";

// ─── Selector name — string-based dispatch (not a function reference) ─────

/** Named selectors. The shell looks up the actual function from a
 *  dispatch table in the registry. Adding a new selector = extending
 *  this union + wiring the dispatch entry. */
export type SelectorName =
    | "selectTransactionLedger"  // Phase 1 (shipped)
    | "selectPayments"           // Phase 1 (shipped)
    | "selectCustomers"          // Phase 1 (shipped)
    | "selectMemberships"        // Phase 4C (shipped)
    | "selectBookings"           // Phase 4D (shipped)
    | "selectClassSessions"      // Phase 4E (shipped)
    | "selectGiftCards"          // Phase 4B (shipped)
    | "selectReferrals"          // Phase 4F (shipped)
    | "selectLeads"              // Reports v33 — shipped
    | "selectCampaigns"          // Reports v33 — shipped
    | "selectMarketingSpend"     // Reports v33 — shipped
    | "selectStaffAttendanceLog";// Reports v33 — shipped

// ─── Full report registry entry ───────────────────────────────────────────

/** One entry per report in `src/config/reports-registry.ts`. See the plan
 *  doc §2.4 for the registry usage pattern. */
export interface ReportDefinition {
    /** URL slug — matches the existing route so bookmarks keep working.
     *  E.g. "total-sales" → /reports/total-sales. */
    id: string;
    category: ReportCategory;
    /** Human title (matches Excel spec exactly). */
    title: string;
    /** One-sentence purpose — shown on the landing card + as page subtitle. */
    description: string;
    type: ReportType;
    /** Full route path (e.g. "/reports/total-sales"). */
    route: string;
    /** Selector name — dispatched via the registry's lookup table. */
    selector: SelectorName;
    /** All columns — user shows/hides via Select column. Order = display order. */
    columns: ColumnDef[];
    /** Break-down options. Empty for snapshot reports. */
    dimensions: DimensionDef[];
    /** Supported period options. Snapshot reports → ["none"]. Lookback
     *  reports typically → ["none", "day", "week", "month", "quarter", "year"]
     *  but a report may restrict this (e.g. no "day" if data is monthly). */
    periods: PeriodKey[];
    /** Measures — the pill's Net/Gross-style switcher options. */
    measures: MeasureDef[];
    /** RBAC — who sees this report. */
    rbac: RbacRule[];
    /** Which field to bucket by period. Defaults to "createdAtISO" but
     *  reports over `paymentDateISO` / `dateISO` etc. override this. */
    periodField?: string;
}

// ─── Pivot result shape (what pivotRows() returns) ────────────────────────

/** A single cell in the pivot matrix. */
export interface PivotCell {
    /** Row (dimension) key. */
    rowKey: string;
    /** Column (period) key. */
    colKey: string;
    /** Aggregated value. */
    value: number;
}

/** Result of pivoting a rowset. Consumers render this directly. */
export interface PivotResult {
    /** Ordered dimension row keys — sorted by row total DESC. Contains
     *  ["All"] when no breakdown dimension is selected. */
    rowKeys: string[];
    /** Ordered period column keys — sorted ASC. */
    colKeys: string[];
    /** Matrix lookup — M[rowKey][colKey] = value (missing cells = 0). */
    matrix: Record<string, Record<string, number>>;
    /** Total per row. */
    rowTotals: Record<string, number>;
    /** Total per column (period). */
    colTotals: Record<string, number>;
    /** Grand total. */
    grandTotal: number;
    /** Delta % between each column and the previous one. The first column
     *  is always null (no previous to compare). Positive = up, negative = down. */
    columnDeltasPct: (number | null)[];
}
