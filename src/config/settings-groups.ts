// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings groups (Business / Operations / Customer)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client-approved regrouping of the settings module (Figma-verified). Every
// settings page under `/admin/settings/*` belongs to exactly ONE group, and
// each group renders as a horizontal tab bar at the top of every page in
// that group.
//
// Ownership map:
//
//   Business    → Business & locations · Branding
//   Operations  → Booking rules · Tax · Integrations
//   Customer    → Customer notifications · Agreements
//
// Freeze policy retired Jul 2026 — the summary card moved under Booking
// rules (alongside Cancellation policy). Same `freezePolicy` store slice
// + same `FreezePolicyPanel` — only the entry point moved.
//
// Two pages stay OUT of the groups (per client):
//   • Referral program (`/admin/settings/referral`) — lives in the Marketing
//     sidebar group, no tab bar needed
//   • Account settings (`/admin/settings/account`) — accessed from the user
//     menu chip, no tab bar needed
//
// This file is the single source of truth. Both the sidebar dropdown and
// the per-page `SettingsGroupHeader` component read from here — renaming
// or reordering happens in one place.

import type { ComponentType } from "react";
import { Building01, Settings03, Users01 } from "@untitledui/icons";

export type SettingsGroupId = "business" | "operations" | "customer";

export interface SettingsTab {
    label: string;
    href: string;
}

export interface SettingsGroupDef {
    id: SettingsGroupId;
    label: string;
    /** Sidebar dropdown icon. */
    icon: ComponentType<{ className?: string }>;
    /** Tabs rendered on every page in this group. Order matters —
     *  the first tab is the group's default landing target. */
    tabs: SettingsTab[];
}

export const SETTINGS_GROUPS: SettingsGroupDef[] = [
    {
        id: "business",
        label: "Business",
        icon: Building01,
        tabs: [
            { label: "Business & locations", href: "/admin/settings/business-locations" },
            { label: "Branding",             href: "/admin/settings/branding"           },
        ],
    },
    {
        id: "operations",
        label: "Operations",
        icon: Settings03,
        tabs: [
            // Services (client 2026-08-04) — studio-level on/off switches for
            // the optional service types (Memberships / Private sessions /
            // Recovery). Not every studio runs all three; turning one off is
            // meant to hide everything related to it (menus, modules, data,
            // reports). UI-only for now — the cascade wiring lands in a later
            // phase. Sits first because it's the most foundational "what does
            // this studio actually sell" configuration.
            { label: "Services",            href: "/admin/settings/services"            },
            { label: "Booking rules",        href: "/admin/settings/booking-rules"       },
            { label: "Tax",                  href: "/admin/settings/tax"                 },
            // Retail categories tab retired 2026-07-31 — moved out of
            // Settings and into the "Products & pricing" sidebar group
            // directly under Retail (see Sidebar.tsx). URL rehomed to
            // /admin/products/retail-categories at the same time.
            { label: "Integrations",         href: "/admin/settings/integrations"        },
            // Migration & imports (client 2026-07-20) — audit log of every
            // ONRA AI-Agent-driven import. Sits next to Integrations because
            // both are "operational plumbing" tabs.
            { label: "Migration & imports",  href: "/admin/settings/migrations-imports"  },
        ],
    },
    {
        id: "customer",
        label: "Customer",
        icon: Users01,
        tabs: [
            { label: "Customer notifications", href: "/admin/settings/notifications"  },
            // Freeze policy tab retired Jul 2026 — the settings card moved
            // under Booking rules (alongside Cancellation policy).
            { label: "Agreements",             href: "/admin/settings/agreements"      },
            // v83 Phase 6 (client 2026-07-24) — studio-editable Customer
            // sources + Follow-up stages, per PDF §4.
            { label: "Lead lifecycle",         href: "/admin/settings/lead-lifecycle"  },
        ],
    },
];

/** First-tab href of the first group — used by the `/admin/settings`
 *  landing redirect and the sidebar's Settings parent (when it needs a
 *  default target). Changing SETTINGS_GROUPS order automatically shifts
 *  this. */
export const SETTINGS_DEFAULT_HREF: string = SETTINGS_GROUPS[0].tabs[0].href;

/** Look up which group owns a given pathname. Returns null for routes
 *  outside the tabbed groups (e.g. `/admin/settings/referral`,
 *  `/admin/settings/account`, `/admin/settings/branches/[id]`). */
export function findSettingsGroupFor(pathname: string): SettingsGroupDef | null {
    for (const g of SETTINGS_GROUPS) {
        if (g.tabs.some(t => pathname === t.href || pathname.startsWith(t.href + "/"))) {
            return g;
        }
    }
    return null;
}
