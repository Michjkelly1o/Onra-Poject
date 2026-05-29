// ─────────────────────────────────────────────────────────────────────────────
// /admin/instructors — Permanent redirect to /admin/staff
// ─────────────────────────────────────────────────────────────────────────────
//
// The dedicated Instructors module folded into the unified Staff &
// Permissions module (Phase 1 of the Staff & Permissions roll-out). Any
// existing bookmarks / deep links land here and forward to the new page so
// nothing 404s.

import { redirect } from "next/navigation";

export default function InstructorsRedirect() {
    redirect("/admin/staff");
}
