// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customer_agreements` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per (customer, agreement, version). Drives the customer-detail
// Agreements tab AND the new Acceptance status tab on the admin agreement
// detail page.
//
// Status split (v24):
//   • "signed"        — customer signed this version. Rendered green.
//   • "re_accept_due" — customer signed an OLDER version of the same
//                       agreement; the CURRENT version needs a fresh
//                       signature before the next booking. Rendered
//                       amber. `signed_at` retains the LAST-signed
//                       timestamp so the Acceptance table can show
//                       "Signed V4 · prompted at next booking".
//   • "never_signed"  — customer has NO signature on any version of
//                       this agreement. Rendered red. Surfaces in the
//                       Pending / never sub-tab.
//
// Cross-module use:
//   • Customer detail Agreements tab (per-customer view — filters
//     by customer_id).
//   • Admin agreement detail → Acceptance status tab (per-agreement
//     view — sub-tabs bucket by status on the CURRENT version).
//
// FK: `agreement_id` → `agreements.id`; `customer_id` → `customers.id`.

import type { CustomerAgreement } from "./_types";

const SOUTH = "branch_forma_south";
const WAIVER = "Waiver booking";
/** Templates the standard liability waiver covers. */
const COVERED = ["tpl_reformer_pilates", "tpl_barre", "tpl_hot_yoga"];

export const customer_agreements: CustomerAgreement[] = [
    // ─────────────────────────────────────────────────────────────────────
    // Bucket A — Signed CURRENT version (v5) → "All signed" sub-tab
    // ─────────────────────────────────────────────────────────────────────
    // Bosa Ahmed — signed v5 (and every prior version).
    { id: "agr_bosa_v5", customer_id: "cust_bosa_ahmed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-02-20T22:00:00Z" },
    { id: "agr_bosa_v4", customer_id: "cust_bosa_ahmed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-01-10T09:30:00Z" },
    { id: "agr_bosa_v3", customer_id: "cust_bosa_ahmed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-10-10T13:00:00Z" },
    { id: "agr_bosa_v2", customer_id: "cust_bosa_ahmed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-07-10T15:40:00Z" },

    // James Taylor — signed v5.
    { id: "agr_james_v5", customer_id: "cust_james_taylor", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",     signed_at: "2026-02-18T14:20:00Z" },
    { id: "agr_james_v4", customer_id: "cust_james_taylor", agreement_id: "agr_waiver_booking", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",     signed_at: "2026-01-14T14:20:00Z" },
    { id: "agr_james_v3", customer_id: "cust_james_taylor", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",     signed_at: "2025-10-14T10:45:00Z" },
    { id: "agr_james_v2", customer_id: "cust_james_taylor", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",     signed_at: "2025-07-14T12:15:00Z" },
    { id: "agr_james_v1", customer_id: "cust_james_taylor", agreement_id: "agr_waiver_booking", title: WAIVER, version: 1, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",     signed_at: "2025-04-14T08:00:00Z" },

    // ─────────────────────────────────────────────────────────────────────
    // Bucket B — Signed OLDER version, re-acceptance due on v5 →
    // "Needs re-acceptance" sub-tab
    // ─────────────────────────────────────────────────────────────────────
    // Ahmed Zayn — signed v4, needs to re-accept v5.
    { id: "agr_ahmed_v5", customer_id: "cust_ahmed_zayn", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "re_accept_due", signed_at: "2025-12-28T22:00:00Z" },
    { id: "agr_ahmed_v4", customer_id: "cust_ahmed_zayn", agreement_id: "agr_waiver_booking", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-12-28T22:00:00Z" },
    { id: "agr_ahmed_v3", customer_id: "cust_ahmed_zayn", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-09-28T18:30:00Z" },
    { id: "agr_ahmed_v2", customer_id: "cust_ahmed_zayn", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-06-28T14:00:00Z" },

    // Ava Wright — signed v4, needs re-accept v5.
    { id: "agr_ava_v5", customer_id: "cust_ava_wright", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "re_accept_due", signed_at: "2026-01-09T10:15:00Z" },
    { id: "agr_ava_v4", customer_id: "cust_ava_wright", agreement_id: "agr_waiver_booking", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-01-09T10:15:00Z" },
    { id: "agr_ava_v3", customer_id: "cust_ava_wright", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-10-09T16:45:00Z" },
    { id: "agr_ava_v2", customer_id: "cust_ava_wright", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-07-09T11:20:00Z" },

    // Rosale Martin — signed v4, needs re-accept v5.
    { id: "agr_rosale_v5", customer_id: "cust_rosale_martin", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "re_accept_due", signed_at: "2026-01-11T12:00:00Z" },
    { id: "agr_rosale_v4", customer_id: "cust_rosale_martin", agreement_id: "agr_waiver_booking", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-01-11T12:00:00Z" },
    { id: "agr_rosale_v3", customer_id: "cust_rosale_martin", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-09-11T17:10:00Z" },
    { id: "agr_rosale_v2", customer_id: "cust_rosale_martin", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-05-11T10:30:00Z" },

    // Sophia Lee — signed v4, needs re-accept v5.
    { id: "agr_sophia_v5", customer_id: "cust_sophia_lee", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "re_accept_due", signed_at: "2026-01-13T13:45:00Z" },
    { id: "agr_sophia_v4", customer_id: "cust_sophia_lee", agreement_id: "agr_waiver_booking", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-01-13T13:45:00Z" },
    { id: "agr_sophia_v3", customer_id: "cust_sophia_lee", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-10-13T09:50:00Z" },
    { id: "agr_sophia_v2", customer_id: "cust_sophia_lee", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-07-13T16:00:00Z" },

    // Fatima Al-Sayed — signed v4, needs re-accept v5.
    { id: "agr_fatima_v5", customer_id: "cust_fatima_al_sayed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "re_accept_due", signed_at: "2026-01-15T11:30:00Z" },
    { id: "agr_fatima_v4", customer_id: "cust_fatima_al_sayed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-01-15T11:30:00Z" },
    { id: "agr_fatima_v3", customer_id: "cust_fatima_al_sayed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-10-15T15:00:00Z" },
    { id: "agr_fatima_v2", customer_id: "cust_fatima_al_sayed", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-07-15T09:40:00Z" },

    // Zahra Mahen — signed v3, needs re-accept the newer v5 (skipped v4).
    { id: "agr_zahra_v5", customer_id: "cust_zahra_mahen", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "re_accept_due", signed_at: "2026-01-12T11:00:00Z" },
    { id: "agr_zahra_v3", customer_id: "cust_zahra_mahen", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-01-12T11:00:00Z" },
    { id: "agr_zahra_v2", customer_id: "cust_zahra_mahen", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-09-12T14:25:00Z" },

    // Lucas Brown — signed v3, needs re-accept the newer v5.
    { id: "agr_lucas_v5", customer_id: "cust_lucas_brown", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "re_accept_due", signed_at: "2026-01-16T16:30:00Z" },
    { id: "agr_lucas_v3", customer_id: "cust_lucas_brown", agreement_id: "agr_waiver_booking", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2026-01-16T16:30:00Z" },
    { id: "agr_lucas_v2", customer_id: "cust_lucas_brown", agreement_id: "agr_waiver_booking", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed",         signed_at: "2025-10-16T12:10:00Z" },

    // ─────────────────────────────────────────────────────────────────────
    // Bucket C — Never signed any version → "Pending / never" sub-tab
    // ─────────────────────────────────────────────────────────────────────
    // Mia Anderson — v5 never_signed (no prior signed row).
    { id: "agr_mia_v5", customer_id: "cust_mia_anderson", agreement_id: "agr_waiver_booking", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "never_signed" },
];
