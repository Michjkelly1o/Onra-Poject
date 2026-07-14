// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `freeze_policy` seed (per-branch)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per branch. Read + written via Settings → Customer → Freeze policy
// (`/admin/settings/freeze-policy`). Governs the CUSTOMER self-service
// membership-freeze flow only — admin freeze/unfreeze is a full override.
//
// Defaults mirror the reference screen: policy ON, 30-day max, 2 freezes max,
// no fee, 3 default reasons. East ships with a small one-time fee so the demo
// shows the fee path; West (inactive branch) ships with the policy OFF so the
// "disabled" customer state is demoable by switching branch.

import type { FreezePolicy, FreezeReason } from "./_types";

/** The 3 out-of-the-box reasons from the reference screen. Each policy owns
 *  its own copy so a branch can enable/disable reasons independently. */
function defaultReasons(): FreezeReason[] {
    return [
        { id: "medical",          label: "Medical condition or illness", enabled: true },
        { id: "injury",           label: "Injury",                       enabled: true },
        { id: "family_emergency", label: "Family emergency",             enabled: true },
    ];
}

function policyFor(branch_id: string, overrides: Partial<FreezePolicy> = {}): FreezePolicy {
    return {
        branch_id,
        enabled: true,
        max_duration_enabled: true,
        max_duration_value: 30,
        max_duration_unit: "days",
        limit_freezes_enabled: true,
        max_freezes: 2,
        fee_enabled: false,
        fee_type: "one_time",
        fee_amount_aed: 0,
        allow_exceptions: true,
        reasons: defaultReasons(),
        apply_to: "all",
        membership_ids: [],
        ...overrides,
    };
}

export const freeze_policy: FreezePolicy[] = [
    policyFor("branch_forma_south"),
    policyFor("branch_forma_east", { fee_enabled: true, fee_amount_aed: 25 }),
    // West is the inactive branch — ship the policy OFF so the customer-side
    // "freezing is unavailable" state is demoable by switching branch.
    policyFor("branch_forma_west", { enabled: false }),
];
