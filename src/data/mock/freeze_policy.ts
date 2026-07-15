// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `freeze_policy` seed (studio-wide)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single record — one studio, one policy. Client Jul 2026: flipped from the
// earlier per-branch model to a studio-wide singleton (mirrors
// `cancellation_policy` and `classes_settings`).
//
// Read + written via Settings → Customer → Freeze policy
// (`/admin/settings/freeze-policy`). Governs the CUSTOMER self-service
// membership-freeze flow only — admin freeze/unfreeze is a full override.

import type { FreezePolicy, FreezeReason } from "./_types";

/** The 3 out-of-the-box reasons shown when Allow exceptions is on. */
function defaultReasons(): FreezeReason[] {
    return [
        { id: "medical",          label: "Medical condition or illness", enabled: true },
        { id: "injury",           label: "Injury",                       enabled: true },
        { id: "family_emergency", label: "Family emergency",             enabled: true },
    ];
}

export const freeze_policy: FreezePolicy = {
    id: "freeze_policy_default",
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
};
