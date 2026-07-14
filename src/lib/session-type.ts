// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Session type dimension: labels + tag palette
// ─────────────────────────────────────────────────────────────────────────────
//
// The single source of truth for how the `type` dimension
// ("class" | "private" | "recovery") is presented across the app —
// canonical labels, short tag labels, and the tag chip colour palette.
// Import from here everywhere a type is shown or filtered so schedule,
// dashboard, and filters all read/paint the same way.
//
// Colours (client-confirmed): Class = green · Private = purple/indigo ·
// Recovery = orange. These are fixed admin-side hexes (the admin surfaces
// don't use the customer brand vars). Kept aligned with the DS badge
// palette (green = success, orange = warning-ish, purple = info-accent).

import type { SessionType } from "@/lib/store";

/** Full labels — filters + detail surfaces. */
export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
    class:    "Classes",
    private:  "Private sessions",
    recovery: "Recovery & wellness",
};

/** Short labels — compact tag chips on schedule / dashboard cards. */
export const SESSION_TYPE_TAG_LABEL: Record<SessionType, string> = {
    class:    "Class",
    private:  "Private",
    recovery: "Recovery",
};

/** Tag chip palette — bg / text / border per type, plus a softer `bar`
 *  mid-tone for the dashboard occupancy mini bars (the badge text colours
 *  read too heavy as a filled bar). */
export const SESSION_TYPE_TAG_COLORS: Record<SessionType, { bg: string; text: string; border: string; bar: string }> = {
    // Green (matches the DS success badge).
    class:    { bg: "#ecfdf3", text: "#067647", border: "#abefc6", bar: "#7cc8a0" },
    // Purple / indigo.
    private:  { bg: "#f4f3ff", text: "#5925dc", border: "#d9d6fe", bar: "#a99cf5" },
    // Orange.
    recovery: { bg: "#fef6ee", text: "#b93815", border: "#f9dbaf", bar: "#f0a06a" },
};

/** Ordered list for filter chips / bubbles — Classes, then Private, then Recovery. */
export const SESSION_TYPE_ORDER: SessionType[] = ["class", "private", "recovery"];
