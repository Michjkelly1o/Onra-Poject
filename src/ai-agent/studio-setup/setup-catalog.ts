// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Studio-setup catalog (Phase 11)
// ─────────────────────────────────────────────────────────────────────────────
//
// The Studio setup thread's advisor tools read this catalog to answer
// "what's set up?" and "what should I configure next?". Each entry maps
// a configurable area of the studio to (a) the store slice the count
// comes from, (b) the admin route the tester deep-links to, and (c) a
// human blurb.
//
// Kept as a plain data list so adding a new setup step is a one-line
// entry — no code changes in setup-tools.ts or the prompt.

import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";

export type SetupStepKey =
    | "branches"
    | "rooms"
    | "class_categories"
    | "class_templates"
    | "instructors"
    | "memberships"
    | "packages"
    | "booking_rules"
    | "tax"
    | "referral"
    | "notifications"
    | "agreements";

export interface SetupStep {
    key: SetupStepKey;
    label: string;
    /** One-line prose the AI can drop into a reply. */
    description: string;
    /** Admin route that lets the tester configure this. Client-side
     *  navigation via router.push in the DeepLink chip. */
    href: string;
    /** Read a live count from the store snapshot. Returns null when
     *  the step doesn't correspond to a counted slice (booking rules,
     *  tax, referral — those are policy toggles, not row counts). */
    countFromSnapshot: (state: AiAgentStateSnapshot) => number | null;
    /** True when the step is considered "done enough" — this drives
     *  the "N of M configured" tile and the missing-items list. */
    isConfigured: (state: AiAgentStateSnapshot) => boolean;
}

const has = (n: number | null | undefined) => (n ?? 0) > 0;

/** The canonical ordered onboarding sequence. Order matters: earlier
 *  steps unblock later ones (you can't create class templates without
 *  categories; you can't run payroll without instructors). */
export const SETUP_STEPS: SetupStep[] = [
    {
        key: "branches",
        label: "Branches",
        description:
            "Every studio has at least one physical location. Set your main branch first, then add satellite locations if you operate more than one.",
        href: "/admin/settings/business-locations",
        countFromSnapshot: (s) => s.branches.length,
        isConfigured: (s) => has(s.branches.length),
    },
    {
        key: "rooms",
        label: "Rooms",
        description:
            "Rooms sit inside branches — Studio A, Reformer Room, Recovery Suite. Class + appointment schedules pick a room from this list.",
        href: "/admin/settings/business-locations",
        countFromSnapshot: (s) => s.rooms.length,
        isConfigured: (s) => has(s.rooms.length),
    },
    {
        key: "class_categories",
        label: "Class categories",
        description:
            "Broad groupings your classes fall under — Yoga, Pilates, Barre. Categories also colour-code class cards across the app.",
        href: "/admin/categories",
        countFromSnapshot: (s) => s.classCategories.length,
        isConfigured: (s) => has(s.classCategories.length),
    },
    {
        key: "class_templates",
        label: "Class templates",
        description:
            "The recurring class definitions (name, duration, capacity). Every scheduled class is an instance of one of these.",
        href: "/admin/class-types",
        countFromSnapshot: (s) => s.classTemplates.length,
        isConfigured: (s) => has(s.classTemplates.length),
    },
    {
        key: "instructors",
        label: "Instructors",
        description:
            "Staff members who teach classes or run private sessions. Payroll + attendance both key off this list.",
        href: "/admin/instructors",
        countFromSnapshot: (s) => s.instructors.length,
        isConfigured: (s) => has(s.instructors.length),
    },
    {
        key: "memberships",
        label: "Memberships",
        description:
            "Subscription plans customers buy — monthly or annual, unlimited or class-limited. At least one active membership is usually the anchor of your revenue.",
        href: "/admin/products",
        countFromSnapshot: (s) => s.memberships.length,
        isConfigured: (s) => has(s.memberships.length),
    },
    {
        key: "packages",
        label: "Packages",
        description:
            "Class-credit packs — buy 10 credits, use within 90 days. A great alternative to memberships for drop-in customers.",
        href: "/admin/products",
        countFromSnapshot: (s) => s.packages.length,
        isConfigured: (s) => has(s.packages.length),
    },
    {
        key: "booking_rules",
        label: "Booking rules",
        description:
            "Cancellation window, no-show penalties, freeze policy. Cover these before you go live so customer expectations are clear from day one.",
        href: "/admin/settings/booking-rules",
        countFromSnapshot: () => null,
        // No obvious "configured" signal on the client snapshot (rules
        // are per-branch policy toggles) — treat as done once at least
        // one branch exists, then defer to the admin's judgement.
        isConfigured: (s) => has(s.branches.length),
    },
    {
        key: "tax",
        label: "Tax",
        description:
            "VAT rate + whether prices are quoted tax-inclusive or exclusive. Applied at POS checkout for every sale.",
        href: "/admin/settings/tax",
        countFromSnapshot: () => null,
        isConfigured: (s) => has(s.branches.length),
    },
    {
        key: "referral",
        label: "Referral program",
        description:
            "Reward existing customers for bringing new ones — either class credits or account credit. Turn off if you don't run referrals.",
        href: "/admin/settings/referral",
        countFromSnapshot: () => null,
        isConfigured: (s) => has(s.branches.length),
    },
    {
        key: "notifications",
        label: "Notifications",
        description:
            "Which events send an email / WhatsApp / SMS to customers — booking confirmations, cancellations, class reminders.",
        href: "/admin/settings/notifications",
        countFromSnapshot: () => null,
        isConfigured: (s) => has(s.branches.length),
    },
    {
        key: "agreements",
        label: "Agreements + waivers",
        description:
            "Liability waiver + terms of service every new customer signs before their first class.",
        href: "/admin/settings/agreements",
        countFromSnapshot: () => null,
        isConfigured: (s) => has(s.branches.length),
    },
];
