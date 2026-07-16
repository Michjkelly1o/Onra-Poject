"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — shared branch-location helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for "Open • hours today" + "open in Google Maps",
// shared by the Branch selector sheet and the BranchLocationCard (class /
// appointment / instructor details) so every surface reads identically.

import { business_hours } from "@/data/mock";
import { DEMO_TODAY_ISO } from "@/lib/customer/home-data";

// Day-of-week anchored to the seed's reference date (matches the demo carousel).
const TODAY_DOW = new Date(`${DEMO_TODAY_ISO}T00:00:00Z`).getUTCDay();

/** "14:00" → "02:00 PM". */
export function to12h(time: string): string {
    const [hStr, mStr] = time.split(":");
    const h = Number(hStr);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${mStr} ${period}`;
}

/** Today's operational state for a branch (open flag + "07:00 AM - 08:00 PM"). */
export function branchHoursToday(branchId: string): { isOpen: boolean; hoursLabel: string } {
    const row = business_hours.find((bh) => bh.branch_id === branchId && bh.day_of_week === TODAY_DOW);
    if (!row || row.is_closed) return { isOpen: false, hoursLabel: "Closed today" };
    return { isOpen: true, hoursLabel: `${to12h(row.open_time)} - ${to12h(row.close_time)}` };
}

/** Open the branch address in Google Maps (new tab) — mirrors the selector's Details link. */
export function openBranchInMaps(address: string) {
    if (!address) return;
    try {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
    } catch {
        /* demo environment */
    }
}
