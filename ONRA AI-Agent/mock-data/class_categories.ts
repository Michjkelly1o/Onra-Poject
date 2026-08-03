// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `class_categories` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 3 categories. Each carries a `color_hex` resolved from `tokens.json` — used
// as the tile background on day/week/month schedule views, on category badges,
// and on filter chips. Renderers read this hex directly so they don't depend
// on the design-token system at runtime.
//
// Color mapping (per MOCK_DATA_PLAN.md §3.9):
//   Pilates → secondary-50 (#e9fff3) — Brand / Primary (the app's sage)
//   Barre   → brand-50     (#e9fbff) — Brand / Secondary (cyan)
//   Yoga    → warning-50   (#fff8e9) — Brand / Tertiary (warm amber)

import type { ClassCategory } from "./_types";

export const class_categories: ClassCategory[] = [
    {
        id: "cat_pilates",
        name: "Pilates",
        color_hex: "#e9fff3",
        status: "active",
    },
    {
        id: "cat_barre",
        name: "Barre",
        color_hex: "#e9fbff",
        status: "active",
    },
    {
        id: "cat_yoga",
        name: "Yoga",
        color_hex: "#fff8e9",
        status: "active",
    },
];
