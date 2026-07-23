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

import { Suspense } from "react";
import { StaffPermissionsPage } from "@/components/staff/StaffPermissionsPage";

export default function StaffShiftRoute() {
    // Suspense boundary — StaffPermissionsPage reads `?subtab=` via
    // useSearchParams() to deep-link back to a sub-tab (e.g. Edit time-off
    // Back → Time off), which Next.js requires to be wrapped for the
    // static-export bailout.
    return (
        <Suspense fallback={null}>
            <StaffPermissionsPage forceTab="staff" />
        </Suspense>
    );
}
