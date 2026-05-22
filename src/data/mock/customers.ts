// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `customers` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 10 customers. The first 5 use the portrait files from
// /public/images/customers/ so the schedule detail's roster shows mixed
// avatars (portraits + initials-only). The remaining 5 fall back to neutral
// initials avatars.
//
// `plan_kind` mix is intentional: 5 memberships + 4 packages + 1 no-plan
// — so the Payment confirmation modal has data for every variant
// (existing-plan + "Buy packages" / no-plan).
//
// Multi-package: Bosa Ahmed holds 2 different credit packages at once —
// surfaces the "select which package to use" radio picker in the Payment
// confirmation modal. Per CLAUDE.md a customer may hold 1 membership OR
// multiple packages — never both.
//
// FK: `branch_id` → branches.id, `membership_id` → memberships.id,
//     `package_ids` → packages.id[]
//
// All current customers are seeded under Forma Studio South (the main
// active branch) to keep schedule joins simple. East/West can pick up
// customers when those branches are exercised by a screen.

import type { Customer } from "./_types";

export const customers: Customer[] = [
    // ── 5 with portraits ────────────────────────────────────────────────────
    {
        id: "cust_ahmed_zayn",
        first_name: "Ahmed",
        last_name: "Zayn",
        initials: "AZ",
        email: "ahmed.zayn@email.com",
        phone: "+971 50 123 4567",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/ahmed-zayn.webp",
        plan_kind: "membership",
        membership_id: "mem_unlimited_monthly",
        plan_name: "Unlimited Monthly Membership",
        created_at: "2026-01-08T09:00:00Z",
        gender: "Male",
    },
    {
        id: "cust_ava_wright",
        first_name: "Ava",
        last_name: "Wright",
        initials: "AW",
        email: "ava.wright@email.com",
        phone: "+971 50 234 5678",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/ava-wright.webp",
        plan_kind: "membership",
        membership_id: "mem_advanced_monthly",
        plan_name: "Advanced Monthly Membership",
        created_at: "2026-01-09T09:00:00Z",
        gender: "Female",
        credits_remaining: 12,
    },
    {
        // Multi-package customer — holds 10-Class + 5-Class. Demos the
        // PaymentConfirmation radio picker.
        id: "cust_bosa_ahmed",
        first_name: "Bosa",
        last_name: "Ahmed",
        initials: "BA",
        email: "bosa.ahmed@email.com",
        phone: "+971 50 345 6789",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/bosa-ahmed.webp",
        plan_kind: "package",
        package_ids: ["pkg_10_class", "pkg_5_class"],
        plan_name: "10-Class Package for One Month",
        created_at: "2026-01-10T09:00:00Z",
        gender: "Male",
        credits_remaining: 8,
    },
    {
        id: "cust_rosale_martin",
        first_name: "Rosale",
        last_name: "Martin",
        initials: "RM",
        email: "rosale.martin@email.com",
        phone: "+971 50 456 7890",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/rosale-martin.webp",
        plan_kind: "package",
        package_ids: ["pkg_10_class"],
        plan_name: "10-Class Package for One Month",
        created_at: "2026-01-11T09:00:00Z",
        gender: "Female",
        credits_remaining: 6,
    },
    {
        id: "cust_zahra_mahen",
        first_name: "Zahra",
        last_name: "Mahen",
        initials: "ZM",
        email: "zahra.mahen@email.com",
        phone: "+971 50 567 8901",
        branch_id: "branch_forma_south",
        image_url: "/images/customers/zahra-mahen.webp",
        plan_kind: "membership",
        membership_id: "mem_unlimited_monthly",
        plan_name: "Unlimited Monthly Membership",
        created_at: "2026-01-12T09:00:00Z",
        gender: "Female",
    },

    // ── 5 with initials only ─────────────────────────────────────────────────
    {
        id: "cust_sophia_lee",
        first_name: "Sophia",
        last_name: "Lee",
        initials: "SL",
        email: "sophia.lee@email.com",
        phone: "+971 50 678 9012",
        branch_id: "branch_forma_south",
        plan_kind: "membership",
        membership_id: "mem_beginner_monthly",
        plan_name: "Beginner Monthly Membership",
        created_at: "2026-01-13T09:00:00Z",
        gender: "Female",
        credits_remaining: 0,
    },
    {
        id: "cust_james_taylor",
        first_name: "James",
        last_name: "Taylor",
        initials: "JT",
        email: "james.taylor@email.com",
        phone: "+971 50 789 0123",
        branch_id: "branch_forma_south",
        plan_kind: "package",
        package_ids: ["pkg_5_class"],
        plan_name: "5-Class Package for One Month",
        created_at: "2026-01-14T09:00:00Z",
        gender: "Male",
        credits_remaining: 3,
    },
    {
        id: "cust_fatima_al_sayed",
        first_name: "Fatima",
        last_name: "Al-Sayed",
        initials: "FA",
        email: "fatima.al-sayed@email.com",
        phone: "+971 50 890 1234",
        branch_id: "branch_forma_south",
        plan_kind: "membership",
        membership_id: "mem_unlimited_monthly",
        plan_name: "Unlimited Monthly Membership",
        created_at: "2026-01-15T09:00:00Z",
        gender: "Female",
    },
    {
        id: "cust_lucas_brown",
        first_name: "Lucas",
        last_name: "Brown",
        initials: "LB",
        email: "lucas.brown@email.com",
        branch_id: "branch_forma_south",
        plan_kind: "package",
        package_ids: ["pkg_10_class"],
        plan_name: "10-Class Package for One Month",
        created_at: "2026-01-16T09:00:00Z",
        gender: "Male",
        credits_remaining: 10,
    },
    {
        // Intentionally no plan — the Payment confirmation "Buy packages"
        // variant needs at least one customer to demo against.
        id: "cust_mia_anderson",
        first_name: "Mia",
        last_name: "Anderson",
        initials: "MA",
        email: "mia.anderson@email.com",
        branch_id: "branch_forma_south",
        plan_kind: null,
        created_at: "2026-01-17T09:00:00Z",
        gender: "Female",
    },
];
