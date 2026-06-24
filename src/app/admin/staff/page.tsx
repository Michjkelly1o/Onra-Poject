"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff & shift (/admin/staff)
// ─────────────────────────────────────────────────────────────────────────────
//
// Thin route — the shared page component lives at
// [src/components/staff/StaffPermissionsPage.tsx] and is locked here to the
// Staff tab via `forceTab="staff"`. The Roles tab lives at
// `/admin/staff/roles` (Role & permissions menu) which renders the same
// component with `forceTab="roles"`.
//
// Sub-tabs (Staff / Shift management / Blocked time) are owned by the
// shared component — see its top-level `staffSubTab` state.

import { StaffPermissionsPage } from "@/components/staff/StaffPermissionsPage";

export default function StaffShiftRoute() {
    return <StaffPermissionsPage forceTab="staff" />;
}
