"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Role & permissions (/admin/staff/roles)
// ─────────────────────────────────────────────────────────────────────────────
//
// Thin route — renders the shared `StaffPermissionsPage` locked to its
// Roles tab. The page handles the "Add role" button + roles-only chrome
// internally via the `forceTab` prop, so every role action (add / edit /
// archive / deactivate / delete) still flows through the same code path
// as the staff route.

import { StaffPermissionsPage } from "@/components/staff/StaffPermissionsPage";

export default function RolesPermissionsRoute() {
    return <StaffPermissionsPage forceTab="roles" />;
}
