// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports registry (source of truth for the 32 reports)
// ─────────────────────────────────────────────────────────────────────────────
//
// See new-prd/reports-implementation-plan.md §2.4 for the registry pattern.
//
// Every report is one entry in `REPORTS_REGISTRY` (Phase 3 onward). The
// shell reads the entry + calls the resolved selector to get rows, then
// renders the pivot / list based on the user's toolbar state.
//
// This file ships in Phase 2 as scaffolding — empty registry, working
// dispatch table, lookup helpers. Phase 3 adds Total Sales (reference
// implementation). Phase 4 adds the remaining 31 reports in 6 batches.
//
// The registry is a MODULE-LEVEL CONSTANT — not derived at runtime, not
// held in the store. Adding a report requires exactly one file change
// (this file) and no schema migration.

import type { AppState } from "@/lib/store";
import type {
    ReportDefinition,
    ReportCategory,
    SelectorName,
} from "@/lib/reports/types";
import {
    selectTransactionLedger,
    selectPayments,
    selectCustomers,
    selectGiftCards,
    selectMemberships,
} from "@/lib/reports/selectors";
import { TOTAL_SALES_REPORT }         from "./reports/total-sales";
import { SALES_BY_CATEGORY_REPORT }   from "./reports/sales-by-category";
import { PAYMENTS_REPORT }            from "./reports/payments";
import { REFUNDS_REPORT }             from "./reports/refunds";
import { DISCOUNTS_REPORT }           from "./reports/discounts";
import { SALES_BY_ITEM_REPORT }       from "./reports/sales-by-item";
import { GIFT_CARDS_REPORT }          from "./reports/gift-cards";
import { TAX_VAT_EXPORT_REPORT }      from "./reports/tax-vat-export";
import { REVENUE_RECOGNITION_REPORT } from "./reports/revenue-recognition";
import { MEMBERSHIPS_PACKAGES_REPORT }from "./reports/memberships-packages";
import { FROZEN_REPORT }              from "./reports/frozen";
import { INTRO_OFFERS_REPORT }        from "./reports/intro-offers";
import { UPGRADES_DOWNGRADES_REPORT } from "./reports/upgrades-downgrades";
import { MRR_REPORT }                 from "./reports/mrr";
import { ARPM_REPORT }                from "./reports/arpm";
import { REVENUE_PER_CLASS_REPORT }   from "./reports/revenue-per-class";

// ─── Selector dispatch table ──────────────────────────────────────────────
//
// Maps SelectorName strings (from ReportDefinition.selector) to the actual
// selector functions. The registry entries reference selectors by NAME
// (not function reference) so the registry stays serializable + easy to
// diff. The shell reads registry.selector, looks it up here, and invokes.
//
// Deferred selectors (Phase 4) throw a clear error message if a report
// tries to use one before its selector ships. Better than silently
// returning [] — a Phase 3 report accidentally wired to a Phase 4 selector
// gets caught immediately.

type SelectorFn = (state: AppState) => Record<string, unknown>[];

const DEFERRED = (name: string): SelectorFn => (): Record<string, unknown>[] => {
    throw new Error(
        `[reports] Selector "${name}" is not implemented yet — pending Phase 4. ` +
        `See new-prd/reports-implementation-plan.md §3 for the batch schedule.`,
    );
};

// Row-type erasure — each selector produces its own typed row shape
// (LedgerRow, PaymentRow, etc.). At the dispatch boundary we widen to
// `Record<string, unknown>[]` so the shell can consume any selector
// uniformly. The `unknown` cast is safe because selectors always emit
// object rows and the shell's ColumnDef.key lookup handles missing
// fields gracefully — see PivotableReportShell (Checkpoint 2D).
export const SELECTOR_DISPATCH: Record<SelectorName, SelectorFn> = {
    // Phase 1 — shipped
    selectTransactionLedger: selectTransactionLedger as unknown as SelectorFn,
    selectPayments:           selectPayments           as unknown as SelectorFn,
    selectCustomers:          selectCustomers          as unknown as SelectorFn,
    // Phase 4B — shipped
    selectGiftCards:          selectGiftCards          as unknown as SelectorFn,
    // Phase 4C — shipped
    selectMemberships:        selectMemberships        as unknown as SelectorFn,

    // Phase 4 — deferred (throws with a clear error if used prematurely)
    selectBookings:           DEFERRED("selectBookings"),
    selectClassSessions:      DEFERRED("selectClassSessions"),
    selectReferrals:          DEFERRED("selectReferrals"),
};

// ─── The registry ─────────────────────────────────────────────────────────
//
// Phase 3 fills this with Total Sales. Phase 4 batches (A-F) fill the
// other 31. The order here drives display order on /admin/reports.

export const REPORTS_REGISTRY: ReportDefinition[] = [
    // Phase 3 · Reference implementation
    TOTAL_SALES_REPORT,

    // Phase 4A · Financial batch 1
    SALES_BY_CATEGORY_REPORT,
    PAYMENTS_REPORT,
    REFUNDS_REPORT,
    DISCOUNTS_REPORT,

    // Phase 4B · Financial batch 2
    SALES_BY_ITEM_REPORT,
    GIFT_CARDS_REPORT,
    TAX_VAT_EXPORT_REPORT,
    REVENUE_RECOGNITION_REPORT,

    // Phase 4C · Financial + Membership
    REVENUE_PER_CLASS_REPORT,
    ARPM_REPORT,
    MRR_REPORT,
    MEMBERSHIPS_PACKAGES_REPORT,
    FROZEN_REPORT,
    INTRO_OFFERS_REPORT,
    UPGRADES_DOWNGRADES_REPORT,

    // Phase 4D · Client + Activity
    //   Customer Data · Member Movement · Retention & Churn · Win-back
    //   Bookings · Cancellations & No-shows

    // Phase 4E · Class + Staff
    //   Class Performance · Top Classes & Services · Instructor Performance
    //   Staff Attendance

    // Phase 4F · Marketing
    //   Referral · Promo Redemptions · Campaign Performance · Lead Data
    //   Lead Conversion · Acquisition Efficiency
];

// ─── Registry lookup helpers ──────────────────────────────────────────────

/** Find a report by its slug id. Returns null if not registered. Reports
 *  route pages call this to resolve their definition from the URL param. */
export function getReportById(id: string): ReportDefinition | null {
    return REPORTS_REGISTRY.find(r => r.id === id) ?? null;
}

/** All reports in a given category, in registry order. Feeds the landing
 *  page's category cards. */
export function getReportsByCategory(category: ReportCategory): ReportDefinition[] {
    return REPORTS_REGISTRY.filter(r => r.category === category);
}

/** Resolve a report's selector function from its registry entry. Throws
 *  if the selector isn't wired in the dispatch table (defensive). */
export function resolveSelector(report: ReportDefinition): SelectorFn {
    const fn = SELECTOR_DISPATCH[report.selector];
    if (!fn) {
        throw new Error(
            `[reports] No dispatch entry for selector "${report.selector}" ` +
            `(referenced by report "${report.id}"). Add it to SELECTOR_DISPATCH ` +
            `in src/config/reports-registry.ts.`,
        );
    }
    return fn;
}

// ─── Landing-page category metadata ───────────────────────────────────────
//
// One entry per section on `/admin/reports`. Category order + labels
// come from the Excel spec Sheet 1 exactly.

export interface CategoryMeta {
    id: ReportCategory;
    label: string;
    description: string;
}

export const CATEGORY_META: CategoryMeta[] = [
    {
        id: "financial",
        label: "Financial reports",
        description: "Track studio performance — total sales, payments, refunds, discounts, tax, revenue recognition and per-member / per-class economics.",
    },
    {
        id: "membership_package",
        label: "Membership & Package",
        description: "Active plans, freezes, intro offers, and plan changes over time.",
    },
    {
        id: "customer",
        label: "Client / Customer",
        description: "Customer lifecycle — active vs inactive, sign-ups, churn, retention, win-back.",
    },
    {
        id: "class",
        label: "Activity / Class",
        description: "Bookings, class performance, cancellations, no-shows, and the top classes / services.",
    },
    {
        id: "staff",
        label: "Staff / Instructor",
        description: "Instructor performance and staff attendance (owner / manager / payroll only).",
    },
    {
        id: "marketing",
        label: "Marketing",
        description: "Leads, campaigns, promos, referrals, and acquisition efficiency.",
    },
];
