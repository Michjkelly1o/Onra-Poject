"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Class categories (/admin/categories) — legacy deep-link route
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-07 — Class templates + Class categories merged into one
// "Class" menu under Products, tabbed like Memberships & Packages. Categories
// now live as the second tab on /admin/class-types. This standalone route is
// no longer in the sidebar, but is kept alive (and DRY) so any existing
// deep-link still resolves — it renders the same shared ClassCategoriesView
// used by the merged page's Categories tab.

import { ClassCategoriesView } from "@/components/classes/ClassCategoriesView";

export default function CategoriesPage() {
    return <ClassCategoriesView />;
}
