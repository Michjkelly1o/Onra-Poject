// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — /staff section layout
// ─────────────────────────────────────────────────────────────────────────────
//
// The Staff & Shifts DETAIL routes (/staff/members/[id], /staff/shifts/[id], …)
// live outside /admin, so the admin layout's <StaffFormPanelHost /> isn't mounted
// for them. Mounting it here makes the Edit staff / shift / blocked-time side
// panels open directly from the Staff Details + Shift Details pages, exactly the
// way they open from the main Staff list (client 2026-08).

import { StaffFormPanelHost } from "@/components/staff/StaffFormPanelHost";

export default function StaffSectionLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <StaffFormPanelHost />
        </>
    );
}
