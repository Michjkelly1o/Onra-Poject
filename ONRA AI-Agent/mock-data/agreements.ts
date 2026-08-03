// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `agreements` seed (PRD 11 §9)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors Figma `4232-52279` (Agreements list — 3 demo rows). Same 3 rows
// as v23 but each row now carries the v24 Step-2 fields:
//   • effective_dates_mode ("ongoing" | "expiry")
//   • require_re_acceptance      (boolean)
//   • require_guardian_consent   (boolean)
//
// Row seed matches the Figma exactly:
//   1. Waiver booking      — Active   · Multi-branch (South + West) · v5
//                            · Ongoing · re-acceptance ON · guardian ON
//   2. Liability Waiver    — Active (Label) · Multi-branch          · v1
//                            · Ongoing · re-acceptance ON · guardian ON
//   3. Liability Waiver    — Archived · Specific branch (South)     · v1
//                            · Expiry (2025-04-22)
//
// The Effective-until column reads:
//   • effective_dates_mode = "ongoing" → renders "Ongoing" pill
//   • effective_dates_mode = "expiry"  → renders `effective_until` as a
//                                        date pill
//
// FK: `location_ids[]` → `branches.id`.

import type { AgreementSeed } from "./_types";

export const agreements: AgreementSeed[] = [
    // ── Row 1 — Active · Multi-branch (South + West) · v5 · Expiry (per
    //    Figma list first row: "Effective until 2025-04-22") ─────────────
    {
        id: "agr_waiver_booking",
        name: "Waiver booking",
        type: "liability_waiver",
        description: "Default booking liability waiver — covers risks of physical activity and class participation across all branches.",
        required: true,
        current_version: 5,
        all_locations: false,
        location_ids: ["branch_forma_south", "branch_forma_west"],
        effective_dates_mode: "expiry",
        effective_from:  "2025-04-22",
        effective_until: "2025-04-22",
        require_re_acceptance:    true,
        require_guardian_consent: true,
        status: "active",
        updated_at: "2026-05-12T10:00:00Z",
        created_at: "2025-04-22T10:00:00Z",
    },

    // ── Row 2 — Label (Ongoing) · Multi-branch (South + West) · v1 ──────
    // Figma's second row shows a blue "Ongoing" pill for Effective until
    // and a sage "Label" status pill — an active agreement whose demo
    // banner is currently promoted to the top of the list.
    {
        id: "agr_liability_south",
        name: "Liability Waiver",
        type: "liability_waiver",
        description: "This is new liability for specific branch.",
        required: true,
        current_version: 1,
        all_locations: false,
        location_ids: ["branch_forma_south", "branch_forma_west"],
        effective_dates_mode: "ongoing",
        effective_from:  "",
        effective_until: "",
        require_re_acceptance:    true,
        require_guardian_consent: true,
        status: "active",
        updated_at: "2025-04-22T10:00:00Z",
        created_at: "2025-04-22T10:00:00Z",
    },

    // ── Row 3 — Archived · Specific branch (South) · v1 · Ongoing ──────
    {
        id: "agr_liability_east",
        name: "Liability Waiver",
        type: "liability_waiver",
        description: "Superseded by the multi-branch Waiver booking, archived.",
        required: false,
        current_version: 1,
        all_locations: false,
        location_ids: ["branch_forma_south"],
        effective_dates_mode: "ongoing",
        effective_from:  "",
        effective_until: "",
        require_re_acceptance:    false,
        require_guardian_consent: false,
        status: "archived",
        updated_at: "2026-01-15T10:00:00Z",
        created_at: "2025-04-22T10:00:00Z",
    },
];
