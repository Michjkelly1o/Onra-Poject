// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `freeze_policy` seed (studio-wide)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single record — one studio, one policy. Client Jul 2026: flipped from the
// earlier per-branch model to a studio-wide singleton (mirrors
// `cancellation_policy` and `classes_settings`).
//
// v2 (client 2026-07-20) — expanded to cover the full membership-freeze
// workflow: billing behavior (Option A/B), who-can-freeze mode, minimum
// duration, per-reason exceptions. See
// new-prd/freeze-policy-v2-implementation-plan.md.

import type { FreezePolicy, FreezeReason } from "./_types";

/** The 3 out-of-the-box reasons shown when Require reason is on.
 *
 *  Medical carries pre-seeded exceptions matching the Figma reference
 *  ("3 exceptions" chip) so the demo lands on a populated example
 *  without the admin having to click through — every exception flag
 *  turned on for Medical reads as "genuine medical need bypasses the
 *  policy limits". Injury + Family emergency ship without exceptions
 *  so the empty state ("No exceptions ▾") is also visible on the
 *  landing view. */
function defaultReasons(): FreezeReason[] {
    return [
        {
            id: "medical",
            label: "Medical condition or illness",
            enabled: true,
            exceptions: {
                ignoresMaxDuration: true,
                ignoresFreezeLimit: true,
                waivesFee: true,
            },
        },
        { id: "injury",           label: "Injury",           enabled: true },
        { id: "family_emergency", label: "Family emergency", enabled: true },
    ];
}

export const freeze_policy: FreezePolicy = {
    id: "freeze_policy_default",
    enabled: true,

    // v2 — Billing during a freeze. "Pause" is the recommended default
    // per client 2026-07-20 (Option A — payment date shifts, members
    // skip nothing).
    billing_behavior: "pause",

    // v2 — Who can freeze. Default to the most permissive so the demo
    // renders the self-serve customer flow out of the box.
    who_can_freeze: "members_and_admins",

    // v2 — Minimum freeze duration. Client Figma default: 7 days.
    min_duration_value: 7,
    min_duration_unit: "days",

    max_duration_enabled: true,
    max_duration_value: 30,
    max_duration_unit: "days",

    limit_freezes_enabled: true,
    max_freezes: 2,
    // v2 — Fixed at "calendar_year" per client written brief (won over
    // the Figma "rolling 12 months" label — see plan doc Q1).
    max_freezes_period: "calendar_year",

    fee_enabled: false,
    fee_type: "one_time",
    fee_amount_aed: 0,

    // v2 — renamed from `allow_exceptions` (semantic-equivalent). The
    // store's onRehydrateStorage migration copies the old field into
    // this one on any pre-v77 persisted snapshot.
    require_reason: true,
    reasons: defaultReasons(),

    apply_to: "all",
    membership_ids: [],
};
