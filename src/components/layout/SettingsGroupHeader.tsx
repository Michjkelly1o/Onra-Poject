"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — SettingsGroupHeader
// ─────────────────────────────────────────────────────────────────────────────
//
// Contextual tab bar rendered at the top of every settings page under
// `/admin/settings/*` that belongs to a group. The group is resolved from
// the current pathname via `findSettingsGroupFor`, and the sibling tabs
// come from `SETTINGS_GROUPS` — so any page in the Business group renders
// the same "Business & locations · Branding" tab bar, current page
// underlined, click → route push.
//
// If the current path doesn't belong to a group (e.g. `/settings/referral`
// or `/settings/account`), this renders nothing — those pages are
// intentionally outside the tabbed structure.

import { usePathname, useRouter } from "next/navigation";
import { DetailPageTabs } from "@/components/patterns/DetailPageTabs";
import { findSettingsGroupFor } from "@/config/settings-groups";

export function SettingsGroupHeader({ className }: { className?: string } = {}) {
    const pathname = usePathname() ?? "";
    const router   = useRouter();

    const group = findSettingsGroupFor(pathname);
    if (!group) return null;

    // Match the current pathname to the tab whose href is the deepest
    // prefix — same longest-match rule the sidebar uses, so nested
    // routes under a tab (`/branches/[id]` under `business-locations`)
    // still light up the parent tab.
    const activeKey = resolvePrefixWinner(pathname, group.tabs.map(t => t.href))
        ?? group.tabs[0].href;

    return (
        // Sticky when scrolling. Tab position is unchanged — the
        // compensating `-mt-6 / pt-6` cancels out visually. The
        // invisible bg-white extends up 24px to cover main's p-6
        // padding-top zone so scrolled content doesn't bleed through
        // the gap between the page header and the tabs.
        <div className="sticky top-0 z-30 -mx-6 -mt-6 px-6 pt-6 bg-white border-b border-[#e4e7ec]">
            <DetailPageTabs
                tabs={group.tabs.map(t => ({ key: t.href, label: t.label }))}
                activeKey={activeKey}
                onChange={href => router.push(href)}
                className={className}
            />
        </div>
    );
}

/** Longest-prefix-wins matcher — mirrors the sidebar's `navWinner`
 *  algorithm. Returns the winning href or null if no tab covers the
 *  current path. */
function resolvePrefixWinner(pathname: string, hrefs: string[]): string | null {
    let winner: string | null = null;
    for (const h of hrefs) {
        if (pathname === h || pathname.startsWith(h + "/")) {
            if (!winner || h.length > winner.length) winner = h;
        }
    }
    return winner;
}
