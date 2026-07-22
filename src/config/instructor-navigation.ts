// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor sidebar nav config
// ─────────────────────────────────────────────────────────────────────────────
//
// Drives the instructor experience's sidebar (Figma 6262:338716). Same
// shape + same `Sidebar` component as the admin nav — only the items differ.
//
// Routes mirror the existing `/instructor/*` namespace already used by the
// older instructor layout. The Dashboard route is new (this module); the
// other three are placeholders the user will design + build out next.

import { BarChartSquare02, CalendarDate, BankNote01, AlarmClockOff } from "@untitledui/icons";
import type { NavItemDef } from "@/components/layout/Sidebar";

/** Top-level routes for the instructor. Account settings is
 *  intentionally NOT here — it lives in the bottom-of-sidebar profile
 *  popover the shared `Sidebar` component already renders (same UX
 *  pattern the admin uses for Account settings).
 *
 *  Client 2026-07-22 Phase 7 added "Time off" so instructors can log
 *  their own annual leave / sick days without waiting for admin. Entries
 *  land in the admin Time off tab immediately (no approval flow). */
export const INSTRUCTOR_NAV_ITEMS: NavItemDef[] = [
    { label: "Dashboard", href: "/instructor/dashboard", icon: BarChartSquare02 },
    { label: "Schedule",  href: "/instructor/schedule",  icon: CalendarDate },
    { label: "Earnings",  href: "/instructor/earnings",  icon: BankNote01 },
    { label: "Time off",  href: "/instructor/time-off",  icon: AlarmClockOff },
];
