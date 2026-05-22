// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `promo_codes` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// Discount codes applied at POS checkout (PRD 05) AND surfaced as marketing
// promo cards in the Promo module (PRD 06 §6). Every field here maps 1:1 to an
// input on the promo create form (`PromoFormPage`) or to system-derived info —
// so a row is exactly what `addPromoCode` would persist:
//   • identity / POS    — code / discount_type / discount_value / applies_to
//   • promo card display — name / description / banner_image_url / action /
//                          offer_type
//   • promo config       — valid_from / valid_until / countdown /
//                          first_time_only / usage_limit / per_customer_limit
//   • visibility         — branch_ids / multi_location / applies_to_product_ids
//                          / applies_to_class_ids / customer_targeting
//
// FK references are all live ids — branches (`branch_forma_*`), memberships
// (`mem_*`), packages (`pkg_*`) and class templates (`tpl_*`) — so the detail
// page resolves real names and the POS validator sees real promos.
//
// The four rows cover every status badge + every sidebar-action path:
//   • WEEKEND   — Active     (9 uses  → Deactivate path)
//   • WELCOME20 — Inactive   (12 uses → Reactivate, no Delete)
//   • SAVE75    — Active but past valid_until → "Expired"  (21 uses)
//   • RAMADAN   — Archived   (0 uses  → Delete path enabled)
//
// `code` is stored UPPERCASE so cart-side lookup can do a single .toUpperCase()
// before comparing.

import type { PromoCode } from "./_types";

const ALL_BRANCHES = ["branch_forma_south", "branch_forma_east", "branch_forma_west"];

export const promo_codes: PromoCode[] = [
    {
        // ── Active — book-a-class, free class ──
        id: "promo_weekend",
        code: "WEEKEND",
        discount_type: "percentage",
        discount_value: 1,
        applies_to: [],
        usage_count: 9,
        valid_from: "2026-05-01T08:00:00Z",
        valid_until: "2026-12-31T20:00:00Z",
        status: "active",
        name: "Weekend Workout Pass",
        description: "Make the most of your weekend with a free class on us — recharge, reset, and feel your best.",
        banner_image_url: "/images/promo/weekend-workout-pass.webp",
        action: "book_class",
        offer_type: "free_class",
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        created_at: "2026-04-20T09:00:00Z",
        countdown: true,
        first_time_only: false,
        per_customer_limit: 2,
        applies_to_product_ids: [],
        applies_to_class_ids: ["tpl_reformer_pilates", "tpl_barre", "tpl_hot_yoga", "tpl_roller_release"],
        customer_targeting: "all",
    },
    {
        // ── Inactive — buy-a-package, 20% off ──
        id: "promo_welcome20",
        code: "WELCOME20",
        discount_type: "percentage",
        discount_value: 20,
        applies_to: [],
        usage_limit: 50,
        usage_count: 12,
        valid_from: "2026-03-01T00:00:00Z",
        valid_until: "2026-11-30T00:00:00Z",
        status: "inactive",
        name: "20% Off First Purchase",
        description: "New members get 20% off their first membership or package — a warm welcome to the studio.",
        banner_image_url: "/images/promo/20-percent-off.webp",
        action: "buy_package",
        offer_type: "percentage",
        branch_ids: ["branch_forma_south", "branch_forma_east"],
        multi_location: true,
        created_at: "2026-02-18T10:30:00Z",
        countdown: false,
        first_time_only: true,
        per_customer_limit: 1,
        applies_to_product_ids: ["mem_beginner_monthly", "mem_advanced_monthly", "pkg_5_class", "pkg_10_class"],
        applies_to_class_ids: [],
        customer_targeting: "new_users",
    },
    {
        // ── Expired — buy-a-package, AED 75 off (valid_until in the past) ──
        id: "promo_save75",
        code: "SAVE75",
        discount_type: "fixed",
        discount_value: 75,
        applies_to: [],
        usage_count: 21,
        valid_from: "2025-09-01T00:00:00Z",
        valid_until: "2025-12-31T00:00:00Z",
        status: "active",
        name: "AED 75 Off Packages",
        description: "Take AED 75 off any class package and keep your momentum going for less.",
        banner_image_url: "/images/promo/aed-75-off.webp",
        action: "buy_package",
        offer_type: "fixed_amount",
        branch_ids: ALL_BRANCHES,
        multi_location: true,
        created_at: "2025-08-20T08:00:00Z",
        countdown: false,
        first_time_only: false,
        per_customer_limit: 3,
        applies_to_product_ids: ["pkg_5_class", "pkg_10_class", "pkg_20_class"],
        applies_to_class_ids: [],
        customer_targeting: "all",
    },
    {
        // ── Archived — book-a-class, free trial (0 uses → deletable) ──
        id: "promo_ramadan",
        code: "RAMADAN",
        discount_type: "percentage",
        discount_value: 1,
        applies_to: [],
        usage_limit: 100,
        usage_count: 0,
        valid_from: "2026-02-18T18:00:00Z",
        valid_until: "2026-04-09T23:00:00Z",
        status: "archived",
        name: "Ramadan Night Special",
        description: "A complimentary trial class for evening sessions throughout the holy month.",
        banner_image_url: "/images/promo/ramadan-night-special.webp",
        action: "book_class",
        offer_type: "free_trial",
        branch_ids: ["branch_forma_south"],
        multi_location: false,
        created_at: "2026-02-01T11:00:00Z",
        countdown: true,
        first_time_only: true,
        per_customer_limit: 1,
        applies_to_product_ids: [],
        applies_to_class_ids: ["tpl_hot_yoga", "tpl_roller_release"],
        customer_targeting: "new_users",
    },
];
