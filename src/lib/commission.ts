// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Commission categories: labels + ordering
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for how a `CommissionCategory` is presented across
// the app (Pay-rate form category dropdown, Payroll detail breakdown, future
// reporting). Import from here everywhere a category is shown so every surface
// reads/labels the same way.
//
// See new-prd/commission-refactor-implementation-plan.md — categories are a
// fixed enum (not tied to service categories). Retail is stubbed until the
// retail POS flow ships.

import type { CommissionCategory } from "@/lib/store";

/** Full labels — category dropdown + payroll breakdown rows. */
export const COMMISSION_CATEGORY_LABEL: Record<CommissionCategory, string> = {
    membership:       "Membership",
    credit_package:   "Credit package",
    gift_card:        "Gift card",
    retail:           "Retail",
    class_booking:    "Class",
    service_private:  "Private session",
    service_recovery: "Recovery & wellness",
};

/** Display order for the category dropdown — products first (POS-sold), then
 *  the booking-attributed categories (class / service). */
export const COMMISSION_CATEGORY_ORDER: CommissionCategory[] = [
    "membership",
    "credit_package",
    "gift_card",
    "retail",
    "class_booking",
    "service_private",
    "service_recovery",
];
