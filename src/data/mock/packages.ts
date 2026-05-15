// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `packages` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 4 credit packages available for sale in the POS. Prices in AED.
//
// Reconciles two previous inline arrays:
//   - schedule/[classId]/page.tsx `POS_PRODUCTS` had p1/p2/p3 (1/5/10 Class)
//   - class-types/[id]/page.tsx `PACKAGES` had p1-p4 (10/20/30/40 Class)
// Resolved to: 1-Class Intro / 5-Class / 10-Class / 20-Class.
//
// Per-class price decreases with bulk (170 → 150 → 139 → 120) to reflect a
// realistic bulk-discount.

import type { Package } from "./_types";

export const packages: Package[] = [
    {
        id: "pkg_1_class_intro",
        name: "1-Class Intro Package for 7 Days",
        description: "Single drop-in class — great for first-time visitors.",
        credits: 1,
        validity_days: 7,
        price_aed: 170,
        status: "active",
    },
    {
        id: "pkg_5_class",
        name: "5-Class Package for One Month",
        description: "5 credits, valid 30 days. Best for occasional practice.",
        credits: 5,
        validity_days: 30,
        price_aed: 750,
        status: "active",
    },
    {
        id: "pkg_10_class",
        name: "10-Class Package for One Month",
        description: "10 credits, valid 30 days. The popular bulk pack.",
        credits: 10,
        validity_days: 30,
        price_aed: 1390,
        status: "active",
    },
    {
        id: "pkg_20_class",
        name: "20-Class Package for Two Months",
        description: "20 credits, valid 60 days. Best value per class.",
        credits: 20,
        validity_days: 60,
        price_aed: 2400,
        status: "active",
    },
];
