"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings layout (wraps every /admin/settings/* page)
// ─────────────────────────────────────────────────────────────────────────────
//
// Injects the group-aware tab bar (`SettingsGroupHeader`) at the top of every
// settings page that belongs to a group (Business / Operations / Customer —
// see `src/config/settings-groups.ts`). Pages outside the groups
// (`/settings/referral`, `/settings/account`, deep detail pages like
// `/settings/branches/[id]`) render as-is — the header component returns
// null for those paths.
//
// Deliberately a plain flex-col without `min-h-full` / `flex-1` wrappers:
// those forced vertical stretch behavior that made the last card butt up
// against the admin container's inner edge when the content was long
// enough to scroll. Letting the children flow at their natural height
// preserves the admin `<main>`'s `p-6` bottom padding as visible
// breathing room. `pb-2` here adds a subtle extra gap so short pages
// still leave the outer rule visible.

import { SettingsGroupHeader } from "@/components/layout/SettingsGroupHeader";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-6 pb-2">
            <SettingsGroupHeader />
            {children}
        </div>
    );
}
