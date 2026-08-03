"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail categories route (/admin/products/retail-categories)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-03 — Retail + Retail categories are now ONE page with tabs
// ("Products" / "Categories") at /admin/products/retail, mirroring the
// Memberships & Packages page. The standalone "Retail categories" sidebar
// entry was removed; this route stays only so old deep links keep working and
// renders the exact same view as the Categories tab.

import { RetailCategoriesView } from "@/components/retail/RetailCategoriesView";

export default function RetailCategoriesPage() {
    return <RetailCategoriesView />;
}
