// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings landing route
// ─────────────────────────────────────────────────────────────────────────────
//
// The settings module is now organized into 3 tabbed groups (Business /
// Operations / Customer) surfaced by the sidebar dropdown + the per-page
// tab bar (`SettingsGroupHeader`). The old 4-card grouped-menu landing
// became redundant once the sidebar dropdown existed — this route now
// redirects to the first tab of the first group so `/admin/settings`
// still resolves to a real page.
//
// Target = `SETTINGS_DEFAULT_HREF` (currently `/admin/settings/business-locations`).
// Changing `SETTINGS_GROUPS[0].tabs[0]` in `src/config/settings-groups.ts`
// automatically updates this landing target.

import { redirect } from "next/navigation";
import { SETTINGS_DEFAULT_HREF } from "@/config/settings-groups";

export default function SettingsLandingPage() {
    redirect(SETTINGS_DEFAULT_HREF);
}
