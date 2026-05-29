// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customer_agreements` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per agreement version a customer has been issued — the data behind
// the customer-detail "Agreements" tab. Each row records whether THIS
// customer signed that version, where, and when.
//
// The dedicated Agreements module doesn't exist yet; this seed stands in so
// the tab is fully functional (table + filter + "View agreement" action).
//
// Status mix is intentional: the newest version is often `unsigned` (the
// customer hasn't re-signed the latest waiver), older versions `signed` —
// so the Status filter has data for both buckets.
//
// FK: `customer_id` → customers.id, `branch_id` → branches.id,
//     `class_template_ids` → class_templates.id[]

import type { CustomerAgreement } from "./_types";

const SOUTH = "branch_forma_south";
const WAIVER = "New Liability Waiver";
/** Templates the standard liability waiver covers. */
const COVERED = ["tpl_reformer_pilates", "tpl_barre", "tpl_hot_yoga"];

export const customer_agreements: CustomerAgreement[] = [
    // ── Ahmed Zayn ───────────────────────────────────────────────────────────
    { id: "agr_ahmed_v5", customer_id: "cust_ahmed_zayn", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_ahmed_v4", customer_id: "cust_ahmed_zayn", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-12-28T22:00:00Z" },
    { id: "agr_ahmed_v3", customer_id: "cust_ahmed_zayn", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-09-28T18:30:00Z" },
    { id: "agr_ahmed_v2", customer_id: "cust_ahmed_zayn", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-06-28T14:00:00Z" },

    // ── Ava Wright ───────────────────────────────────────────────────────────
    { id: "agr_ava_v5", customer_id: "cust_ava_wright", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_ava_v4", customer_id: "cust_ava_wright", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-09T10:15:00Z" },
    { id: "agr_ava_v3", customer_id: "cust_ava_wright", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-10-09T16:45:00Z" },
    { id: "agr_ava_v2", customer_id: "cust_ava_wright", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-07-09T11:20:00Z" },

    // ── Bosa Ahmed — all signed ──────────────────────────────────────────────
    { id: "agr_bosa_v4", customer_id: "cust_bosa_ahmed", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-10T09:30:00Z" },
    { id: "agr_bosa_v3", customer_id: "cust_bosa_ahmed", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-10-10T13:00:00Z" },
    { id: "agr_bosa_v2", customer_id: "cust_bosa_ahmed", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-07-10T15:40:00Z" },

    // ── Rosale Martin ────────────────────────────────────────────────────────
    { id: "agr_rosale_v5", customer_id: "cust_rosale_martin", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_rosale_v4", customer_id: "cust_rosale_martin", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-11T12:00:00Z" },
    { id: "agr_rosale_v3", customer_id: "cust_rosale_martin", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-09-11T17:10:00Z" },
    { id: "agr_rosale_v2", customer_id: "cust_rosale_martin", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-05-11T10:30:00Z" },

    // ── Zahra Mahen ──────────────────────────────────────────────────────────
    { id: "agr_zahra_v4", customer_id: "cust_zahra_mahen", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_zahra_v3", customer_id: "cust_zahra_mahen", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-12T11:00:00Z" },
    { id: "agr_zahra_v2", customer_id: "cust_zahra_mahen", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-09-12T14:25:00Z" },

    // ── Sophia Lee ───────────────────────────────────────────────────────────
    { id: "agr_sophia_v5", customer_id: "cust_sophia_lee", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_sophia_v4", customer_id: "cust_sophia_lee", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-13T13:45:00Z" },
    { id: "agr_sophia_v3", customer_id: "cust_sophia_lee", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-10-13T09:50:00Z" },
    { id: "agr_sophia_v2", customer_id: "cust_sophia_lee", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-07-13T16:00:00Z" },

    // ── James Taylor — all signed ────────────────────────────────────────────
    { id: "agr_james_v3", customer_id: "cust_james_taylor", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-14T14:20:00Z" },
    { id: "agr_james_v2", customer_id: "cust_james_taylor", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-10-14T10:45:00Z" },
    { id: "agr_james_v1", customer_id: "cust_james_taylor", title: WAIVER, version: 1, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-07-14T12:15:00Z" },

    // ── Fatima Al-Sayed ──────────────────────────────────────────────────────
    { id: "agr_fatima_v5", customer_id: "cust_fatima_al_sayed", title: WAIVER, version: 5, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_fatima_v4", customer_id: "cust_fatima_al_sayed", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-15T11:30:00Z" },
    { id: "agr_fatima_v3", customer_id: "cust_fatima_al_sayed", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-10-15T15:00:00Z" },
    { id: "agr_fatima_v2", customer_id: "cust_fatima_al_sayed", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-07-15T09:40:00Z" },

    // ── Lucas Brown ──────────────────────────────────────────────────────────
    { id: "agr_lucas_v4", customer_id: "cust_lucas_brown", title: WAIVER, version: 4, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_lucas_v3", customer_id: "cust_lucas_brown", title: WAIVER, version: 3, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-16T16:30:00Z" },
    { id: "agr_lucas_v2", customer_id: "cust_lucas_brown", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2025-10-16T12:10:00Z" },

    // ── Mia Anderson — new customer, latest waiver still unsigned ────────────
    { id: "agr_mia_v2", customer_id: "cust_mia_anderson", title: WAIVER, version: 2, branch_id: SOUTH, class_template_ids: COVERED, status: "unsigned" },
    { id: "agr_mia_v1", customer_id: "cust_mia_anderson", title: WAIVER, version: 1, branch_id: SOUTH, class_template_ids: COVERED, status: "signed", signed_at: "2026-01-17T10:00:00Z" },
];
