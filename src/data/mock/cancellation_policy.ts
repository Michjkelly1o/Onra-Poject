// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `cancellation_policy` seed (v26 — Booking Rules redesign)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single studio-wide record replacing the legacy list of policies. Read
// + written via the Cancellation policy side panel (Figma 7631:404757 /
// 7714:17240). Defaults mirror the Figma landing:
//   • Credit & package members: 12 h before → Credit returned,
//                                12 h within → Credit forfeited
//   • Membership members:       Late-cancel fee AED 50,
//                                No-show fee    AED 70
//   • Applies to:                6 packages + 5 classes (populated
//                                below to match the "6 selected · 5
//                                selected" chips on the Applied to
//                                accordion in Figma 7631:455367).
//
// The `applied_to_*` arrays MUST reference real ids from the current
// seed set. Any product/class-template renames need to sync here.

import type { CancellationPolicy } from "./_types";

export const cancellation_policy: CancellationPolicy = {
    id: "cancellation_policy_default",

    // ── Credit & package members ────────────────────────────────────
    credit_before_window_value: 12,
    credit_before_window_unit: "hours",
    credit_before_outcome: "credit_returned",
    credit_within_window_value: 12,
    credit_within_window_unit: "hours",
    credit_within_outcome: "credit_forfeited",

    // ── Membership members (no credit to forfeit) ───────────────────
    membership_late_cancel_fee_enabled: true,
    membership_late_cancel_fee_aed: 50,
    membership_no_show_fee_enabled: true,
    membership_no_show_fee_aed: 70,

    // ── Applies to (per Figma 7631:455367 — 6 packages + 5 classes) ──
    // Packages: 3 memberships + 3 class-packages (matches the demo
    // "6 selected" chip). Ids MUST reference real rows in
    // `memberships.ts` + `packages.ts` — mismatches cause the
    // Applies-to accordion to under-count in the panel + landing.
    applied_to_package_ids: [
        "mem_beginner_monthly",
        "mem_advanced_monthly",
        "mem_unlimited_monthly",
        "pkg_1_class_intro",
        "pkg_5_class",
        "pkg_10_class",
    ],
    // Classes: the studio ships 3 templates today (Reformer Pilates /
    // Barre / Hot Yoga). All 3 are in scope so the accordion demos as
    // "3 selected" (would-be Figma "5 selected" needs 2 more templates
    // added to the class_templates seed to reach parity).
    applied_to_class_template_ids: [
        "tpl_reformer_pilates",
        "tpl_barre",
        "tpl_hot_yoga",
    ],
};
